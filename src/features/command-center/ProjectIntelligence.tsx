import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { ProjectStackScan } from "../project-intelligence/stackDetector";
import type { ProjectMcpHealthSummary, ProjectMcpResolution } from "../mcp/projectMcp";

export function ProjectIntelligence({
  stack,
  projectMcp,
  canCreateProfile,
  profileExists,
  onCreateProfile,
}: {
  stack: { loading: boolean; error: string | null; scan: ProjectStackScan | null };
  projectMcp: {
    loading: boolean;
    error: string | null;
    resolution: ProjectMcpResolution;
    summary: ProjectMcpHealthSummary;
  };
  canCreateProfile: boolean;
  profileExists: boolean;
  onCreateProfile: () => void;
}) {
  const { t } = useTranslation();
  const primary = stack.scan?.primary;
  if (stack.loading) {
    return <p className="cd-command__muted">{t("commandCenter.projectIntelScanning")}</p>;
  }
  if (stack.error) {
    return <p className="cd-command__muted">{t("commandCenter.projectIntelError")}</p>;
  }
  if (!primary) {
    return (
      <div className="cd-command__intel">
        <p className="cd-command__muted">{t("commandCenter.projectIntelEmpty")}</p>
        <ProjectMcpStatus projectMcp={projectMcp} />
        {canCreateProfile && (
          <Button size="sm" variant="primary" onClick={onCreateProfile}>
            {t(profileExists ? "commandCenter.profileUpdate" : "commandCenter.profileCreate")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="cd-command__intel">
      <div className="cd-command__intel-main">
        <span>{t("commandCenter.projectIntelPrimary")}</span>
        <strong>{primary.label}</strong>
        <small>{t(`commandCenter.stackConfidence.${primary.confidence}`)}</small>
      </div>
      <div className="cd-command__chips" aria-label={t("commandCenter.projectIntelEvidence")}>
        {primary.evidence.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <dl className="cd-command__intel-hints">
        <div>
          <dt>{t("commandCenter.projectIntelCli")}</dt>
          <dd>{stack.scan?.profileHints.cli ?? t("commandCenter.none")}</dd>
        </div>
        <div>
          <dt>{t("commandCenter.projectIntelRunbook")}</dt>
          <dd>{stack.scan?.profileHints.runbook ?? t("commandCenter.none")}</dd>
        </div>
      </dl>
      <div className="cd-command__chips cd-command__chips--muted">
        {stack.scan?.profileHints.tags.slice(0, 5).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <ProjectMcpStatus projectMcp={projectMcp} />
      {canCreateProfile && (
        <Button size="sm" variant="primary" onClick={onCreateProfile}>
          {t(profileExists ? "commandCenter.profileUpdate" : "commandCenter.profileCreate")}
        </Button>
      )}
    </div>
  );
}

export function ProjectMcpStatus({
  projectMcp,
}: {
  projectMcp: {
    loading: boolean;
    error: string | null;
    resolution: ProjectMcpResolution;
    summary: ProjectMcpHealthSummary;
  };
}) {
  const { t } = useTranslation();
  const { resolution, summary } = projectMcp;
  if (summary.expected === 0) {
    return <p className="cd-command__muted">{t("commandCenter.projectMcpNone")}</p>;
  }

  const detailKey = projectMcp.error
    ? "commandCenter.projectMcpError"
    : projectMcp.loading
      ? "commandCenter.projectMcpLoading"
      : summary.status === "ok"
        ? "commandCenter.projectMcpOk"
        : summary.status === "unknown"
          ? "commandCenter.projectMcpUnknown"
          : "commandCenter.projectMcpWarn";

  return (
    <div className={`cd-command__project-mcp cd-command__project-mcp--${summary.status}`}>
      <div className="cd-command__project-mcp-main">
        <span>{t("commandCenter.projectMcpTitle")}</span>
        <strong>
          {summary.matched}/{summary.expected}
        </strong>
        <small>
          {t(detailKey, {
            enabled: summary.enabled,
            expected: summary.expected,
            healthy: summary.healthy,
            matched: summary.matched,
            missing: summary.missing,
            unhealthy: summary.unhealthy,
            unknown: summary.unknown,
          })}
        </small>
      </div>
      <div className="cd-command__chips cd-command__chips--muted">
        {resolution.expectedIds.slice(0, 6).map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
      {resolution.missing.length > 0 && (
        <div className="cd-command__chips cd-command__chips--danger">
          {resolution.missing.slice(0, 4).map((id) => (
            <span key={id}>{t("commandCenter.projectMcpMissing", { id })}</span>
          ))}
        </div>
      )}
    </div>
  );
}
