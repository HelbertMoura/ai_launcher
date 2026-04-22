import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Skeleton } from "../../ui/Skeleton";
import { ACCENTS, useAccent, type Accent } from "../../hooks/useAccent";
import { useTheme, type Theme } from "../../hooks/useTheme";
import "./OnboardingPage.css";

interface OnboardingPageProps {
  onFinish: () => void;
}

interface ScanResult {
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

const THEMES: Theme[] = ["dark", "light"];
const TOTAL_STEPS = 3;

export function OnboardingPage({ onFinish }: OnboardingPageProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const r = await invoke<ScanResult[]>("check_clis");
      setResults(r);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="cd-onb" role="dialog" aria-modal="true" aria-labelledby="cd-onb-title">
      <div className="cd-onb__panel">
        <div className="cd-onb__indicator">
          {t("onboarding.indicator", { current: step, total: TOTAL_STEPS })}
        </div>

        {step === 1 && (
          <div className="cd-onb__step">
            <h1 id="cd-onb-title" className="cd-onb__title">
              ▎ {t("onboarding.title")}
            </h1>
            <p className="cd-onb__lede">{t("onboarding.step1Lede")}</p>
          </div>
        )}

        {step === 2 && (
          <div className="cd-onb__step">
            <h1 id="cd-onb-title" className="cd-onb__title">
              {t("onboarding.step2Title")}
            </h1>
            <div className="cd-onb__field">
              <div className="cd-onb__label">{t("onboarding.step2Theme")}</div>
              <div className="cd-onb__row">
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

            <div className="cd-onb__field">
              <div className="cd-onb__label">{t("onboarding.step2Accent")}</div>
              <div className="cd-onb__swatches">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`cd-onb__swatch cd-onb__swatch--${a} ${accent === a ? "is-active" : ""}`}
                    aria-label={`${t("topBar.accent")} ${a}`}
                    aria-pressed={accent === a}
                    onClick={() => setAccent(a satisfies Accent)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="cd-onb__step">
            <h1 id="cd-onb-title" className="cd-onb__title">
              {t("onboarding.step3Title")}
            </h1>
            <p className="cd-onb__lede">{t("onboarding.step3Lede")}</p>

            {!results && !scanning && (
              <Button size="md" onClick={() => void runScan()}>
                {t("onboarding.step3ScanNow")}
              </Button>
            )}

            {scanning && (
              <div className="cd-onb__scan">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="line" height={24} />
                ))}
              </div>
            )}

            {scanError && (
              <div className="cd-onb__error">
                {t("onboarding.step3ScanError", { error: scanError })}
              </div>
            )}

            {results && !scanning && (
              <ul className="cd-onb__results">
                {results.map((r) => (
                  <li key={r.name} className="cd-onb__result">
                    <span className="cd-onb__result-name">{r.name}</span>
                    <Chip variant={r.installed ? "online" : "missing"} dot>
                      {r.installed ? (r.version ?? t("common.online")) : t("common.missing")}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="cd-onb__nav">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={back}>
              {t("onboarding.back")}
            </Button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS && (
            <Button size="sm" onClick={next}>
              {t("onboarding.next")}
            </Button>
          )}

          {step === TOTAL_STEPS && (
            <Button size="sm" disabled={!results} onClick={onFinish}>
              {t("onboarding.finish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
