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

  const [order, setOrderState] = useState<string[]>(() => {
    const saved = localStorage.getItem("ai-launcher:cli-order");
    return saved ? (JSON.parse(saved) as string[]) : [];
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
    localStorage.setItem("ai-launcher:cli-order", JSON.stringify(nextKeys));
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
            <Skeleton key={i} variant="card" height={200} />
          ))}
        </div>
      )}

      {!loading && allCount === 0 && (
        <EmptyState
          art={ART_TERMINAL}
          title={t("launcher.empty")}
          description={t(
            "launcher.emptyHint",
            "Install Claude, Codex, or add a custom CLI to get started.",
          )}
        />
      )}

      {!loading && allCount > 0 && (
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
