import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { loadProviders } from './providers/storage';
import type { ProviderProfile } from './providers/types';
import { Sparkline } from './shared/Sparkline';
import './CostAggregator.css';

/**
 * Tenta casar um nome de modelo (vindo do usage.jsonl) com um perfil
 * cadastrado. Útil pra Z.AI (glm-*), MiniMax (MiniMax-*) e customs.
 * Prioridade: prefix específico do kind > mainModel/fastModel exatos.
 */
function matchProviderForModel(model: string | null, profiles: ProviderProfile[]): ProviderProfile | undefined {
  if (!model) return undefined;
  const lower = model.toLowerCase();
  // 1. Tenta match por prefix de família
  if (lower.startsWith('glm-')) return profiles.find(p => p.kind === 'zai');
  if (lower.startsWith('minimax-')) return profiles.find(p => p.kind === 'minimax');
  // 2. Match exato em main/fast
  return profiles.find(p => p.mainModel === model || p.fastModel === model);
}

// ==================== TYPES ====================
// Schema uniforme retornado pelo comando Tauri `read_usage_stats`.
// IMPORTANTE: serde (Rust) usa snake_case por padrão, então mantemos
// snake_case aqui para bater exatamente com o JSON serializado.

interface UsageEntry {
  cli: string;
  date: string; // ISO yyyy-mm-dd
  tokens_in: number;
  tokens_out: number;
  cost_estimate_usd: number;
  model: string | null;
  project: string | null;
}

interface CliUsageSummary {
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  entries: number;
}

interface ProjectUsage {
  project: string;
  cost_usd: number;
  tokens: number;
}

interface UsageReport {
  entries: UsageEntry[];
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  by_cli: Record<string, CliUsageSummary>;
  top_projects: ProjectUsage[];
  warnings: string[];
}

// Cores por CLI — replicadas aqui para manter CostAggregator independente.
const CLI_COLORS: Record<string, string> = {
  claude: '#C05621', // laranja queimado (Anthropic)
  codex: '#10A37F',  // verde OpenAI
  gemini: '#1A73E8', // azul Google
};

const CLI_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
};

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentMonthPrefix(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export default function CostAggregator() {
  const { t } = useTranslation();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);
  const [providersState] = useState(() => loadProviders());
  const providerProfiles = providersState.profiles;
  const activeProfile = useMemo(
    () => providerProfiles.find(p => p.id === providersState.activeId),
    [providerProfiles, providersState.activeId],
  );
  const budget = activeProfile?.dailyBudget ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await invoke<UsageReport>('read_usage_stats');
      setReport(r);
    } catch (e) {
      setError(typeof e === 'string' ? e : JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Agregações derivadas (client-side) ----
  const today = todayISO();
  const monthPrefix = currentMonthPrefix();

  const tokensInToday = useMemo(() => {
    if (!report) return 0;
    return report.entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.tokens_in, 0);
  }, [report, today]);

  const tokensOutMonth = useMemo(() => {
    if (!report) return 0;
    return report.entries
      .filter((e) => e.date.startsWith(monthPrefix))
      .reduce((sum, e) => sum + e.tokens_out, 0);
  }, [report, monthPrefix]);

  const totalToday = useMemo(() => {
    if (!report) return 0;
    return report.entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.cost_estimate_usd, 0);
  }, [report, today]);

  // Últimos 7 dias por CLI (array de custo diário, mais antigo -> mais recente).
  // Deriva de report.entries porque o backend não expõe série temporal direta.
  const last7DaysByCli = useMemo<Record<string, number[]>>(() => {
    if (!report) return {};
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    const acc: Record<string, number[]> = {};
    for (const cli of Object.keys(report.by_cli)) {
      acc[cli] = days.map(() => 0);
    }
    for (const e of report.entries) {
      const idx = days.indexOf(e.date);
      if (idx < 0) continue;
      if (!acc[e.cli]) acc[e.cli] = days.map(() => 0);
      acc[e.cli][idx] += e.cost_estimate_usd;
    }
    return acc;
  }, [report]);

  const maxCliCost = useMemo(() => {
    if (!report) return 0;
    return Math.max(
      0,
      ...Object.values(report.by_cli).map((s) => s.cost_usd),
    );
  }, [report]);

  // ---- Reestima custos usando preços dos perfis Admin quando disponíveis ----
  // O backend tem tabela hardcoded que só conhece Claude/Codex/Gemini. Se você
  // rodou Claude via Z.AI (glm-*) ou MiniMax, o custo está incorreto. Aqui
  // ajustamos client-side pra refletir o preço do perfil cadastrado.
  const providerRestated = useMemo(() => {
    if (!report) return null;
    let adjustedTotal = 0;
    const byProvider: Record<string, { cost_usd: number; tokens: number; entries: number; label: string }> = {};
    for (const e of report.entries) {
      const matched = matchProviderForModel(e.model, providerProfiles);
      let cost = e.cost_estimate_usd;
      if (matched && matched.priceInPerM != null && matched.priceOutPerM != null) {
        cost = (e.tokens_in / 1_000_000) * matched.priceInPerM + (e.tokens_out / 1_000_000) * matched.priceOutPerM;
      }
      adjustedTotal += cost;
      const key = matched?.id || (e.model || e.cli);
      const label = matched?.name || (e.model ? `${e.cli} · ${e.model}` : e.cli);
      if (!byProvider[key]) byProvider[key] = { cost_usd: 0, tokens: 0, entries: 0, label };
      byProvider[key].cost_usd += cost;
      byProvider[key].tokens += e.tokens_in + e.tokens_out;
      byProvider[key].entries += 1;
    }
    return {
      adjustedTotal: Number(adjustedTotal.toFixed(4)),
      byProvider,
    };
  }, [report, providerProfiles]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="cost-root">
        <div className="cost-loading">{t('costs.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cost-root">
        <div className="cost-error">
          <strong>{t('costs.errorTitle')}</strong>
          <pre>{error}</pre>
          <button className="cost-btn" onClick={load}>
            {t('common.refresh')}
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const hasData = report.entries.length > 0;
  const cliKeys = Object.keys(report.by_cli);

  return (
    <div className="cost-root">
      <div className="cost-header">
        <div>
          <h2 className="cost-title">{t('costs.header.title')}</h2>
          <p className="cost-sub">{t('costs.header.sub')}</p>
        </div>
        <button className="cost-btn" onClick={load}>
          {t('common.refresh')}
        </button>
      </div>

      {!hasData && (
        <div className="cost-empty">
          <p>{t('costs.empty.body')}</p>
          <ul className="cost-empty-list">
            <li>
              <code>~/.claude/usage.jsonl</code>
            </li>
            <li>
              <code>~/.codex/usage.jsonl</code>
            </li>
            <li>
              <code>~/.gemini/telemetry/</code>
            </li>
          </ul>
        </div>
      )}

      {hasData && (
        <>
          {/* ===== Hero: total hoje + barra de orçamento ===== */}
          <section className="costs-hero">
            <h1 className="costs-hero__value">$ {totalToday.toFixed(2)}</h1>
            <span className="costs-hero__label">{t('costs.hero.totalToday')}</span>
            {budget > 0 && (
              <div className="costs-budget">
                <div className="costs-budget__track">
                  <div
                    className="costs-budget__fill"
                    style={{ width: `${Math.min((totalToday / budget) * 100, 100)}%` }}
                  />
                </div>
                <span className="costs-budget__label">
                  ${totalToday.toFixed(2)} / ${budget.toFixed(2)} {t('costs.dailyLabel')}
                </span>
              </div>
            )}
          </section>

          {/* ===== Cards de resumo ===== */}
          <div className="cost-cards">
            <div className="cost-card">
              <div className="cost-card-label">{t('costs.tokensInToday')}</div>
              <div className="cost-card-value">{formatTokens(tokensInToday)}</div>
              <div className="cost-card-hint">{today}</div>
            </div>
            <div className="cost-card">
              <div className="cost-card-label">{t('costs.tokensOutMonth')}</div>
              <div className="cost-card-value">{formatTokens(tokensOutMonth)}</div>
              <div className="cost-card-hint">{monthPrefix}</div>
            </div>
            <div className="cost-card cost-card-highlight">
              <div className="cost-card-label">{t('costs.totalCost')}</div>
              <div className="cost-card-value">
                {formatUsd(report.total_cost_usd)}
              </div>
              <div className="cost-card-hint">
                {formatTokens(report.total_tokens_in)} in ·{' '}
                {formatTokens(report.total_tokens_out)} out
              </div>
            </div>
          </div>

          {/* ===== Por CLI (barras horizontais) ===== */}
          <section className="cost-section">
            <h3 className="cost-section-title">{t('costs.byCli')}</h3>
            <div className="cost-bars">
              {cliKeys.map((k) => {
                const s = report.by_cli[k];
                const pct = maxCliCost > 0 ? (s.cost_usd / maxCliCost) * 100 : 0;
                const color = CLI_COLORS[k] || '#8B1E2A';
                return (
                  <div className="cost-bar-row" key={k}>
                    <div className="cost-bar-label">
                      <span
                        className="cost-bar-dot"
                        style={{ background: color }}
                      />
                      {CLI_LABELS[k] || k}
                    </div>
                    <div className="cost-bar-track">
                      <div
                        className="cost-bar-fill"
                        style={{
                          width: `${Math.max(2, pct)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <div className="cost-bar-value">
                      <strong>{formatUsd(s.cost_usd)}</strong>
                      <span className="cost-bar-meta">
                        {s.entries} req · {formatTokens(s.tokens_in + s.tokens_out)} tok
                      </span>
                    </div>
                    {last7DaysByCli[k] && last7DaysByCli[k].length > 0 && (
                      <span className="costs-sparkline" aria-hidden="true">
                        <Sparkline points={last7DaysByCli[k]} stroke="var(--text-prompt)" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== Por Provider (Admin-aware) ===== */}
          {providerRestated && Object.keys(providerRestated.byProvider).length > 1 && (
            <section className="cost-section">
              <h3 className="cost-section-title">
                {t('costs.providerSection.title')}
              </h3>
              <p className="cost-sub" style={{ marginTop: 0 }}>
                {t('costs.providerSection.totalAdjusted')} <strong>{formatUsd(providerRestated.adjustedTotal)}</strong>
                {Math.abs(providerRestated.adjustedTotal - report.total_cost_usd) > 0.005 && (
                  <span style={{ marginLeft: 8, opacity: 0.7 }}>
                    {t('costs.providerSection.backendCompare', { total: formatUsd(report.total_cost_usd) })}
                  </span>
                )}
              </p>
              <ul className="cost-projects">
                {Object.entries(providerRestated.byProvider)
                  .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                  .map(([key, v]) => (
                    <li className="cost-project" key={key}>
                      <div className="cost-project-path" title={v.label}>{v.label}</div>
                      <div className="cost-project-stats">
                        <strong>{formatUsd(v.cost_usd)}</strong>
                        <span className="cost-project-tokens">
                          {v.entries} req · {formatTokens(v.tokens)} tokens
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/* ===== Top projetos ===== */}
          {report.top_projects.length > 0 && (
            <section className="cost-section">
              <h3 className="cost-section-title">{t('costs.topProjects')}</h3>
              <ul className="cost-projects">
                {report.top_projects.map((p) => (
                  <li className="cost-project" key={p.project}>
                    <div className="cost-project-path" title={p.project}>
                      {p.project}
                    </div>
                    <div className="cost-project-stats">
                      <strong>{formatUsd(p.cost_usd)}</strong>
                      <span className="cost-project-tokens">
                        {formatTokens(p.tokens)} tokens
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ===== Warnings ===== */}
      {report.warnings.length > 0 && (
        <section className="cost-section cost-warnings">
          <button
            className="cost-warnings-toggle"
            onClick={() => setShowWarnings((v) => !v)}
          >
            {showWarnings ? '▼' : '▶'} {t('costs.warnings', { n: report.warnings.length })}
          </button>
          {showWarnings && (
            <ul className="cost-warnings-list">
              {report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ===== Rodapé ===== */}
      <footer className="cost-footer">
        {t('costs.footer')}
      </footer>
    </div>
  );
}
