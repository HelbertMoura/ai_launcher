import { useTranslation } from "react-i18next";
import { PrereqCard } from "./PrereqCard";
import { usePrerequisites } from "./usePrerequisites";
import "./PrereqsPage.css";

export function PrereqsPage() {
  const { t } = useTranslation();
  const { items, loading, error, refresh } = usePrerequisites();

  const installed = items.filter((i) => i.installed).length;

  return (
    <section className="cd-prereqs">
      <header className="cd-prereqs__head">
        <div>
          <h1 className="cd-prereqs__title">{t("prereqs.title")}</h1>
          <p className="cd-prereqs__sub">
            {t("prereqs.subtitle")}
          </p>
        </div>
        <div className="cd-prereqs__actions">
          <span className="cd-prereqs__count">
            {installed}/{items.length} {t("prereqs.installed")}
          </span>
          <button type="button" className="cd-prereqs__refresh" onClick={() => void refresh()}>
            {t("common.refresh")}
          </button>
        </div>
      </header>

      {loading && <div className="cd-prereqs__loading">{t("common.loading")}</div>}
      {error && <div className="cd-prereqs__error">{error}</div>}

      <div className="cd-prereqs__grid">
        {items.map((item) => (
          <PrereqCard key={item.name} item={item} />
        ))}
      </div>
    </section>
  );
}
