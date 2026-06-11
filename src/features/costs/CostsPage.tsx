import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { Card } from "../../ui/Card";
import { EmptyState, ART_CHART } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { useUsage, type UsageEntry } from "./useUsage";
import { toCsv, downloadBlob } from "../../lib/exportData";
import { BudgetDashboard } from "./BudgetDashboard";
import { AreaChart } from "../../ui/charts/AreaChart";
import { BarList } from "../../ui/charts/BarList";
import { byModel, byProject, dailySeries, trend } from "./analytics";
import "../page.css";
import "./CostsPage.css";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

interface CliRollup {
  cli: string;
  today: number;
  month: number;
  entries: number;
}

function rollup(entries: UsageEntry[]): CliRollup[] {
  const today = todayISO();
  const month = monthISO();
  const acc = new Map<string, CliRollup>();
  for (const e of entries) {
    const cur = acc.get(e.cli) ?? { cli: e.cli, today: 0, month: 0, entries: 0 };
    if (e.date === today) cur.today += e.cost_estimate_usd;
    if (e.date.startsWith(month)) cur.month += e.cost_estimate_usd;
    cur.entries += 1;
    acc.set(e.cli, cur);
  }
  return [...acc.values()].sort((a, b) => b.month - a.month);
}

export function CostsPage() {
  const { t } = useTranslation();
  const { report, loading, error } = useUsage();

  const { todayTotal, cliRollups } = useMemo(() => {
    const entries = report?.entries ?? [];
    const today = todayISO();
    const todayTotal = entries
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.cost_estimate_usd, 0);
    return { todayTotal, cliRollups: rollup(entries) };
  }, [report]);

  const analytics = useMemo(() => {
    const entries = report?.entries ?? [];
    return {
      series: dailySeries(entries, 30),
      projects: byProject(entries, 30, 8),
      models: byModel(entries, 30),
      trend30: trend(entries, 30),
    };
  }, [report]);

  const trendLabel = useMemo(() => {
    const { deltaPct } = analytics.trend30;
    if (deltaPct === null) return t("costs.trendNew");
    const signed = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`;
    return t("costs.trendVsPrev", { delta: signed });
  }, [analytics.trend30, t]);

  const tokens30d = useMemo(
    () => analytics.series.reduce((s, p) => s + p.tokensIn + p.tokensOut, 0),
    [analytics.series],
  );

  const hasData = (report?.entries.length ?? 0) > 0;
  const entries = report?.entries ?? [];

  const handleExportCsv = (): void => {
    const csv = toCsv(entries as unknown as Record<string, unknown>[]);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `ai-launcher-usage-${date}.csv`, "text/csv");
  };

  const handleExportJson = (): void => {
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      JSON.stringify(entries, null, 2),
      `ai-launcher-usage-${date}.json`,
      "application/json",
    );
  };

  return (
    <section className="cd-page cd-costs">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("costs.title")}</h2>
          <p className="cd-page__sub">{t("costs.subtitle")}</p>
        </div>
      </header>

      {error && <Banner variant="err">{error}</Banner>}

      {loading && (
        <div className="cd-costs__loading">
          <Skeleton variant="card" height={120} />
          <div className="cd-page__grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="card" height={80} />
            ))}
          </div>
        </div>
      )}

      {!loading && !hasData && (
        <EmptyState
          art={ART_CHART}
          title={t("costs.emptyTitle", "No spend tracked yet")}
          description={t(
            "costs.emptyHint",
            "Run a session with a provider to see costs.",
          )}
        />
      )}

      {!loading && hasData && (
        <>
          <Card className="cd-costs__hero">
            <div className="cd-costs__hero-label">{t("costs.today")}</div>
            <div className="cd-costs__hero-amount">{formatUsd(todayTotal)}</div>
            <div className="cd-costs__hero-sub">
              {t("costs.entriesTracked", { count: report?.entries.length ?? 0 })}
            </div>
            <div className="cd-costs__export">
              <button
                type="button"
                className="cd-costs__export-btn"
                onClick={handleExportCsv}
                disabled={entries.length === 0}
              >
                {t("costs.exportCsv")}
              </button>
              <button
                type="button"
                className="cd-costs__export-btn"
                onClick={handleExportJson}
                disabled={entries.length === 0}
              >
                {t("costs.exportJson")}
              </button>
            </div>
          </Card>

          <div className="cd-page__grid cd-costs__analytics-cards">
            <Card className="cd-costs__stat">
              <div className="cd-costs__stat-label">{t("costs.cost30d")}</div>
              <div className="cd-costs__stat-value">{formatUsd(analytics.trend30.currentUsd)}</div>
              <div className="cd-costs__stat-sub">{trendLabel}</div>
            </Card>
            <Card className="cd-costs__stat">
              <div className="cd-costs__stat-label">{t("costs.tokens30d")}</div>
              <div className="cd-costs__stat-value">{tokens30d.toLocaleString()}</div>
            </Card>
          </div>

          <Card className="cd-costs__chart-card">
            <h3 className="cd-costs__section">{t("costs.seriesTitle")}</h3>
            <AreaChart
              data={analytics.series.map((p) => ({ label: p.date.slice(5), value: p.costUsd }))}
              ariaLabel={t("costs.seriesTitle")}
              formatValue={formatUsd}
            />
          </Card>

          <div className="cd-page__grid cd-costs__rankings">
            <Card>
              <h3 className="cd-costs__section">{t("costs.topProjects")}</h3>
              <BarList
                items={analytics.projects.map((r) => ({ label: r.label, value: r.costUsd, share: r.share }))}
                ariaLabel={t("costs.topProjects")}
                formatValue={formatUsd}
                fallbackLabel={t("costs.otherBucket")}
              />
            </Card>
            <Card>
              <h3 className="cd-costs__section">{t("costs.byModelTitle")}</h3>
              <BarList
                items={analytics.models.map((r) => ({ label: r.label, value: r.costUsd, share: r.share }))}
                ariaLabel={t("costs.byModelTitle")}
                formatValue={formatUsd}
                fallbackLabel={t("costs.otherBucket")}
              />
            </Card>
          </div>

          {cliRollups.length > 0 && (
            <>
              <h3 className="cd-costs__section">{t("costs.byCli")}</h3>
              <div className="cd-page__grid">
                {cliRollups.map((r) => (
                  <Card key={r.cli} className="cd-costs__cli">
                    <div className="cd-costs__cli-name">{r.cli}</div>
                    <div className="cd-costs__cli-row">
                      <span className="cd-costs__cli-label">{t("costs.today")}</span>
                      <span className="cd-costs__cli-val">{formatUsd(r.today)}</span>
                    </div>
                    <div className="cd-costs__cli-row">
                      <span className="cd-costs__cli-label">{t("costs.month")}</span>
                      <span className="cd-costs__cli-val">{formatUsd(r.month)}</span>
                    </div>
                    <div className="cd-costs__cli-entries">
                      {t("costs.entriesTracked", { count: r.entries })}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <BudgetDashboard />
        </>
      )}
    </section>
  );
}
