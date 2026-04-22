import { useState } from "react";
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
          {step} / {TOTAL_STEPS}
        </div>

        {step === 1 && (
          <div className="cd-onb__step">
            <h1 id="cd-onb-title" className="cd-onb__title">
              ▎ AI LAUNCHER
            </h1>
            <p className="cd-onb__lede">
              This launcher runs with full system access so it can install,
              update, and launch AI CLIs on your behalf. Keep your credentials
              safe. No telemetry leaves your machine without explicit action.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="cd-onb__step">
            <h1 id="cd-onb-title" className="cd-onb__title">
              Pick your look
            </h1>
            <div className="cd-onb__field">
              <div className="cd-onb__label">theme</div>
              <div className="cd-onb__row">
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

            <div className="cd-onb__field">
              <div className="cd-onb__label">accent</div>
              <div className="cd-onb__swatches">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`cd-onb__swatch cd-onb__swatch--${a} ${accent === a ? "is-active" : ""}`}
                    aria-label={`Accent ${a}`}
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
              Detect your CLIs
            </h1>
            <p className="cd-onb__lede">
              We'll look for Claude, Codex, Gemini, and the other supported
              CLIs on your PATH. Nothing is uploaded.
            </p>

            {!results && !scanning && (
              <Button size="md" onClick={() => void runScan()}>
                Scan now
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
              <div className="cd-onb__error">Scan failed: {scanError}</div>
            )}

            {results && !scanning && (
              <ul className="cd-onb__results">
                {results.map((r) => (
                  <li key={r.name} className="cd-onb__result">
                    <span className="cd-onb__result-name">{r.name}</span>
                    <Chip variant={r.installed ? "online" : "missing"} dot>
                      {r.installed ? (r.version ?? "online") : "missing"}
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
              ← Back
            </Button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS && (
            <Button size="sm" onClick={next}>
              Continue →
            </Button>
          )}

          {step === TOTAL_STEPS && (
            <Button size="sm" disabled={!results} onClick={onFinish}>
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
