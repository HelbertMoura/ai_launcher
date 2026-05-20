import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { PrereqCard } from "./PrereqCard";
import { usePrerequisites } from "./usePrerequisites";
import "../page.css";
import "./PrereqsPage.css";

export function PrereqsPage() {
  const { t } = useTranslation();
  const { items, loading, error, refresh } = usePrerequisites();

  const installed = items.filter((i) => i.installed).length;

  return (
    <section className="cd-page cd-prereqs">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("prereqs.title")}</h2>
          <p className="cd-page__sub">
            {installed}/{items.length} {t("prereqs.installed")}
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

      <div className="cd-page__grid">
        {items.map((item) => (
          <PrereqCard key={item.key} item={item} onInstalled={() => void refresh()} />
        ))}
      </div>
    </section>
  );
}
