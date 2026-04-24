import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { PrereqCheck } from "../prereqs/usePrerequisites";
import "./DoctorPage.css";

type Severity = "critical" | "warning" | "info";

interface DoctorItem {
  check: PrereqCheck;
  severity: Severity;
}

const CRITICAL_KEYS = new Set(["node", "git"]);
const WARNING_KEYS = new Set(["python", "rust", "pnpm", "yarn", "bun"]);

function classify(key: string): Severity {
  if (CRITICAL_KEYS.has(key)) return "critical";
  if (WARNING_KEYS.has(key)) return "warning";
  return "info";
}

interface DoctorPageProps {
  /** If true, shows what would be done without executing fixes. */
  dryRun?: boolean;
}

export function DoctorPage({ dryRun: dryRunProp = false }: DoctorPageProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(dryRunProp);

  const runDiagnosis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await invoke<PrereqCheck[]>("check_environment");
      const classified = results.map((check) => ({
        check,
        severity: classify(check.key),
      }));
      setItems(classified);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runDiagnosis();
  }, [runDiagnosis]);

  const handleFix = useCallback(
    async (item: DoctorItem) => {
      if (dryRun) return;
      setFixing(item.check.key);
      try {
        await invoke("install_prerequisite", { key: item.check.key });
        // Re-run diagnosis after fix
        await runDiagnosis();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setFixing(null);
      }
    },
    [dryRun, runDiagnosis],
  );

  const critical = items.filter((i) => i.severity === "critical");
  const warnings = items.filter((i) => i.severity === "warning");
  const infos = items.filter((i) => i.severity === "info");
  const problems = items.filter((i) => !i.check.installed);

  const problemCount = problems.length;
  const criticalCount = critical.filter((i) => !i.check.installed).length;

  return (
    <section className="cd-doc">
      <header className="cd-doc__head">
        <div>
          <h1 className="cd-doc__title">{t("doctor.title")}</h1>
          <p className="cd-doc__sub">{t("doctor.subtitle")}</p>
        </div>
        <div className="cd-doc__actions">
          <label className="cd-doc__dry-run">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span>{t("doctor.dryRun")}</span>
          </label>
          <button
            type="button"
            className="cd-doc__run"
            onClick={() => void runDiagnosis()}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("doctor.runDiagnosis")}
          </button>
        </div>
      </header>

      {!loading && !error && (
        <div className="cd-doc__summary">
          {problemCount === 0 ? (
            <span className="cd-doc__summary-ok">{t("doctor.allGood")}</span>
          ) : (
            <span className="cd-doc__summary-problems">
              {t("doctor.problemsFound", { count: problemCount })}
              {criticalCount > 0 && (
                <span className="cd-doc__summary-critical">
                  {" "}
                  ({t("doctor.criticalCount", { count: criticalCount })})
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {loading && <div className="cd-doc__loading">{t("common.loading")}</div>}
      {error && <div className="cd-doc__error">{error}</div>}

      {critical.length > 0 && (
        <DoctorGroup
          title={t("doctor.critical")}
          items={critical}
          fixing={fixing}
          dryRun={dryRun}
          onFix={handleFix}
        />
      )}
      {warnings.length > 0 && (
        <DoctorGroup
          title={t("doctor.warnings")}
          items={warnings}
          fixing={fixing}
          dryRun={dryRun}
          onFix={handleFix}
        />
      )}
      {infos.length > 0 && (
        <DoctorGroup
          title={t("doctor.info")}
          items={infos}
          fixing={fixing}
          dryRun={dryRun}
          onFix={handleFix}
        />
      )}
    </section>
  );
}

// --- Doctor Group ---

interface DoctorGroupProps {
  title: string;
  items: DoctorItem[];
  fixing: string | null;
  dryRun: boolean;
  onFix: (item: DoctorItem) => void;
}

function DoctorGroup({ title, items, fixing, dryRun, onFix }: DoctorGroupProps) {
  return (
    <div className="cd-doc__group">
      <h2 className="cd-doc__group-title">{title}</h2>
      <div className="cd-doc__grid">
        {items.map((item) => (
          <DoctorCard
            key={item.check.key}
            item={item}
            isFixing={fixing === item.check.key}
            dryRun={dryRun}
            onFix={onFix}
          />
        ))}
      </div>
    </div>
  );
}

// --- Doctor Card ---

interface DoctorCardProps {
  item: DoctorItem;
  isFixing: boolean;
  dryRun: boolean;
  onFix: (item: DoctorItem) => void;
}

function DoctorCard({ item, isFixing, dryRun, onFix }: DoctorCardProps) {
  const { t } = useTranslation();
  const { check, severity } = item;

  const severityClass = `cd-doc-card--${severity}`;
  const installedClass = check.installed ? "cd-doc-card--ok" : `cd-doc-card--missing ${severityClass}`;

  return (
    <div className={`cd-doc-card ${installedClass}`}>
      <div className="cd-doc-card__head">
        <span className="cd-doc-card__severity">
          {severity === "critical" ? "!!" : severity === "warning" ? "!" : "i"}
        </span>
        <span className="cd-doc-card__name">{check.name}</span>
        <span className="cd-doc-card__status">
          {check.installed ? t("common.installed") : t("common.missing")}
        </span>
      </div>
      <div className="cd-doc-card__body">
        {check.version && (
          <span className="cd-doc-card__version">v{check.version}</span>
        )}
      </div>
      {!check.installed && (
        <div className="cd-doc-card__foot">
          {dryRun ? (
            <span className="cd-doc-card__dry-hint">{t("doctor.wouldFix")}</span>
          ) : (
            <button
              type="button"
              className="cd-doc-card__fix"
              disabled={isFixing}
              onClick={() => void onFix(item)}
            >
              {isFixing ? t("doctor.fixing") : t("doctor.fix")}
            </button>
          )}
          {check.install_command && (
            <code className="cd-doc-card__cmd">{check.install_command}</code>
          )}
        </div>
      )}
    </div>
  );
}
