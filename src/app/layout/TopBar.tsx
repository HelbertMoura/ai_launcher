import { useTranslation } from "react-i18next";
import { InboxBell } from "../../features/inbox/InboxBell";
import { ACCENTS, type Accent } from "../../hooks/useAccent";
import type { Density } from "../../hooks/useDensity";
import { nextTheme, type Theme } from "../../hooks/useTheme";
import { getLocale, setLocale, type Locale } from "../../i18n";
import type { TabId } from "./TabId";
import { Icon } from "../../ui/Icon";
import { Gear, MagnifyingGlass, Palette } from "../../ui/icons";
import "./TopBar.css";

const CMD_KEY_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl+K";

interface TopBarProps {
  onCommand: () => void;
  onNavigate: (tab: TabId) => void;
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
  phosphor: "▣",
  midnight: "✦",
  "high-contrast": "◧",
};

const THEME_LABEL: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  amber: "Amber",
  glacier: "Glacier",
  phosphor: "Phosphor",
  midnight: "Midnight",
  "high-contrast": "High Contrast",
};

export function TopBar({
  onCommand,
  onNavigate,
  theme,
  onToggleTheme,
  accent,
  onAccent,
  density,
  onToggleDensity,
}: TopBarProps) {
  const { t } = useTranslation();
  const toggleLabel = t("topBar.themeToNext", { theme: THEME_LABEL[nextTheme(theme)] });
  const densityLabel =
    density === "compact" ? t("topBar.densityToComfortable") : t("topBar.densityToCompact");
  const locale = getLocale();
  const nextLocale: Locale = locale === "pt-BR" ? "en" : "pt-BR";

  return (
    <header className="cd-top">
      <button className="cd-top__cmd" type="button" onClick={onCommand}>
        <Icon icon={MagnifyingGlass} size={18} className="cd-top__cmd-icon" />
        <span>{t("topBar.searchHint")}</span>
        <span className="cd-top__cmd-key">{CMD_KEY_LABEL}</span>
      </button>

      <div className="cd-top__right">
        <InboxBell onNavigate={onNavigate} />
        <details className="cd-top__settings">
          <summary aria-label={t("topBar.quickSettings")} title={t("topBar.quickSettings")}>
            <Icon icon={Gear} size={18} />
          </summary>
          <div className="cd-top__settings-panel">
            <div className="cd-top__settings-head">
              <Icon icon={Palette} size={16} />
              <strong>{t("topBar.quickSettings")}</strong>
            </div>
            <span className="cd-top__settings-label">{t("topBar.accentLabel")}</span>
            <div className="cd-top__accents" role="radiogroup" aria-label={t("topBar.accentLabel")}>
              {ACCENTS.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={a === accent}
                  aria-label={`${t("topBar.accent")} ${a}`}
                  className={`cd-top__acc cd-top__acc--${a}${a === accent ? " is-on" : ""}`}
                  onClick={() => onAccent(a)} title={a} />
              ))}
            </div>
            <div className="cd-top__settings-actions">
              <button type="button" className="cd-top__setting-btn" onClick={() => setLocale(nextLocale)}>
                {locale === "pt-BR" ? "PT-BR" : "EN"}
              </button>
              <button type="button" className="cd-top__setting-btn" onClick={onToggleDensity}
                aria-pressed={density === "compact"} title={densityLabel}>
                {density === "compact" ? t("topBar.compact") : t("topBar.comfortable")}
              </button>
              <button type="button" className="cd-top__setting-btn" onClick={onToggleTheme} title={toggleLabel}>
                {THEME_ICON[theme]} {THEME_LABEL[theme]}
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
