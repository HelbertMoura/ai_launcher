import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invokeOrFallback } from "../../lib/tauri";
import type { PrereqCheck } from "../prereqs/usePrerequisites";
import type { TabId } from "../../app/layout/TabId";
import { BentoCard } from "./BentoCard";
import { summarizeDoctorSeverities } from "./doctorSummaryModel";

export function DoctorSummaryCard({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PrereqCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await invokeOrFallback<PrereqCheck[]>(
          "check_environment",
          undefined,
          [],
        );
        if (!cancelled) setItems(results);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => summarizeDoctorSeverities(items), [items]);

  const meta = loading ? "..." : t("workspace.doctorMeta", {
    ok: counts.total - counts.missing,
    total: counts.total,
  });
  const handleActivate = onNavigate ? () => onNavigate("doctor") : undefined;

  return (
    <BentoCard
      area="doctor"
      title={t("workspace.doctorTitle")}
      meta={meta}
      onActivate={handleActivate}
    >
      {loading ? (
        <p className="cd-ws-bento__dim">{t("common.scanning")}</p>
      ) : counts.missing === 0 ? (
        <div className="cd-ws-bento__doctor-ok">
          <span className="cd-ws-bento__doctor-ok-mark">{t("workspace.okMark")}</span>
          <span className="cd-ws-bento__doctor-ok-text">{t("workspace.allChecksPass")}</span>
        </div>
      ) : (
        <ul className="cd-ws-bento__doctor-list">
          <li className="cd-ws-bento__doctor-row cd-ws-bento__doctor-row--critical">
            <span className="cd-ws-bento__doctor-badge">!!</span>
            <span className="cd-ws-bento__doctor-label">{t("workspace.severityCritical")}</span>
            <span className="cd-ws-bento__doctor-count">{counts.critical}</span>
          </li>
          <li className="cd-ws-bento__doctor-row cd-ws-bento__doctor-row--warning">
            <span className="cd-ws-bento__doctor-badge">!</span>
            <span className="cd-ws-bento__doctor-label">{t("workspace.severityWarning")}</span>
            <span className="cd-ws-bento__doctor-count">{counts.warning}</span>
          </li>
          <li className="cd-ws-bento__doctor-row cd-ws-bento__doctor-row--info">
            <span className="cd-ws-bento__doctor-badge">i</span>
            <span className="cd-ws-bento__doctor-label">{t("workspace.severityInfo")}</span>
            <span className="cd-ws-bento__doctor-count">{counts.info}</span>
          </li>
        </ul>
      )}
    </BentoCard>
  );
}
