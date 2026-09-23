import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usageStore, useUsageEntries } from "../costs/usageStore";
import { getAllBudgetUsage, type BudgetUsage } from "../../providers/budget";
import type { TabNavigator } from "../../app/layout/TabId";
import { BentoCard } from "./BentoCard";

export function BudgetSummaryCard({ onNavigate }: { onNavigate?: TabNavigator }) {
  const { t } = useTranslation();
  const entries = useUsageEntries();
  const usages = useMemo<BudgetUsage[]>(() => getAllBudgetUsage(entries), [entries]);

  // Preserve the pre-store mount fetch: opening the workspace tab refreshes
  // the shared report (deduped by the store's in-flight guard).
  useEffect(() => {
    void usageStore.refresh();
  }, []);

  const totalUsed = usages.reduce((s, u) => s + u.usedUsd, 0);
  const totalLimit = usages.reduce((s, u) => s + u.limitUsd, 0);
  const exceeded = usages.filter((u) => u.status === "exceeded").length;

  const meta = usages.length > 0
    ? `$${totalUsed.toFixed(2)} / $${totalLimit.toFixed(2)}`
    : t("workspace.noBudgetLimits");

  const handleActivate = onNavigate ? () => onNavigate("costs") : undefined;

  return (
    <BentoCard area="budget" title={t("workspace.budgetTitle")} meta={meta} onActivate={handleActivate}>
      {usages.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__budget-list">
          {usages.slice(0, 4).map((u) => {
            const pct = Math.min(u.percentUsed, 100);
            const statusClass = `cd-ws-bento__budget--${u.status}`;
            return (
              <li key={u.providerKey} className={`cd-ws-bento__budget-item ${statusClass}`}>
                <div className="cd-ws-bento__budget-row">
                  <span className="cd-ws-bento__budget-name">{u.providerKey}</span>
                  <span className="cd-ws-bento__budget-val">
                    ${u.usedUsd.toFixed(2)} / ${u.limitUsd.toFixed(2)}
                  </span>
                </div>
                <div className="cd-ws-bento__budget-track">
                  <div
                    className="cd-ws-bento__budget-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          {exceeded > 0 && (
            <li className="cd-ws-bento__budget-alert">
              {t("workspace.overLimit", { count: exceeded })}
            </li>
          )}
        </ul>
      )}
    </BentoCard>
  );
}
