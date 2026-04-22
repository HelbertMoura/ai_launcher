import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppearanceSection } from "./sections/AppearanceSection";
import { CliOverridesSection } from "./sections/CliOverridesSection";
import { CustomIdesSection } from "./sections/CustomIdesSection";
import { PresetsSection } from "./sections/PresetsSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import "../page.css";
import "./AdminPage.css";

type AdminSection =
  | "providers"
  | "presets"
  | "appearance"
  | "overrides"
  | "custom-ides";

const SECTIONS: Array<{ id: AdminSection; i18n: string }> = [
  { id: "providers", i18n: "admin.sections.providers" },
  { id: "presets", i18n: "admin.sections.presets" },
  { id: "appearance", i18n: "admin.sections.appearance" },
  { id: "overrides", i18n: "admin.sections.cliOverrides" },
  { id: "custom-ides", i18n: "admin.sections.customIdes" },
];

export function AdminPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<AdminSection>("providers");

  return (
    <section className="cd-page cd-admin">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("admin.title")}</h2>
          <p className="cd-page__sub">{t("admin.subtitle")}</p>
        </div>
      </header>

      <nav className="cd-admin__nav" aria-label={t("admin.title")}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={s.id === active ? "page" : undefined}
            className={`cd-admin__tab${s.id === active ? " is-on" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {t(s.i18n)}
          </button>
        ))}
      </nav>

      <div className="cd-admin__body">
        {active === "providers" && <ProvidersSection />}
        {active === "presets" && <PresetsSection />}
        {active === "appearance" && <AppearanceSection />}
        {active === "overrides" && <CliOverridesSection />}
        {active === "custom-ides" && <CustomIdesSection />}
      </div>
    </section>
  );
}
