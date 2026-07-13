import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Banner } from "../../ui/Banner";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { EmptyState, ART_TERMINAL } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import { CliCard } from "./CliCard";
import { CustomCliCard } from "./CustomCliCard";
import { LaunchDialog } from "./LaunchDialog";
import { CustomCliLaunchDialog } from "./CustomCliLaunchDialog";
import { useClis, type CliInfo } from "./useClis";
import { useUpdates } from "../../hooks/useUpdates";
import { ensurePermissionThenNotify } from "../../lib/notifications";
import { readKey, writeKey } from "../../lib/storage";
import {
  loadProfiles,
  removeProfile,
} from "../../domain/profileStore";
import type { LaunchProfile } from "../../domain/types";
import type { CustomCli } from "../../lib/customClis";
import { launchCliSession, recordFailedLaunch, type LaunchableCli } from "./launchSession";
import { showToast } from "../../ui/toastStore";
import type { TabId } from "../../app/layout/TabId";
import { buildLauncherOverview } from "./launcherPageModel";
import "../page.css";
import "./LauncherPage.css";

interface LauncherPageProps {
  onNavigate?: (tab: TabId) => void;
}

export function LauncherPage({ onNavigate }: LauncherPageProps) {
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
  const [launchingProfileId, setLaunchingProfileId] = useState<string | null>(null);
  const refreshProfiles = () => setProfiles(loadProfiles());

  const updateNames = useMemo(
    () => new Set(updates?.cli_updates.filter((update) => update.has_update).map((update) => update.cli) ?? []),
    [updates],
  );
  const overview = useMemo(
    () => buildLauncherOverview(clis, customClis.length, checks, updateNames),
    [checks, clis, customClis.length, updateNames],
  );
  const allCount = overview.total;

  const cliHasUpdate = (name: string) =>
    updateNames.has(name);

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

  const resolveProfileCli = (profile: LaunchProfile): LaunchableCli | null => {
    const key = profile.cliKeys[0];
    if (!key) return null;
    const builtin = clis.find((c) => c.key === key);
    if (builtin) return { key: builtin.key, name: builtin.name };
    const custom = customClis.find((c) => c.key === key);
    if (custom) return { key: custom.key, name: custom.name };
    return { key, name: key };
  };

  const launchProfile = async (profile: LaunchProfile) => {
    const cli = resolveProfileCli(profile);
    if (!cli) {
      showToast(t("launcher.templateMissingCli"), "error");
      return;
    }
    if (!profile.directory?.trim()) {
      showToast(t("launchDialog.directoryRequired"), "error");
      return;
    }
    setLaunchingProfileId(profile.id);
    try {
      const result = await launchCliSession({
        cli,
        directory: profile.directory,
        args: profile.args ?? "",
        noPerms: profile.noPerms ?? true,
        providerId: profile.providerKey,
      });
      if (result.projectProfileError) {
        showToast(result.projectProfileError, "warning");
      }
      void ensurePermissionThenNotify(
        t("notifications.sessionStarted.title", { cli: cli.name }),
        t("notifications.sessionStarted.body", { dir: result.directory }),
      );
      showToast(t("launcher.templateLaunched", { name: profile.name }), "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      recordFailedLaunch(
        cli,
        profile.directory ?? "",
        profile.args ?? "",
        message,
        profile.providerKey,
      );
      showToast(message || t("launcher.templateLaunchFailed"), "error");
    } finally {
      setLaunchingProfileId(null);
    }
  };

  const [order, setOrderState] = useState<string[]>(() => {
    return readKey("cliOrder");
  });

  const sortedClis = useMemo(() => {
    const combined: Array<
      (CliInfo & { isCustom: false }) | (CustomCli & { isCustom: true })
    > = [
      ...clis.map((c) => ({ ...c, isCustom: false as const })),
      ...customClis.map((c) => ({ ...c, isCustom: true as const })),
    ];
    if (order.length === 0) return combined;
    return [...combined].sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [clis, customClis, order]);

  // dnd-kit usa o mesmo string key como ID — para custom CLIs prefixamos
  // `custom:` para evitar colisão com keys de CLIs builtin (defensive — keys
  // são distintas hoje, mas o prefix garante isolamento futuro).
  const dndId = (cli: { key: string; isCustom: boolean }) =>
    cli.isCustom ? `custom:${cli.key}` : cli.key;

  const sortableIds = useMemo(() => sortedClis.map(dndId), [sortedClis]);

  const persistOrder = useCallback((nextKeys: string[]) => {
    setOrderState(nextKeys);
    writeKey("cliOrder", nextKeys);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = sortableIds.indexOf(String(active.id));
      const newIdx = sortableIds.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;
      const nextIds = arrayMove(sortableIds, oldIdx, newIdx);
      // Reverter prefix `custom:` ao salvar — localStorage usa só a key crua.
      const nextKeys = nextIds.map((id) =>
        id.startsWith("custom:") ? id.slice("custom:".length) : id,
      );
      persistOrder(nextKeys);
    },
    [sortableIds, persistOrder],
  );

  return (
    <section className="cd-page cd-launcher">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("launcher.title")}</h1>
          <p className="cd-page__sub">
            {loading
              ? t("common.scanning")
              : t("launcher.installedCount", {
                  installed: overview.installed,
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

      {!loading && allCount > 0 && (
        <section className="cd-launcher-overview" aria-label={t("launcher.overviewLabel")}>
          <div className="cd-launcher-overview__lead">
            <span className="cd-launcher-overview__eyebrow">{t("launcher.readyToLaunch")}</span>
            <strong>{t("launcher.readyCount", { count: overview.installed })}</strong>
            <span>{t("launcher.readyHint")}</span>
          </div>
          <div className="cd-launcher-overview__metrics">
            <div><strong>{overview.total}</strong><span>{t("launcher.metricConfigured")}</span></div>
            <div><strong>{overview.missing}</strong><span>{t("launcher.metricMissing")}</span></div>
            <div><strong>{overview.updates}</strong><span>{t("launcher.metricUpdates")}</span></div>
          </div>
        </section>
      )}

      {error && (
        <Banner variant="err">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>{t("common.retry")}</Button>
        </Banner>
      )}

      {profiles.length > 0 && (
        <section className="cd-launcher__templates" aria-labelledby="launcher-templates-title">
          <div className="cd-launcher__section-head">
            <div>
              <h2 id="launcher-templates-title" className="cd-launcher__section-title">{t("launcher.templates")}</h2>
              <p>{t("launcher.templatesHint")}</p>
            </div>
            <span>{t("launcher.templateCount", { count: profiles.length })}</span>
          </div>
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
                  <Button
                    size="sm"
                    disabled={launchingProfileId === p.id}
                    onClick={() => void launchProfile(p)}
                  >
                    {launchingProfileId === p.id ? t("common.loading") : t("launcher.launch")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteProfile(p)}
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="cd-page__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={200} />
          ))}
        </div>
      )}

      {!loading && allCount === 0 && (
        <EmptyState
          art={ART_TERMINAL}
          title={t("launcher.empty")}
          description={t("launcher.emptyHint")}
          actions={
            onNavigate
              ? [
                  { label: t("launcher.emptyActionAdmin"), onClick: () => onNavigate("admin") },
                  { label: t("launcher.emptyActionDoctor"), onClick: () => onNavigate("doctor") },
                  { label: t("launcher.emptyActionPrereqs"), onClick: () => onNavigate("prereqs") },
                ]
              : undefined
          }
        />
      )}

      {!loading && allCount > 0 && (
        <section className="cd-launcher__catalog" aria-labelledby="launcher-catalog-title">
          <div className="cd-launcher__section-head">
            <div>
              <h2 id="launcher-catalog-title" className="cd-launcher__section-title">{t("launcher.catalogTitle")}</h2>
              <p>{t("launcher.catalogHint")}</p>
            </div>
            <span>{t("launcher.catalogCount", { count: allCount })}</span>
          </div>
          <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <div className="cd-page__grid">
              {sortedClis.map((cli) => {
                if (!cli.isCustom) {
                  const c = cli as CliInfo & { isCustom: false };
                  return (
                    <CliCard
                      key={c.key}
                      dndId={c.key}
                      cli={c}
                      check={checks[c.name]}
                      installing={installing === c.key}
                      hasUpdate={cliHasUpdate(c.name)}
                      onLaunch={setLaunching}
                      onInstall={onInstall}
                    />
                  );
                }
                const cc = cli as CustomCli & { isCustom: true };
                return (
                  <CustomCliCard
                    key={`custom-${cc.key}`}
                    dndId={`custom:${cc.key}`}
                    cli={cc}
                    onLaunch={setLaunchingCustom}
                  />
                );
              })}
            </div>
          </SortableContext>
          </DndContext>
        </section>
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
