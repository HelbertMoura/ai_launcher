import { useTranslation } from "react-i18next";
import { getRunbooks } from "./runbookStore";
import { BentoCard } from "./BentoCard";

export function RunbooksCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const runbooks = getRunbooks();

  const meta = t("workspace.totalMeta", { count: runbooks.length });

  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={onOpen}>
      {t("runbook.manage")}
    </button>
  );

  return (
    <BentoCard
      area="runbooks"
      title={t("workspace.runbooksTitle")}
      meta={meta}
      footer={footer}
    >
      {runbooks.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__runbook-list">
          {runbooks.slice(0, 5).map((rb) => (
            <li key={rb.id} className="cd-ws-bento__runbook-item">
              <span className="cd-ws-bento__runbook-name">{rb.name}</span>
              <span className="cd-ws-bento__runbook-steps">
                {t("runbook.stepsCount", { count: rb.steps.length })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
