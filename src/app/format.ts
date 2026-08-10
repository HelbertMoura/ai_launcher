//! Time-formattting helpers shared by StatusBar / history surfaces.
//!
//! Extracted from `App.tsx` as part of REF-002 (split `App.tsx`). Pure
//! functions only — no React, no I/O — so they stay trivially testable
//! and tree-shakeable. See `.wolf/audit-2026-08-10.md`.

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Render a timestamp as a short human string (e.g. "5m ago", "3h ago").
 *
 * Returns `null` for:
 * - empty/undefined input
 * - unparsable ISO string
 * - timestamps more than 24h in the past or in the future
 *
 * The 24h ceiling is intentional: anything older than a day is shown as a
 * full date by the surface that consumes this helper, never as "Xd ago".
 */
export function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const diff = Date.now() - ms;
  if (diff < 0 || diff > DAY_MS) return null;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
