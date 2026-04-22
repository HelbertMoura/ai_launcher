import { Command } from "cmdk";
import { TAB_LABELS, type TabId } from "../../app/layout/TabId";
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

const TABS: TabId[] = ["launcher", "tools", "history", "costs", "admin", "help"];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  theme,
  onToggleTheme,
  onSetAccent,
}: CommandPaletteProps) {
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
      aria-label="Command palette"
    >
      <div className="cd-cmd" onClick={(e) => e.stopPropagation()}>
        <Command label="Command palette" loop>
          <Command.Input
            className="cd-cmd__input"
            placeholder="Search commands…"
            autoFocus
          />
          <Command.List className="cd-cmd__list">
            <Command.Empty className="cd-cmd__empty">No matches.</Command.Empty>

            <Command.Group heading="Navigate" className="cd-cmd__group">
              {TABS.map((tab) => (
                <Command.Item
                  key={`nav-${tab}`}
                  value={`navigate ${tab} ${TAB_LABELS[tab]}`}
                  onSelect={run(() => onNavigate(tab))}
                  className="cd-cmd__item"
                >
                  <span className="cd-cmd__item-kind">go</span>
                  <span className="cd-cmd__item-label">{TAB_LABELS[tab]}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Theme" className="cd-cmd__group">
              <Command.Item
                value={`theme switch ${theme === "dark" ? "light" : "dark"}`}
                onSelect={run(onToggleTheme)}
                className="cd-cmd__item"
              >
                <span className="cd-cmd__item-kind">theme</span>
                <span className="cd-cmd__item-label">
                  Switch to {theme === "dark" ? "light" : "dark"}
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Accent" className="cd-cmd__group">
              {ACCENTS.map((accent) => (
                <Command.Item
                  key={`acc-${accent}`}
                  value={`accent ${accent}`}
                  onSelect={run(() => onSetAccent(accent))}
                  className="cd-cmd__item"
                >
                  <span className="cd-cmd__item-kind">accent</span>
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
