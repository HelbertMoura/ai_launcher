import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Skeleton } from "../../ui/Skeleton";
import { ACCENTS, useAccent, type Accent } from "../../hooks/useAccent";
import { useTheme, type Theme } from "../../hooks/useTheme";
import { readShowOnStartup, setShowOnStartup } from "../../app/onboarding";
import { invokeOrFallback } from "../../lib/tauri";
import pkg from "../../../package.json";
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

const THEMES: Theme[] = [
  "dark",
  "light",
  "amber",
  "glacier",
  "phosphor",
  "midnight",
  "high-contrast",
];

const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  amber: "Amber",
  glacier: "Glacier",
  phosphor: "Phosphor",
  midnight: "Midnight",
  "high-contrast": "High Contrast",
};
const TOTAL_STEPS = 3;
const STEP_KEYS = ["welcome", "appearance", "scan"] as const;

/* ---- Welcome terminal script ---- */

interface TermLine {
  kind: "prompt" | "output" | "blank";
  command?: string;
  text?: string;
  color?: string;
}

const VERSION = pkg.version;

function getWelcomeLines(): TermLine[] {
  const banner = `  ║     🚀  AI LAUNCHER PRO  v${VERSION.padEnd(8)}║`;
  const top = "  ╔══════════════════════════════════════╗";
  const bot = "  ╚══════════════════════════════════════╝";
  return [
    { kind: "output", text: "", color: "dim" },
    { kind: "output", text: top, color: "accent" },
    { kind: "output", text: banner, color: "accent" },
    { kind: "output", text: bot, color: "accent" },
    { kind: "output", text: "", color: "dim" },
    { kind: "output", text: "  by DevManiac's · Helbert Moura", color: "dim" },
    { kind: "output", text: "", color: "dim" },
    { kind: "prompt", command: "ai-launcher --init" },
    { kind: "output", text: "  ▸ Detectando CLIs de IA...", color: "ok" },
    { kind: "output", text: "  ▸ Configurando ambiente...", color: "ok" },
    { kind: "output", text: "  ✓ Pronto para lançar.", color: "ok" },
    { kind: "output", text: "", color: "dim" },
  ];
}

function WelcomeTerminal() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [typing, setTyping] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDone(false);
    let idx = 0;

    const delay = (ms: number) =>
      new Promise<void>((r) => {
        const id = setTimeout(r, ms);
        return () => clearTimeout(id);
      });

    const run = async () => {
      await delay(600);

      for (const line of getWelcomeLines()) {
        if (cancelled) return;

        if (line.kind === "blank" || (line.kind === "output" && line.text === "")) {
          setLines((prev) => [...prev, line]);
          scroll();
          await delay(40);
          continue;
        }

        if (line.kind === "output") {
          setLines((prev) => [...prev, line]);
          scroll();
          await delay(80);
          continue;
        }

        if (line.kind === "prompt") {
          setIsTyping(true);
          const cmd = line.command ?? "";
          for (const ch of cmd) {
            if (cancelled) return;
            setTyping((prev) => prev + ch);
            scroll();
            await delay(25);
          }
          await delay(300);
          setLines((prev) => [...prev, { kind: "prompt", command: cmd }]);
          setTyping("");
          setIsTyping(false);
          await delay(400);
        }

        idx++;
      }

      if (!cancelled) setDone(true);

    };

    void run();
    return () => {
      cancelled = true;
    };

    function scroll() {
      requestAnimationFrame(() => {
        if (bodyRef.current) {
          bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
      });
    }
  }, []);

  return (
    <div className="at cd-onb__terminal">
      <div className="at__bar">
        <span className="at__dot at__dot--red" />
        <span className="at__dot at__dot--yel" />
        <span className="at__dot at__dot--grn" />
        <span className="at__title">ai-launcher</span>
      </div>
      <div className="at__body" ref={bodyRef}>
        {lines.map((line, i) => {
          if (line.kind === "blank" || (line.kind === "output" && !line.text)) {
            return <div key={i} className="at__line at__line--blank" />;
          }
          if (line.kind === "prompt") {
            return (
              <div key={i} className="at__line at__line--cmd">
                <span className="at__ps">$</span>
                <span className="at__cmd">{line.command}</span>
              </div>
            );
          }
          const cls =
            line.color === "accent"
              ? "cd-onb__term-accent"
              : line.color === "ok"
                ? "at__ok"
                : line.color === "err"
                  ? "at__err"
                  : "at__dim";
          return (
            <div key={i} className="at__line at__line--out">
              <span className={cls}>{line.text}</span>
            </div>
          );
        })}
        {isTyping && (
          <div className="at__line at__line--cmd">
            <span className="at__ps">$</span>
            <span className="at__cmd">
              {typing}
              <span className="at__typing-cursor" />
            </span>
          </div>
        )}
        {!isTyping && done && (
          <div className="at__line at__line--cmd">
            <span className="at__ps">$</span>
            <span className="at__cursor" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Main component ---- */

export function OnboardingPage({ onFinish }: OnboardingPageProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [showStartup, setShowStartup] = useState(readShowOnStartup);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const installedCount = results?.filter((r) => r.installed).length ?? 0;
  const missingCount = results ? results.length - installedCount : 0;

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const r = await invokeOrFallback<ScanResult[]>("check_clis", undefined, []);
      setResults(r);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const toggleShowStartup = () => {
    const next = !showStartup;
    setShowStartup(next);
    setShowOnStartup(next);
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="cd-onb" role="dialog" aria-modal="true" aria-labelledby="cd-onb-title">
      <div className="cd-onb__panel">
        <aside className="cd-onb__rail" aria-label={t("onboarding.progressLabel")}>
          <div className="cd-onb__rail-brand">
            <span className="cd-onb__rail-mark">AI</span>
            <span>v{VERSION}</span>
          </div>
          <ol className="cd-onb__steps">
            {STEP_KEYS.map((key, index) => {
              const current = index + 1;
              return (
                <li
                  key={key}
                  className={`cd-onb__step-pill${current === step ? " is-active" : ""}${current < step ? " is-done" : ""}`}
                >
                  <span className="cd-onb__step-index">{String(current).padStart(2, "0")}</span>
                  <span>{t(`onboarding.steps.${key}`)}</span>
                </li>
              );
            })}
          </ol>
          <div className="cd-onb__trust">
            <span className="cd-onb__trust-label">{t("onboarding.trustLabel")}</span>
            <span>{t("onboarding.trustLocal")}</span>
          </div>
        </aside>

        <main className="cd-onb__main">
          <div className="cd-onb__indicator">
            {t("onboarding.indicator", { current: step, total: TOTAL_STEPS })}
          </div>

          {step === 1 && (
            <div className="cd-onb__step">
              <div className="cd-onb__brand">
                <h1 id="cd-onb-title" className="cd-onb__title">
                  AI LAUNCHER
                </h1>
                <span className="cd-onb__badge">PRO</span>
              </div>
              <WelcomeTerminal />
              <p className="cd-onb__lede">{t("onboarding.step1Lede")}</p>
              <div className="cd-onb__promise-grid" aria-label={t("onboarding.promiseLabel")}>
                <span>{t("onboarding.promiseLocal")}</span>
                <span>{t("onboarding.promiseSecure")}</span>
                <span>{t("onboarding.promiseControl")}</span>
              </div>
              <div className="cd-onb__byline">
                <span className="cd-onb__byline-text">by <strong>DevManiac&apos;s</strong> · Helbert Moura</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="cd-onb__step">
              <h1 id="cd-onb-title" className="cd-onb__title">
                {t("onboarding.step2Title")}
              </h1>
              <p className="cd-onb__lede">{t("onboarding.step2Lede")}</p>
              <div className="cd-onb__field">
                <div className="cd-onb__label">{t("onboarding.step2Theme")}</div>
                <div className="cd-onb__row cd-onb__theme-grid">
                  {THEMES.map((th) => (
                    <button
                      key={th}
                      type="button"
                      className={`cd-onb__theme ${theme === th ? "is-active" : ""}`}
                      aria-pressed={theme === th}
                      onClick={() => setTheme(th)}
                    >
                      <span className="cd-onb__theme-preview" aria-hidden="true" />
                      <span>{THEME_LABELS[th]}</span>
                    </button>
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

              <div className="cd-onb__toggle-field">
                <label className="cd-onb__toggle">
                  <input
                    type="checkbox"
                    checked={showStartup}
                    onChange={toggleShowStartup}
                  />
                  <span className="cd-onb__toggle-slider" />
                  <span className="cd-onb__toggle-text">
                    {t("onboarding.step2ShowOnStartup")}
                  </span>
                </label>
                <span className="cd-onb__toggle-hint">
                  {t("onboarding.step2ShowOnStartupHint")}
                </span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="cd-onb__step">
              <h1 id="cd-onb-title" className="cd-onb__title">
                {t("onboarding.step3Title")}
              </h1>
              <p className="cd-onb__lede">{t("onboarding.step3Lede")}</p>

              <div className="cd-onb__scan-summary" aria-live="polite">
                <div>
                  <span className="cd-onb__metric-value">{results ? installedCount : "—"}</span>
                  <span className="cd-onb__metric-label">{t("onboarding.scanInstalled")}</span>
                </div>
                <div>
                  <span className="cd-onb__metric-value">{results ? missingCount : "—"}</span>
                  <span className="cd-onb__metric-label">{t("onboarding.scanMissing")}</span>
                </div>
              </div>

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
                <div className="cd-onb__error" role="alert">
                  {t("onboarding.step3ScanError", { error: scanError })}
                </div>
              )}

              {results && !scanning && (
                <ul className="cd-onb__results" aria-label={t("onboarding.scanResults")} tabIndex={0}>
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
              <div className="cd-onb__finish">
                {!results && <span>{t("onboarding.finishHint")}</span>}
                <Button size="sm" disabled={!results} onClick={onFinish}>
                  {t("onboarding.finish")}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
