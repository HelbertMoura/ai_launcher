import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { Card } from "../../ui/Card";
import { Skeleton } from "../../ui/Skeleton";
import { useUsage, type UsageEntry } from "./useUsage";
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

  const hasData = (report?.entries.length ?? 0) > 0;

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
        <div className="cd-page__empty">{t("costs.noData")}</div>
      )}

      {!loading && hasData && (
        <>
          <Card className="cd-costs__hero">
            <div className="cd-costs__hero-label">{t("costs.today")}</div>
            <div className="cd-costs__hero-amount">{formatUsd(todayTotal)}</div>
            <div className="cd-costs__hero-sub">
              {t("costs.entriesTracked", { count: report?.entries.length ?? 0 })}
            </div>
          </Card>

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
        </>
      )}
    </section>
  );
}
