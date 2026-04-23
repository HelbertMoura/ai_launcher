import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { setLocale, SUPPORTED_LOCALES, type Locale } from "../../../i18n";
import { AutoStartToggle } from "./AutoStartToggle";
import { HotkeyField } from "./HotkeyField";
import { NotificationsToggle } from "./NotificationsToggle";

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

const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "admin.appearance.languagePtBR",
  en: "admin.appearance.languageEn",
};

export function AppearanceSection() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { accent, setAccent, customHex, setCustomHex } = useAccent();
  const [customHexDraft, setCustomHexDraft] = useState<string>(customHex);
  const [fontId, setFontId] = useState<FontId>(readStoredFont);

  useEffect(() => {
    setCustomHexDraft(customHex);
  }, [customHex]);
  const currentLocale = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as Locale)
    : "pt-BR";

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
          <div className="cd-appearance__label">{t("admin.appearance.language")}</div>
          <div className="cd-appearance__row">
            {SUPPORTED_LOCALES.map((loc) => (
              <Button
                key={loc}
                size="sm"
                variant={currentLocale === loc ? "primary" : "ghost"}
                onClick={() => setLocale(loc)}
              >
                {t(LOCALE_LABELS[loc])}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">{t("admin.appearance.theme")}</div>
          <div className="cd-appearance__row">
            {THEMES.map((th) => (
              <Button
                key={th}
                size="sm"
                variant={theme === th ? "primary" : "ghost"}
                onClick={() => setTheme(th)}
              >
                {th}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">{t("admin.appearance.accent")}</div>
          <div className="cd-appearance__row" role="radiogroup">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === accent}
                aria-label={`${t("topBar.accent")} ${a}`}
                className={`cd-appearance__swatch cd-appearance__swatch--${a}${
                  a === accent ? " is-active" : ""
                }`}
                onClick={() => setAccent(a satisfies Accent)}
              />
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={accent === "custom"}
              aria-label={t("admin.appearance.accentCustom")}
              title={t("admin.appearance.accentCustom")}
              className={`cd-appearance__swatch cd-appearance__swatch--custom${
                accent === "custom" ? " is-active" : ""
              }`}
              style={{ background: customHex }}
              onClick={() => setAccent("custom")}
            />
          </div>
          {accent === "custom" && (
            <div className="cd-appearance__accent-custom-row">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="cd-appearance__accent-custom-input"
                aria-label={t("admin.appearance.accentCustom")}
              />
              <input
                type="text"
                value={customHexDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#?[0-9a-f]{0,6}$/i.test(v)) {
                    const withHash = v.startsWith("#") ? v : `#${v}`;
                    setCustomHexDraft(withHash);
                    if (/^#[0-9a-f]{6}$/i.test(withHash)) {
                      setCustomHex(withHash);
                    }
                  }
                }}
                className="cd-appearance__accent-custom-hex"
                spellCheck={false}
                pattern="^#[0-9a-fA-F]{6}$"
                maxLength={7}
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="cd-appearance__group">
          <div className="cd-appearance__label">{t("admin.appearance.font")}</div>
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
                  {opt.recommended ? ` · ${t("admin.appearance.recommended")}` : ""}
                </span>
                <span className="cd-appearance__font-sample">AaBb 0123</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: "16px" }}>
            <AutoStartToggle />
          </div>
          <div style={{ marginTop: "16px" }}>
            <NotificationsToggle />
          </div>
        </div>
      </Card>

      <Card>
        <HotkeyField />
      </Card>
    </div>
  );
}
