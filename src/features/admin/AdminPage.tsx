import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppearanceSection } from "./sections/AppearanceSection";
import { CliOverridesSection } from "./sections/CliOverridesSection";
import { CustomIdesSection } from "./sections/CustomIdesSection";
import { ConfigBackupSection } from "./sections/ConfigBackupSection";
import { PresetsSection } from "./sections/PresetsSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { SecuritySection } from "./sections/SecuritySection";
import "../page.css";
import "./AdminPage.css";

type AdminSection =
  | "providers"
  | "presets"
  | "appearance"
  | "overrides"
  | "custom-ides"
  | "backup"
  | "security";

const SECTION_GROUPS: Array<{
  id: string;
  i18n: string;
  sections: Array<{ id: AdminSection; i18n: string }>;
}> = [
  {
    id: "trust",
    i18n: "admin.groups.trust",
    sections: [
      { id: "providers", i18n: "admin.sections.providers" },
      { id: "security", i18n: "admin.sections.security" },
      { id: "backup", i18n: "admin.sections.backup" },
    ],
  },
  {
    id: "experience",
    i18n: "admin.groups.experience",
    sections: [
      { id: "presets", i18n: "admin.sections.presets" },
      { id: "appearance", i18n: "admin.sections.appearance" },
    ],
  },
  {
    id: "integrations",
    i18n: "admin.groups.integrations",
    sections: [
      { id: "overrides", i18n: "admin.sections.cliOverrides" },
      { id: "custom-ides", i18n: "admin.sections.customIdes" },
    ],
  },
];

export function AdminPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<AdminSection>("providers");

  return (
    <section className="cd-page cd-admin">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("admin.title")}</h1>
          <p className="cd-page__sub">{t("admin.subtitle")}</p>
        </div>
      </header>

      <div className="cd-admin__workspace">
        <nav className="cd-admin__nav" aria-label={t("admin.navigationLabel")}>
          {SECTION_GROUPS.map((group) => (
            <div key={group.id} className="cd-admin__nav-group">
              <span className="cd-admin__nav-label">{t(group.i18n)}</span>
              {group.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  aria-current={section.id === active ? "page" : undefined}
                  aria-controls="admin-active-panel"
                  className={`cd-admin__tab${section.id === active ? " is-on" : ""}`}
                  onClick={() => setActive(section.id)}
                >
                  <span aria-hidden>{section.id === active ? "●" : "○"}</span>
                  {t(section.i18n)}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div id="admin-active-panel" className="cd-admin__body">
          {active === "providers" && <ProvidersSection />}
          {active === "security" && <SecuritySection />}
          {active === "presets" && <PresetsSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "overrides" && <CliOverridesSection />}
          {active === "custom-ides" && <CustomIdesSection />}
          {active === "backup" && <ConfigBackupSection />}
        </div>
      </div>
    </section>
  );
}
