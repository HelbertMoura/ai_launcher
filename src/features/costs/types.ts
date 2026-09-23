import { z } from "zod";

/**
 * Zod contracts for the usage wire payloads (v23 Cost Governance 3.0). They
 * mirror the Rust structs in `src-tauri/src/commands/config.rs` (post 3a:
 * `project_path` on entries, canonical `key`/`display_name` on top projects)
 * and the typed wrapper in `lib/tauri.ts`. Validation intentionally lives at
 * the store level — never inside `lib/tauri.ts` — following the `raceStore`
 * pattern.
 */

/**
 * One aggregated usage entry (per date/model/file-group on the backend).
 * `provider` and `project` stay optional for legacy seeds; `project_path`
 * (3a) carries the raw project directory when reliably known (Codex records
 * its `cwd`) and is null/absent for Claude, whose on-disk folder encoding is
 * not guaranteed to be reversible.
 */
export const UsageEntrySchema = z.object({
  date: z.string().min(1),
  cli: z.string().min(1),
  provider: z.string().nullable().optional(),
  model: z.string().nullable(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_estimate_usd: z.number(),
  project: z.string().nullable().optional(),
  project_path: z.string().nullable().optional(),
});
export type UsageEntry = z.infer<typeof UsageEntrySchema>;

/** Per-CLI rollup of the report (`by_cli` map value on the Rust side). */
export const CliUsageSummarySchema = z.object({
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_usd: z.number(),
  entries: z.number(),
});
export type CliUsageSummary = z.infer<typeof CliUsageSummarySchema>;

/**
 * One top-project aggregate (3a): `key` is the canonical grouping key
 * (normalized path when trusted, lowercased label otherwise) and
 * `display_name` the deterministic readable label. Optional here so older
 * seeds/payloads without the 3a fields still validate.
 */
export const ProjectUsageSchema = z.object({
  project: z.string(),
  key: z.string().optional(),
  display_name: z.string().optional(),
  cost_usd: z.number(),
  tokens: z.number(),
});
export type ProjectUsage = z.infer<typeof ProjectUsageSchema>;

/**
 * Full usage report payload. Totals/`by_cli`/`top_projects`/`warnings`
 * are optional: the backend always sends them, but tolerant parsing keeps
 * legacy fallbacks (`{ entries: [] }`) and e2e seeds valid.
 */
export const UsageReportSchema = z.object({
  entries: z.array(UsageEntrySchema),
  total_tokens_in: z.number().optional(),
  total_tokens_out: z.number().optional(),
  total_cost_usd: z.number().optional(),
  by_cli: z.record(z.string(), CliUsageSummarySchema).optional(),
  top_projects: z.array(ProjectUsageSchema).optional(),
  warnings: z.array(z.string()).optional(),
});
export type UsageReport = z.infer<typeof UsageReportSchema>;

// ==============================================================================
// Budget v3 storage contracts (Cost Governance 3.0, wave 3c) + v15 migration.
// Shared by `providers/budget.ts` (strict read-path validation) and
// `lib/storage/registry.ts` (tolerant boundary + old-backup import migration),
// so both paths apply the exact same v15 -> v3 rules. Depends on zod only.
// ==============================================================================

/** What a budget limit applies to: a provider (legacy behavior) or a project. */
export const BudgetScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('provider'), providerKey: z.string().min(1) }),
  z.object({
    kind: z.literal('project'),
    projectKey: z.string().min(1),
    displayName: z.string().min(1),
  }),
]);
export type BudgetScope = z.infer<typeof BudgetScopeSchema>;

/**
 * Billing window of a limit. Providers keep the pre-3c rolling window
 * (explicit anchor for user-triggered resets); project quotas are
 * calendar-month (design decision D1).
 */
export const BudgetPeriodSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rolling'),
    days: z.number().int().positive(),
    anchor: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  z.object({ kind: z.literal('calendar-month') }),
]);
export type BudgetPeriod = z.infer<typeof BudgetPeriodSchema>;

/** Strict v3 limit shape persisted under the SAME key (`ai-launcher:v15:budget`). */
export const BudgetLimitV3Schema = z.object({
  id: z.string().min(1),
  scope: BudgetScopeSchema,
  limitUsd: z.number().nonnegative(),
  period: BudgetPeriodSchema,
  alertAtPercent: z.number().min(1).max(100),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type BudgetLimitV3 = z.infer<typeof BudgetLimitV3Schema>;

/**
 * Deterministic id for a migrated v15 limit: FNV-1a 32-bit hex over the exact
 * v15 identity triple `providerKey|limitUsd|periodDays`. Chosen over raw
 * concatenation so the id stays compact and URL/namespace friendly while
 * remaining stable across sessions and machines (no Date/Math.random). v15
 * stores hold at most one limit per provider (upsert semantics), so the triple
 * is unique within any real migrated batch; ids are identity metadata, never
 * lookup keys.
 */
export function stableBudgetLimitId(providerKey: string, limitUsd: number, periodDays: number): string {
  const basis = `${providerKey}|${limitUsd}|${periodDays}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < basis.length; i += 1) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `bgt-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** v15 shape detection: has `providerKey`, lacks the v3 `id`/`scope` fields. */
function isV15BudgetLimit(raw: unknown): raw is Record<string, unknown> {
  return (
    isPlainObject(raw) &&
    typeof raw.providerKey === 'string' &&
    raw.providerKey.length > 0 &&
    raw.id === undefined &&
    raw.scope === undefined
  );
}

function looksLikeV3BudgetLimit(raw: unknown): boolean {
  return isPlainObject(raw) && typeof raw.id === 'string' && isPlainObject(raw.scope);
}

function warnBudgetMigration(message: string, raw: unknown): void {
  // Never drop data silently: mirror the registry pattern (R3) with a dev-
  // visible copy of the rejected value.
  console.warn(`[budget:v3-migration] ${message}`, raw);
}

/**
 * Migrate ONE v15 limit (`providerKey, limitUsd, periodDays, alertAtPercent,
 * periodAnchor?`) to v3. Loss-less for every valid field; invalid numerics
 * fall back to schema-safe defaults with a console.warn instead of dropping
 * the entry. Returns null only when `raw` is not a recognizable v15 entry.
 * `migratedAt` (YYYY-MM-DD) is injectable for deterministic tests and becomes
 * `createdAt` for entries that never had one.
 */
export function migrateBudgetLimitV15ToV3(raw: unknown, migratedAt: string): BudgetLimitV3 | null {
  if (!isV15BudgetLimit(raw)) return null;

  const providerKey = raw.providerKey as string;

  let limitUsd = 0;
  if (typeof raw.limitUsd === 'number' && Number.isFinite(raw.limitUsd) && raw.limitUsd >= 0) {
    limitUsd = raw.limitUsd;
  } else {
    warnBudgetMigration(`limitUsd inválido para "${providerKey}", usando 0`, raw);
  }

  let periodDays = 30;
  if (typeof raw.periodDays === 'number' && Number.isInteger(raw.periodDays) && raw.periodDays > 0) {
    periodDays = raw.periodDays;
  } else {
    warnBudgetMigration(`periodDays inválido para "${providerKey}", usando 30`, raw);
  }

  let alertAtPercent = 80;
  if (
    typeof raw.alertAtPercent === 'number' &&
    Number.isFinite(raw.alertAtPercent) &&
    raw.alertAtPercent >= 1 &&
    raw.alertAtPercent <= 100
  ) {
    alertAtPercent = raw.alertAtPercent;
  } else {
    warnBudgetMigration(`alertAtPercent inválido para "${providerKey}", usando 80`, raw);
  }

  let anchor: string | undefined;
  if (typeof raw.periodAnchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.periodAnchor)) {
    anchor = raw.periodAnchor;
  } else if (raw.periodAnchor !== undefined) {
    warnBudgetMigration(`periodAnchor inválido para "${providerKey}", descartando o anchor`, raw);
  }

  const migrated: BudgetLimitV3 = {
    id: stableBudgetLimitId(providerKey, limitUsd, periodDays),
    scope: { kind: 'provider', providerKey },
    limitUsd,
    period: anchor
      ? { kind: 'rolling', days: periodDays, anchor }
      : { kind: 'rolling', days: periodDays },
    alertAtPercent,
    createdAt: migratedAt,
  };
  // By construction this always passes; belt-and-suspenders for the storage boundary.
  const parsed = BudgetLimitV3Schema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

/**
 * Normalize a persisted `limits` array to strict v3, in place per entry:
 * - v3 entries are strictly re-validated and kept as-is (never re-migrated);
 * - v15 entries are migrated with the loss-less rules above;
 * - unrecognized/corrupt entries are dropped WITH a console.warn (fail-closed,
 *   never silently). v15-detected entries are never dropped.
 */
export function normalizeBudgetLimits(limitsRaw: unknown, migratedAt: string): BudgetLimitV3[] {
  if (!Array.isArray(limitsRaw)) return [];
  const limits: BudgetLimitV3[] = [];
  for (const raw of limitsRaw) {
    if (looksLikeV3BudgetLimit(raw)) {
      const parsed = BudgetLimitV3Schema.safeParse(raw);
      if (parsed.success) {
        limits.push(parsed.data);
      } else {
        warnBudgetMigration('entrada v3 corrompida descartada', raw);
      }
      continue;
    }
    const migrated = migrateBudgetLimitV15ToV3(raw, migratedAt);
    if (migrated) {
      limits.push(migrated);
    } else {
      warnBudgetMigration('entrada de budget irreconhecível descartada', raw);
    }
  }
  return limits;
}
