import { useEffect, useState } from "react";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { ACCENTS, useAccent, type Accent } from "../../../hooks/useAccent";
import { useTheme, type Theme } from "../../../hooks/useTheme";
import {
  applyFontStack,
  FONT_OPTIONS,
  FONT_STORAGE_KEY,
  type FontId,
} from "../../../lib/appearance";

const THEMES: Theme[] = ["dark", "light"];

function readStoredFont(): FontId {
  try {
    const raw = localStorage.getItem(FONT_STORAGE_KEY);
    if (
      raw === "jetbrains" ||
      raw === "plex" ||
      raw === "cascadia" ||
      raw === "berkeley" ||
      raw === "system"
    ) {
      return raw;
    }
  } catch {
    /* noop */
  }
  return "jetbrains";
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [fontId, setFontId] = useState<FontId>(readStoredFont);

  useEffect(() => {
    applyFontStack(fontId);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, fontId);
    } catch {
      /* noop */
    }
  }, [fontId]);

  return (
    <div className="cd-admin__body">
      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">theme</div>
          <div className="cd-appearance__row">
            {THEMES.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={theme === t ? "primary" : "ghost"}
                onClick={() => setTheme(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">accent</div>
          <div className="cd-appearance__row" role="radiogroup">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === accent}
                aria-label={`Accent ${a}`}
                className={`cd-appearance__swatch cd-appearance__swatch--${a}${
                  a === accent ? " is-active" : ""
                }`}
                onClick={() => setAccent(a satisfies Accent)}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">display font</div>
          <div className="cd-appearance__fonts">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`cd-appearance__font${
                  opt.id === fontId ? " is-active" : ""
                }`}
                onClick={() => setFontId(opt.id as FontId)}
                style={{ fontFamily: opt.stack }}
              >
                <span>
                  {opt.name}
                  {opt.recommended ? " · recommended" : ""}
                </span>
                <span className="cd-appearance__font-sample">AaBb 0123</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
