import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Banner } from "../../ui/Banner";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { CliCard } from "./CliCard";
import { LaunchDialog } from "./LaunchDialog";
import { useClis, type CliInfo } from "./useClis";
import { useUpdates } from "../../hooks/useUpdates";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import {
  getTemplates,
  deleteTemplate,
  type SessionTemplate,
} from "./sessionTemplates";
import "../page.css";
import "./LauncherPage.css";

export function LauncherPage() {
  const { t } = useTranslation();
  const { clis, checks, loading, error, refresh } = useClis();
  const [launching, setLaunching] = useState<CliInfo | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const { summary: updates } = useUpdates();
  const [templates, setTemplates] = useState<SessionTemplate[]>(() =>
    getTemplates(),
  );
  const refreshTemplates = () => setTemplates(getTemplates());

  const cliHasUpdate = (name: string) =>
    updates?.cli_updates.some((u) => u.cli === name && u.has_update) ?? false;

  const onInstall = async (cli: CliInfo) => {
    setInstalling(cli.key);
    try {
      await invoke<string>("install_cli", { cliKey: cli.key, timeoutSec: null });
      void ensurePermissionThenNotify(
        t("notifications.installDone.title", { name: cli.name }),
        t("notifications.installDone.body"),
      );
      await refresh();
    } catch {
      // error surfaced in next refresh via CheckResult.missing
    } finally {
      setInstalling(null);
    }
  };

  const launchTemplate = async (tpl: SessionTemplate) => {
    try {
      await invoke("launch_cli", {
        cliKey: tpl.cliKey,
        directory: tpl.directory,
        args: tpl.args,
        noPerms: tpl.noPerms,
        envVars: null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("template launch failed", e);
    }
  };

  const installedCount = Object.values(checks).filter((c) => c.installed).length;

  return (
    <section className="cd-page cd-launcher">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("launcher.title")}</h2>
          <p className="cd-page__sub">
            {loading
              ? t("common.scanning")
              : t("launcher.installedCount", {
                  installed: installedCount,
                  total: clis.length,
                })}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading}
          title={t("launcher.rescanTip")}
        >
          ⟳ {t("common.rescan")}
        </Button>
      </header>

      {error && <Banner variant="err">{error}</Banner>}

      {templates.length > 0 && (
        <div className="cd-launcher__templates">
          <h3 className="cd-launcher__section-title">
            {t("launcher.templates")}
          </h3>
          <div className="cd-launcher__templates-grid">
            {templates.map((tpl) => (
              <div key={tpl.id} className="cd-launcher__template-card">
                <div className="cd-launcher__template-name">{tpl.name}</div>
                <div
                  className="cd-launcher__template-meta"
                  title={`${tpl.cliName} · ${tpl.directory}`}
                >
                  {tpl.cliName} · {tpl.directory}
                </div>
                <div className="cd-launcher__template-actions">
                  <button
                    type="button"
                    className="cd-launcher__template-launch"
                    onClick={() => void launchTemplate(tpl)}
                  >
                    {t("launcher.launch")}
                  </button>
                  <button
                    type="button"
                    className="cd-launcher__template-delete"
                    onClick={() => {
                      if (
                        window.confirm(
                          t("launcher.deleteTemplateConfirm", {
                            name: tpl.name,
                          }),
                        )
                      ) {
                        deleteTemplate(tpl.id);
                        refreshTemplates();
                      }
                    }}
                    title={t("common.delete")}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="cd-page__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={92} />
          ))}
        </div>
      )}

      {!loading && clis.length === 0 && (
        <div className="cd-page__empty">{t("launcher.empty")}</div>
      )}

      {!loading && clis.length > 0 && (
        <div className="cd-page__grid">
          {clis.map((cli) => (
            <CliCard
              key={cli.key}
              cli={cli}
              check={checks[cli.name]}
              installing={installing === cli.key}
              hasUpdate={cliHasUpdate(cli.name)}
              onLaunch={setLaunching}
              onInstall={onInstall}
            />
          ))}
        </div>
      )}

      <LaunchDialog
        cli={launching}
        onClose={() => {
          setLaunching(null);
          refreshTemplates();
        }}
      />
    </section>
  );
}
