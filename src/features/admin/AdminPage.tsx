import { useState } from "react";
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

const SECTIONS: Array<{ id: AdminSection; label: string }> = [
  { id: "providers", label: "Providers" },
  { id: "presets", label: "Presets" },
  { id: "appearance", label: "Appearance" },
  { id: "overrides", label: "CLI Overrides" },
  { id: "custom-ides", label: "Custom IDEs" },
];

export function AdminPage() {
  const [active, setActive] = useState<AdminSection>("providers");

  return (
    <section className="cd-page cd-admin">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ ADMIN</h2>
          <p className="cd-page__sub">
            Full access — handle credentials with care.
          </p>
        </div>
      </header>

      <nav className="cd-admin__nav" aria-label="Admin sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={s.id === active ? "page" : undefined}
            className={`cd-admin__tab${s.id === active ? " is-on" : ""}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
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
