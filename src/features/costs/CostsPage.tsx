import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { Card } from "../../ui/Card";
import { EmptyState, ART_CHART } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { useUsage } from "./useUsage";
import { toCsv, downloadBlob } from "../../lib/exportData";
import { BudgetDashboard } from "./BudgetDashboard";
import { AreaChart } from "../../ui/charts/AreaChart";
import { BarList } from "../../ui/charts/BarList";
import { buildCostsOverview, byModel, byProject, dailySeries, trend } from "./analytics";
import "../page.css";
import "./CostsPage.css";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function CostsPage() {
  const { t } = useTranslation();
  const { report, loading, error } = useUsage();

  const overview = useMemo(() => {
    const entries = report?.entries ?? [];
    return buildCostsOverview(entries, 30, todayISO());
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
          <h1 className="cd-page__title">▎ {t("costs.title")}</h1>
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
          <section className="cd-costs__overview" aria-label={t("costs.overviewLabel")}>
            <div className="cd-costs__hero">
              <div className="cd-costs__hero-label">{t("costs.todaySpend")}</div>
              <div className="cd-costs__hero-amount">{formatUsd(overview.todayUsd)}</div>
              <div className="cd-costs__hero-sub">
                {t("costs.monthSpend", { value: formatUsd(overview.monthUsd) })}
              </div>
            </div>
            <div className="cd-costs__posture">
              <div>
                <span className="cd-costs__posture-label">{t("costs.cost30d")}</span>
                <strong>{formatUsd(analytics.trend30.currentUsd)}</strong>
                <span>{trendLabel}</span>
              </div>
              <div>
                <span className="cd-costs__posture-label">{t("costs.tokens30d")}</span>
                <strong>{overview.tokens30d.toLocaleString()}</strong>
                <span>{t("costs.averageDaily", { value: formatUsd(overview.averageDailyUsd) })}</span>
              </div>
              <div>
                <span className="cd-costs__posture-label">{t("costs.sources")}</span>
                <strong>{overview.cliCount}</strong>
                <span>{t("costs.entriesTracked", { count: overview.entries })}</span>
              </div>
            </div>
            <div className="cd-costs__export" aria-label={t("costs.exportLabel")}>
              <button type="button" className="cd-costs__export-btn" onClick={handleExportCsv}>
                {t("costs.exportCsv")}
              </button>
              <button type="button" className="cd-costs__export-btn" onClick={handleExportJson}>
                {t("costs.exportJson")}
              </button>
            </div>
          </section>

          <Card className="cd-costs__chart-card">
            <h2 className="cd-costs__section">{t("costs.seriesTitle")}</h2>
            <AreaChart
              data={analytics.series.map((p) => ({ label: p.date.slice(5), value: p.costUsd }))}
              ariaLabel={t("costs.seriesTitle")}
              formatValue={formatUsd}
            />
          </Card>

          <div className="cd-page__grid cd-costs__rankings">
            <Card>
              <h2 className="cd-costs__section">{t("costs.topProjects")}</h2>
              <BarList
                items={analytics.projects.map((r) => ({ label: r.label, value: r.costUsd, share: r.share }))}
                ariaLabel={t("costs.topProjects")}
                formatValue={formatUsd}
                fallbackLabel={t("costs.otherBucket")}
              />
            </Card>
            <Card>
              <h2 className="cd-costs__section">{t("costs.byModelTitle")}</h2>
              <BarList
                items={analytics.models.map((r) => ({ label: r.label, value: r.costUsd, share: r.share }))}
                ariaLabel={t("costs.byModelTitle")}
                formatValue={formatUsd}
                fallbackLabel={t("costs.otherBucket")}
              />
            </Card>
          </div>

          {overview.cliRollups.length > 0 && (
            <>
              <h2 className="cd-costs__section">{t("costs.byCli")}</h2>
              <div className="cd-costs__cli-grid">
                {overview.cliRollups.map((r) => (
                  <Card key={r.cli} className="cd-costs__cli">
                    <div className="cd-costs__cli-name">{r.cli}</div>
                    <div className="cd-costs__cli-row">
                      <span className="cd-costs__cli-label">{t("costs.today")}</span>
                      <span className="cd-costs__cli-val">{formatUsd(r.todayUsd)}</span>
                    </div>
                    <div className="cd-costs__cli-row">
                      <span className="cd-costs__cli-label">{t("costs.month")}</span>
                      <span className="cd-costs__cli-val">{formatUsd(r.monthUsd)}</span>
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
