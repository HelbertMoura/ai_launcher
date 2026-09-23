import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { Card } from "../../ui/Card";
import { EmptyState, ART_CHART } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { usageStore, useUsageStore } from "./usageStore";
import { toCsv, downloadBlob } from "../../lib/exportData";
import { BudgetDashboard } from "./BudgetDashboard";
import { AreaChart } from "../../ui/charts/AreaChart";
import { BarList } from "../../ui/charts/BarList";
import { buildCostsOverview, byModel, byProjectResolved, dailySeries, trend } from "./analytics";
import { budgetEta, dailyBurn, FORECAST_WINDOW_DAYS, projectMonthEnd } from "./forecast";
import { getAllBudgetUsage, type BudgetUsage } from "../../providers/budget";
import { loadWorkspaces } from "../workspace/workspaceStore";
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

/** Last day of `today`'s month (ISO date) — period end for calendar-month budgets (D1). */
function endOfMonthISO(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  return `${today.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Short local date ("12 out" / "Oct 12") — the app's toLocale* date pattern. */
function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const RANGES: Array<{ days: number; label: string }> = [
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export function CostsPage() {
  const { t } = useTranslation();
  const { report, loading, error } = useUsageStore();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const entries = report?.entries ?? [];

  // Revalidate on page open (design §5b): one shared refresh, deduped by the
  // store's in-flight guard. Never blocking: the cached report stays visible.
  useEffect(() => {
    void usageStore.refresh();
  }, []);

  // Workspaces drive project reconciliation (D5); re-read alongside usage so
  // freshly edited profiles apply on the next refresh without extra I/O.
  const workspaces = useMemo(() => loadWorkspaces(), [report]);

  const overview = useMemo(() => {
    return buildCostsOverview(entries, rangeDays, todayISO());
  }, [entries, rangeDays]);

  const analytics = useMemo(() => {
    return {
      series: dailySeries(entries, rangeDays),
      models: byModel(entries, rangeDays),
      trend30: trend(entries, rangeDays),
    };
  }, [entries, rangeDays]);

  // Month projection card (D2/D3) + burn rates + earliest budget overflow ETA.
  const forecast = useMemo(() => {
    const today = todayISO();
    const projection = projectMonthEnd(entries, FORECAST_WINDOW_DAYS, today);
    const burn14 = dailyBurn(entries, FORECAST_WINDOW_DAYS, today);
    let eta: string | null = null;
    for (const u of getAllBudgetUsage(entries, workspaces)) {
      const candidate = budgetEta({
        limitSpent: u.usedUsd,
        limitUsd: u.limitUsd,
        dailyBurn: burn14,
        today,
        // Calendar-month quotas overflow inside the month (D1); rolling
        // provider windows are open-ended for this estimate.
        periodEnd: u.periodKind === "calendar-month" ? endOfMonthISO(today) : undefined,
      });
      if (candidate && (eta === null || candidate < eta)) eta = candidate;
    }
    return { projection, burn7: dailyBurn(entries, 7, today), burn14, eta };
  }, [entries, workspaces]);

  // Canonical project ranking (gate condition 5) joined with project budgets.
  const projectRanking = useMemo(() => {
    const budgetByKey = new Map<string, BudgetUsage>();
    for (const u of getAllBudgetUsage(entries, workspaces)) {
      if (u.scope.kind === "project") budgetByKey.set(u.scope.projectKey, u);
    }
    return byProjectResolved(entries, workspaces, rangeDays, 8).map((row) => ({
      ...row,
      budget: row.key ? budgetByKey.get(row.key) : undefined,
    }));
  }, [entries, workspaces, rangeDays]);

  const trendLabel = useMemo(() => {
    const { deltaPct } = analytics.trend30;
    if (deltaPct === null) return t("costs.trendNew");
    const signed = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`;
    return t("costs.trendVsPrev", { delta: signed });
  }, [analytics.trend30, t]);

  const hasData = entries.length > 0;

  const handleRefresh = (): void => {
    // Manual refresh (P3 from the 3b audit): force-bypasses the backend cache.
    void usageStore.refresh(true);
  };

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
        <div className="cd-costs__head-actions">
          {hasData && (
            <div className="cd-costs__range-selector" role="group" aria-label={t("costs.rangeLabel")}>
              {RANGES.map((r) => (
                <button
                  key={r.days}
                  type="button"
                  className={`cd-costs__range-btn${rangeDays === r.days ? " cd-costs__range-btn--active" : ""}`}
                  onClick={() => setRangeDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="cd-costs__refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? t("costs.refreshBusy") : t("costs.refresh")}
          </button>
        </div>
      </header>

      {error && <Banner variant="err">{error}</Banner>}

      {loading && !report && (
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

      {hasData && (
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
            <div className="cd-costs__forecast">
              <div className="cd-costs__forecast-label">{t("costs.forecastTitle")}</div>
              {forecast.projection.dataSufficient ? (
                <>
                  <div className="cd-costs__forecast-grid">
                    <div>
                      <span>{t("costs.forecastMtd")}</span>
                      <strong>{formatUsd(forecast.projection.monthToDate)}</strong>
                    </div>
                    <div>
                      <span>{t("costs.forecastProjected")}</span>
                      <strong>{formatUsd(forecast.projection.projected)}</strong>
                    </div>
                    <div>
                      <span>{t("costs.forecastBurn7")}</span>
                      <strong>{formatUsd(forecast.burn7)}</strong>
                    </div>
                    <div>
                      <span>{t("costs.forecastBurn14")}</span>
                      <strong>{formatUsd(forecast.burn14)}</strong>
                    </div>
                  </div>
                  {forecast.eta && (
                    <span className="cd-costs__forecast-eta">
                      {t("costs.forecastEta", { date: formatShortDate(forecast.eta) })}
                    </span>
                  )}
                  <span className="cd-costs__forecast-note">{t("costs.forecastPeriodNote")}</span>
                </>
              ) : (
                <>
                  <div className="cd-costs__forecast-grid">
                    <div>
                      <span>{t("costs.forecastMtd")}</span>
                      <strong>{formatUsd(forecast.projection.monthToDate)}</strong>
                    </div>
                  </div>
                  <span className="cd-costs__forecast-insufficient">
                    {t("costs.forecastInsufficient")}
                  </span>
                  <span className="cd-costs__forecast-note">
                    {t("costs.forecastInsufficientHint")}
                  </span>
                </>
              )}
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
              <ul className="cd-barlist" aria-label={t("costs.topProjects")}>
                {projectRanking.map((row) => {
                  const clamped = row.budget
                    ? Math.min(100, row.budget.percentUsed)
                    : 0;
                  return (
                    <li
                      key={row.key ?? "__other"}
                      className={`cd-barlist__row${row.budget ? " cd-costs__projrow" : ""}`}
                    >
                      <span
                        className="cd-barlist__label"
                        title={
                          row.key && row.sources.length > 1
                            ? t("costs.projectSources", { labels: row.sources.join(", ") })
                            : undefined
                        }
                      >
                        {row.label ?? t("costs.otherBucket")}
                      </span>
                      <span className="cd-barlist__track" aria-hidden="true">
                        <span
                          className="cd-barlist__bar"
                          style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }}
                        />
                      </span>
                      <span className="cd-barlist__value">{formatUsd(row.costUsd)}</span>
                      {row.budget && (
                        <span
                          className={`cd-costs__proj-budget cd-costs__proj-budget--${row.budget.status}`}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(clamped)}
                          aria-label={t("costs.budget.barLabel", {
                            name: row.label ?? row.key,
                            value: row.budget.percentUsed.toFixed(0),
                          })}
                        >
                          <span
                            className="cd-costs__proj-budget-fill"
                            style={{ width: `${clamped}%` }}
                            aria-hidden="true"
                          />
                          <span className="cd-costs__proj-budget-pct" aria-hidden="true">
                            {row.budget.percentUsed.toFixed(0)}%
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
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
