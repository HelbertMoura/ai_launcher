import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Banner } from "../../ui/Banner";
import { EmptyState, ART_CHECK } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { useClis } from "../launcher/useClis";
import { useTools } from "../tools/useTools";
import { usePrerequisites } from "../prereqs/usePrerequisites";
import { useUpdates } from "../../hooks/useUpdates";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import { AppUpdater } from "./AppUpdater";
import { buildUpdatesOverview } from "./updatesPageModel";
import "../page.css";
import "./UpdatesPage.css";

export function UpdatesPage() {
  const { t, i18n } = useTranslation();
  const { clis, checks: cliChecks, refresh: refreshClis } = useClis();
  const { refresh: refreshTools } = useTools();
  const { items: prereqs, refresh: refreshPrereqs } = usePrerequisites();
  const { summary, loading: updatesLoading, refresh: refreshUpdates } = useUpdates();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missingPrereqs = prereqs.filter((p) => !p.installed);
  const missingClis = clis.filter((c) => !cliChecks[c.name]?.installed);
  const overview = useMemo(
    () => buildUpdatesOverview(summary, missingPrereqs.length, missingClis.length),
    [summary, missingPrereqs.length, missingClis.length],
  );
  const { cliUpdates, envUpdates, toolUpdates, total } = overview;
  const availableUpdates = cliUpdates.length + envUpdates.length + toolUpdates.length;
  const requiredInstalls = missingPrereqs.length + missingClis.length;
  const checkedAt = overview.checkedAt
    ? new Date(overview.checkedAt).toLocaleString(i18n.language)
    : t("updates.notChecked");

  const run = async (id: string, cmd: string, args: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await invoke(cmd, args);
      const targetName =
        (typeof args.cliKey === "string" && args.cliKey) ||
        (typeof args.toolKey === "string" && args.toolKey) ||
        (typeof args.key === "string" && args.key) ||
        "";
      if (cmd === "update_cli" || cmd === "install_cli" || cmd === "install_tool") {
        void ensurePermissionThenNotify(
          t("notifications.installDone.title", { name: targetName }),
          t("notifications.installDone.body"),
        );
      }
      await Promise.all([refreshClis(), refreshTools(), refreshPrereqs(), refreshUpdates()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const updateAll = async () => {
    setBusy("__all__");
    setError(null);
    try {
      await invoke("update_all_clis");
      void ensurePermissionThenNotify(
        t("notifications.installDone.title", { name: t("updates.updateAll") }),
        t("notifications.installDone.body"),
      );
      await Promise.all([refreshClis(), refreshTools(), refreshUpdates()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cd-page cd-updates">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("updates.title")}</h1>
          <p className="cd-page__sub">
            {updatesLoading
              ? t("updates.refreshing")
              : total > 0
                ? t("updates.summary", { count: total })
                : t("updates.summaryNone")}
          </p>
        </div>
        <div className="cd-updates__actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refreshUpdates()}
            disabled={updatesLoading}
          >
            ⟳ {t("updates.refresh")}
          </Button>
          {cliUpdates.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              loading={busy === "__all__"}
              disabled={busy !== null}
              onClick={() => void updateAll()}
            >
              {t("updates.updateAll")}
            </Button>
          )}
        </div>
      </header>

      <section className="cd-updates-overview" aria-labelledby="updates-overview-title" aria-live="polite">
        <div className="cd-updates-overview__lead">
          <span className="cd-updates-overview__eyebrow">{t("updates.overviewEyebrow")}</span>
          <strong id="updates-overview-title">
            {updatesLoading
              ? t("updates.refreshing")
              : total > 0
                ? t("updates.overviewAttention", { count: total })
                : t("updates.overviewReady")}
          </strong>
          <span>{t("updates.overviewHint")}</span>
        </div>
        <div className="cd-updates-overview__metrics">
          <div><strong>{availableUpdates}</strong><span>{t("updates.metricUpdates")}</span></div>
          <div><strong>{requiredInstalls}</strong><span>{t("updates.metricInstalls")}</span></div>
          <div><strong>3/3</strong><span>{t("updates.metricTrust")}</span></div>
          <div><strong className="cd-updates-overview__date">{checkedAt}</strong><span>{t("updates.metricChecked")}</span></div>
        </div>
      </section>

      {error && <Banner variant="err">{error}</Banner>}

      {updatesLoading && (
        <div className="cd-page__grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={72} />
          ))}
        </div>
      )}

      {/* App self-update section */}
      <AppUpdater />

      {!updatesLoading && total === 0 && (
        <EmptyState
          art={ART_CHECK}
          title={t("updates.noUpdates")}
          description={t("updates.noUpdatesHint")}
        />
      )}

      {!updatesLoading && cliUpdates.length > 0 && (
        <Section title={t("updates.cliUpdates")}>
          {cliUpdates.map((u) => {
            const k = u.key ?? u.cli;
            return (
              <Row
                key={k}
                name={u.cli}
                detail={`${u.current ?? "?"} → ${u.latest ?? "?"}`}
                actionLabel={t("updates.update")}
                loadingLabel={t("updates.updating")}
                busy={busy === `cli:${k}`}
                disabled={busy !== null}
                onAction={() => void run(`cli:${k}`, "update_cli", { cliKey: k })}
              />
            );
          })}
        </Section>
      )}

      {!updatesLoading && toolUpdates.length > 0 && (
        <Section title={t("updates.toolUpdates")}>
          {toolUpdates.map((u) => {
            const k = u.key ?? u.cli;
            return (
              <Row
                key={k}
                name={u.cli}
                detail={`${u.current ?? "?"} → ${u.latest ?? "?"}`}
                actionLabel={t("updates.update")}
                loadingLabel={t("updates.updating")}
                busy={busy === `tool:${k}`}
                disabled={busy !== null}
                onAction={() => void run(`tool:${k}`, "install_tool", { toolKey: k })}
              />
            );
          })}
        </Section>
      )}

      {!updatesLoading && envUpdates.length > 0 && (
        <Section title={t("updates.envUpdates")}>
          {envUpdates.map((u) => {
            const k = u.key ?? u.cli;
            return (
              <Row
                key={k}
                name={u.cli}
                detail={`${u.current ?? "?"} → ${u.latest ?? "?"}`}
                actionLabel={t("updates.update")}
                loadingLabel={t("updates.updating")}
                busy={busy === `env:${k}`}
                disabled={busy !== null}
                onAction={() => void run(`env:${k}`, "install_prerequisite", { key: k })}
              />
            );
          })}
        </Section>
      )}

      {!updatesLoading && missingPrereqs.length > 0 && (
        <Section title={t("updates.missingPrereqs")}>
          {missingPrereqs.map((p) => (
            <Row
              key={p.key}
              name={p.name}
              detail={p.install_command ?? ""}
              actionLabel={t("updates.install")}
              loadingLabel={t("updates.installing")}
              busy={busy === `prereq:${p.key}`}
              disabled={busy !== null}
              onAction={() => void run(`prereq:${p.key}`, "install_prerequisite", { key: p.key })}
            />
          ))}
        </Section>
      )}

      {!updatesLoading && missingClis.length > 0 && (
        <Section title={t("updates.missingClis")}>
          {missingClis.map((c) => (
            <Row
              key={c.key}
              name={c.name}
              detail={c.command}
              actionLabel={t("updates.install")}
              loadingLabel={t("updates.installing")}
              busy={busy === `cli-install:${c.key}`}
              disabled={busy !== null}
              onAction={() => void run(`cli-install:${c.key}`, "install_cli", { cliKey: c.key, timeoutSec: null })}
            />
          ))}
        </Section>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cd-updates__section">
      <h2 className="cd-updates__section-title">{title}</h2>
      <div className="cd-updates__list">{children}</div>
    </section>
  );
}

interface RowProps {
  name: string;
  detail: string;
  actionLabel: string;
  loadingLabel: string;
  busy: boolean;
  disabled: boolean;
  onAction: () => void;
}

function Row({ name, detail, actionLabel, loadingLabel, busy, disabled, onAction }: RowProps) {
  return (
    <div className="cd-updates__row" data-busy={busy || undefined}>
      <div className="cd-updates__row-info">
        <span className="cd-updates__row-name">{name}</span>
        <span className="cd-updates__row-detail">{detail}</span>
      </div>
      <Button size="sm" variant="primary" loading={busy} disabled={disabled} onClick={onAction}>
        {busy ? loadingLabel : actionLabel}
      </Button>
    </div>
  );
}
