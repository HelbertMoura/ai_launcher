import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CostAggregator.css';

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
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);

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

  const maxCliCost = useMemo(() => {
    if (!report) return 0;
    return Math.max(
      0,
      ...Object.values(report.by_cli).map((s) => s.cost_usd),
    );
  }, [report]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="cost-root">
        <div className="cost-loading">Carregando dados de uso...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cost-root">
        <div className="cost-error">
          <strong>Erro ao ler estatísticas:</strong>
          <pre>{error}</pre>
          <button className="cost-btn" onClick={load}>
            Tentar novamente
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
          <h2 className="cost-title">💰 Custos & Uso dos CLIs</h2>
          <p className="cost-sub">
            Leitura local dos arquivos de uso do Claude Code, Codex e Gemini.
            Nada é enviado para fora da sua máquina.
          </p>
        </div>
        <button className="cost-btn" onClick={load}>
          ↻ Recarregar
        </button>
      </div>

      {!hasData && (
        <div className="cost-empty">
          <p>
            Nenhum dado de uso encontrado. Rode algum CLI (Claude / Codex /
            Gemini) primeiro para gerar os arquivos de telemetria local.
          </p>
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
          {/* ===== Cards de resumo ===== */}
          <div className="cost-cards">
            <div className="cost-card">
              <div className="cost-card-label">Tokens IN hoje</div>
              <div className="cost-card-value">{formatTokens(tokensInToday)}</div>
              <div className="cost-card-hint">{today}</div>
            </div>
            <div className="cost-card">
              <div className="cost-card-label">Tokens OUT no mês</div>
              <div className="cost-card-value">{formatTokens(tokensOutMonth)}</div>
              <div className="cost-card-hint">{monthPrefix}</div>
            </div>
            <div className="cost-card cost-card-highlight">
              <div className="cost-card-label">Custo estimado total</div>
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
            <h3 className="cost-section-title">Por CLI</h3>
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
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== Top projetos ===== */}
          {report.top_projects.length > 0 && (
            <section className="cost-section">
              <h3 className="cost-section-title">Top projetos (por custo)</h3>
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
            {showWarnings ? '▼' : '▶'} Avisos ({report.warnings.length})
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
        Estimativa baseada em tabela de preços hardcoded — não é cobrança
        oficial. Atualize <code>price_per_mtoken</code> em <code>main.rs</code>{' '}
        quando a tabela de preços dos provedores mudar.
      </footer>
    </div>
  );
}
