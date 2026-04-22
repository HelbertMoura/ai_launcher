import { ACCENTS, type Accent } from "../../hooks/useAccent";
import type { Theme } from "../../hooks/useTheme";
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
}

export function TopBar({ onCommand, theme, onToggleTheme, accent, onAccent }: TopBarProps) {
  return (
    <header className="cd-top">
      <button className="cd-top__cmd" type="button" onClick={onCommand}>
        <span className="cd-top__cmd-icon">⌘</span>
        <span>search commands, CLIs, presets…</span>
        <span className="cd-top__cmd-key">{CMD_KEY_LABEL}</span>
      </button>

      <div className="cd-top__right">
        <div className="cd-top__accents" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={a === accent}
              aria-label={`Accent ${a}`}
              className={`cd-top__acc cd-top__acc--${a}${a === accent ? " is-on" : ""}`}
              onClick={() => onAccent(a)}
              title={a}
            />
          ))}
        </div>

        <button
          type="button"
          className="cd-top__theme"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
      </div>
    </header>
  );
}
