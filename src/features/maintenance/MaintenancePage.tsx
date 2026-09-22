import { useTranslation } from "react-i18next";
import {
  MAINTENANCE_SECTIONS,
  MAINTENANCE_SECTION_I18N_KEYS,
  type MaintenanceSection,
} from "../../app/layout/TabId";
import { DoctorPage } from "../workspace/DoctorPage";
import { PrereqsPage } from "../prereqs/PrereqsPage";
import { UpdatesPage } from "../updates/UpdatesPage";
import "../page.css";
import "./MaintenancePage.css";

interface MaintenancePageProps {
  section: MaintenanceSection;
  onSectionChange: (section: MaintenanceSection) => void;
}

/**
 * Fused maintenance surface (v23): the former Doctor, Prereqs and Updates tabs
 * became internal sections. The original page components are reused untouched
 * (embedded mode) — only the navigation around them changed.
 */
export function MaintenancePage({ section, onSectionChange }: MaintenancePageProps) {
  const { t } = useTranslation();

  const moveSelection = (offset: number) => {
    const index = MAINTENANCE_SECTIONS.indexOf(section);
    const next = MAINTENANCE_SECTIONS[(index + offset + MAINTENANCE_SECTIONS.length) % MAINTENANCE_SECTIONS.length];
    onSectionChange(next);
  };

  return (
    <section className="cd-page cd-maint">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("maintenance.title")}</h1>
          <p className="cd-page__sub">{t("maintenance.subtitle")}</p>
        </div>
      </header>

      <div
        role="tablist"
        aria-label={t("maintenance.sectionsLabel")}
        className="cd-maint__tabs"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            moveSelection(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            moveSelection(-1);
          }
        }}
      >
        {MAINTENANCE_SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`cd-maint-tab-${s}`}
            aria-selected={s === section}
            aria-controls={`cd-maint-panel-${s}`}
            tabIndex={s === section ? 0 : -1}
            className={`cd-maint__tab${s === section ? " cd-maint__tab--on" : ""}`}
            onClick={() => onSectionChange(s)}
          >
            {t(MAINTENANCE_SECTION_I18N_KEYS[s])}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`cd-maint-panel-${section}`}
        aria-labelledby={`cd-maint-tab-${section}`}
        className="cd-maint__panel"
      >
        {section === "diagnostics" && <DoctorPage embedded />}
        {section === "verifications" && <PrereqsPage embedded />}
        {section === "updates" && <UpdatesPage embedded />}
      </div>
    </section>
  );
}
