import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import { TAB_I18N_KEYS, type TabId } from "../../app/layout/TabId";
import { ACCENTS, type Accent } from "../../hooks/useAccent";
import type { Theme } from "../../hooks/useTheme";
import "./CommandPalette.css";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: TabId) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onSetAccent: (accent: Accent) => void;
}

const TABS: TabId[] = ["launcher", "tools", "history", "costs", "workspace", "doctor", "admin", "help"];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  theme,
  onToggleTheme,
  onSetAccent,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  if (!open) return null;

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div
      className="cd-cmd__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("topBar.command")}
    >
      <div className="cd-cmd" onClick={(e) => e.stopPropagation()}>
        <Command label={t("topBar.command")} loop>
          <Command.Input
            className="cd-cmd__input"
            placeholder={t("palette.placeholder")}
            autoFocus
          />
          <Command.List className="cd-cmd__list">
            <Command.Empty className="cd-cmd__empty">—</Command.Empty>

            <Command.Group heading={t("palette.groupNavigate")} className="cd-cmd__group">
              {TABS.map((tab) => {
                const label = t(TAB_I18N_KEYS[tab]);
                return (
                  <Command.Item
                    key={`nav-${tab}`}
                    value={`navigate ${tab} ${label}`}
                    onSelect={run(() => onNavigate(tab))}
                    className="cd-cmd__item"
                  >
                    <span className="cd-cmd__item-kind">→</span>
                    <span className="cd-cmd__item-label">{label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group heading={t("palette.groupTheme")} className="cd-cmd__group">
              <Command.Item
                value={`theme switch ${theme === "dark" ? "light" : "dark"}`}
                onSelect={run(onToggleTheme)}
                className="cd-cmd__item"
              >
                <span className="cd-cmd__item-kind">☾</span>
                <span className="cd-cmd__item-label">
                  {theme === "dark" ? t("palette.actionThemeLight") : t("palette.actionThemeDark")}
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t("palette.groupAccent")} className="cd-cmd__group">
              {ACCENTS.map((accent) => (
                <Command.Item
                  key={`acc-${accent}`}
                  value={`accent ${accent}`}
                  onSelect={run(() => onSetAccent(accent))}
                  className="cd-cmd__item"
                >
                  <span className="cd-cmd__item-kind">●</span>
                  <span
                    className={`cd-cmd__swatch cd-cmd__swatch--${accent}`}
                    aria-hidden
                  />
                  <span className="cd-cmd__item-label">{accent}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
