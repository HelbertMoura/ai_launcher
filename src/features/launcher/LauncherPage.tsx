import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Banner } from "../../ui/Banner";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Skeleton } from "../../ui/Skeleton";
import { CliCard } from "./CliCard";
import { CustomCliCard } from "./CustomCliCard";
import { LaunchDialog } from "./LaunchDialog";
import { CustomCliLaunchDialog } from "./CustomCliLaunchDialog";
import { useClis, type CliInfo } from "./useClis";
import { useUpdates } from "../../hooks/useUpdates";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import {
  loadProfiles,
  removeProfile,
} from "../../domain/profileStore";
import type { LaunchProfile } from "../../domain/types";
import type { CustomCli } from "../../lib/customClis";
import "../page.css";
import "./LauncherPage.css";

export function LauncherPage() {
  const { t } = useTranslation();
  const { clis, checks, customClis, loading, error, refresh } = useClis();
  const [launching, setLaunching] = useState<CliInfo | null>(null);
  const [launchingCustom, setLaunchingCustom] = useState<CustomCli | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const { summary: updates } = useUpdates();
  const [profiles, setProfiles] = useState<LaunchProfile[]>(() =>
    loadProfiles(),
  );
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<LaunchProfile | null>(null);
  const refreshProfiles = () => setProfiles(loadProfiles());

  const allCount = clis.length + customClis.length;

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

  const launchProfile = async (profile: LaunchProfile) => {
    try {
      await invoke<{ session_id: string; message: string }>("launch_cli", {
        cliKey: profile.cliKeys[0] ?? "",
        directory: profile.directory ?? "",
        args: profile.args ?? "",
        noPerms: profile.noPerms ?? true,
        envVars: null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("profile launch failed", e);
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
                  total: allCount,
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

      {profiles.length > 0 && (
        <div className="cd-launcher__templates">
          <h3 className="cd-launcher__section-title">
            {t("launcher.templates")}
          </h3>
          <div className="cd-launcher__templates-grid">
            {profiles.map((p) => (
              <div key={p.id} className="cd-launcher__template-card">
                <div className="cd-launcher__template-name">{p.name}</div>
                <div
                  className="cd-launcher__template-meta"
                  title={`${p.cliKeys[0] ?? ""} · ${p.directory ?? ""}`}
                >
                  {p.cliKeys[0] ?? ""} · {p.directory ?? ""}
                </div>
                <div className="cd-launcher__template-actions">
                  <button
                    type="button"
                    className="cd-launcher__template-launch"
                    onClick={() => void launchProfile(p)}
                  >
                    {t("launcher.launch")}
                  </button>
                  <button
                    type="button"
                    className="cd-launcher__template-delete"
                    onClick={() => setConfirmDeleteProfile(p)}
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
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

      {!loading && allCount === 0 && (
        <div className="cd-page__empty">{t("launcher.empty")}</div>
      )}

      {!loading && allCount > 0 && (
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
          {customClis.map((ccli) => (
            <CustomCliCard
              key={`custom-${ccli.key}`}
              cli={ccli}
              onLaunch={setLaunchingCustom}
            />
          ))}
        </div>
      )}

      <LaunchDialog
        cli={launching}
        onClose={() => {
          setLaunching(null);
          refreshProfiles();
        }}
      />

      <CustomCliLaunchDialog
        cli={launchingCustom}
        onClose={() => setLaunchingCustom(null)}
      />

      <ConfirmDialog
        open={confirmDeleteProfile !== null}
        variant="danger"
        title={t("launcher.deleteTemplateTitle", "Delete Template")}
        message={t("launcher.deleteTemplateConfirm", {
          name: confirmDeleteProfile?.name ?? "",
        })}
        confirmLabel={t("common.delete", "Delete")}
        onConfirm={() => {
          if (confirmDeleteProfile) {
            setProfiles(removeProfile(profiles, confirmDeleteProfile.id));
          }
          setConfirmDeleteProfile(null);
        }}
        onCancel={() => setConfirmDeleteProfile(null)}
      />
    </section>
  );
}
