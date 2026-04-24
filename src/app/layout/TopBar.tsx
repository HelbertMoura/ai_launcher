import { useTranslation } from "react-i18next";
import { ACCENTS, type Accent } from "../../hooks/useAccent";
import type { Density } from "../../hooks/useDensity";
import type { Theme } from "../../hooks/useTheme";
import { getLocale, setLocale, type Locale } from "../../i18n";
import "./TopBar.css";

const CMD_KEY_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl+K";

interface TopBarProps {
  onCommand: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  accent: Accent;
  onAccent: (a: Accent) => void;
  density: Density;
  onToggleDensity: () => void;
}

const THEME_ICON: Record<Theme, string> = {
  dark: "☾",
  light: "☀",
  amber: "◉",
  glacier: "❄",
};

const THEME_NEXT_I18N_KEY: Record<Theme, string> = {
  dark: "topBar.themeToLight",
  light: "topBar.themeToAmber",
  amber: "topBar.themeToGlacier",
  glacier: "topBar.themeToDark",
};

export function TopBar({
  onCommand,
  theme,
  onToggleTheme,
  accent,
  onAccent,
  density,
  onToggleDensity,
}: TopBarProps) {
  const { t } = useTranslation();
  const toggleLabel = t(THEME_NEXT_I18N_KEY[theme]);
  const densityLabel =
    density === "compact" ? t("topBar.densityToComfortable") : t("topBar.densityToCompact");
  const locale = getLocale();
  const nextLocale: Locale = locale === "pt-BR" ? "en" : "pt-BR";

  return (
    <header className="cd-top">
      <button className="cd-top__cmd" type="button" onClick={onCommand}>
        <span className="cd-top__cmd-icon">⌘</span>
        <span>{t("topBar.searchHint")}</span>
        <span className="cd-top__cmd-key">{CMD_KEY_LABEL}</span>
      </button>

      <div className="cd-top__right">
        <div className="cd-top__accents" role="radiogroup" aria-label={t("topBar.accentLabel")}>
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === accent}
              aria-label={`${t("topBar.accent")} ${a}`}
              className={`cd-top__acc cd-top__acc--${a}${a === accent ? " is-on" : ""}`}
              onClick={() => onAccent(a)}
              title={a}
            />
          ))}
        </div>

        <button
          type="button"
          className="cd-top__lang"
          onClick={() => setLocale(nextLocale)}
          aria-label={t("admin.appearance.language")}
          title={t("admin.appearance.language")}
        >
          {locale === "pt-BR" ? "PT" : "EN"}
        </button>

        <button
          type="button"
          className="cd-top__density"
          onClick={onToggleDensity}
          aria-label={densityLabel}
          aria-pressed={density === "compact"}
          title={densityLabel}
        >
          {density === "compact" ? "▤" : "▦"}
        </button>

        <button
          type="button"
          className="cd-top__theme"
          onClick={onToggleTheme}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {THEME_ICON[theme]}
        </button>
      </div>
    </header>
  );
}
