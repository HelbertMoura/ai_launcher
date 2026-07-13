import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { Button } from "../../ui/Button";
import { PrereqCard } from "./PrereqCard";
import { usePrerequisites } from "./usePrerequisites";
import { buildPrereqsPageSummary } from "./prereqsPageModel";
import "../page.css";
import "./PrereqsPage.css";

export function PrereqsPage() {
  const { t } = useTranslation();
  const { items, loading, error, refresh } = usePrerequisites();

  const summary = useMemo(() => buildPrereqsPageSummary(items), [items]);

  return (
    <section className="cd-page cd-prereqs">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("prereqs.title")}</h1>
          <p className="cd-page__sub">
            {t("prereqs.subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading}
        >
          ⟳ {t("common.refresh")}
        </Button>
      </header>

      {loading && <div className="cd-prereqs__loading">{t("common.loading")}</div>}
      {error && <div className="cd-prereqs__error">{error}</div>}

      {!loading && !error && (
        <section className="cd-prereqs__overview" aria-label={t("prereqs.overviewLabel")}>
          <div className="cd-prereqs__score">
            <strong>{summary.readinessPct}%</strong>
            <span>{t("prereqs.ready")}</span>
          </div>
          <div className="cd-prereqs__metrics">
            <span>{t("prereqs.installedCount", { installed: summary.installed, total: summary.total })}</span>
            <span>{t("prereqs.missingCount", { count: summary.missing })}</span>
            <span>{t("prereqs.requiredMissing", { count: summary.requiredMissing })}</span>
          </div>
        </section>
      )}

      <div className="cd-prereqs__grid">
        {items.map((item) => (
          <PrereqCard key={item.key} item={item} onInstalled={() => void refresh()} />
        ))}
      </div>
    </section>
  );
}
