import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invokeOrFallback } from "../../lib/tauri";
import type { AgentProfile, WorkspaceProfile } from "../../domain/types";
import {
  addWorkspace,
  exportWorkspaces,
  getActiveWorkspace,
  getActiveWorkspaceId,
  generateWorkspaceId,
  importWorkspaces,
  loadWorkspaces,
  removeWorkspace,
  setActiveWorkspaceId,
  togglePin,
  updateWorkspace,
} from "./workspaceStore";
import { getRunbooks } from "./runbookStore";
import { RunbooksPanel } from "./RunbooksPanel";
import {
  addAgentProfile,
  generateAgentProfileId,
  getActiveAgentProfileId,
  loadAgentProfiles,
  normalizeAgentProfile,
  removeAgentProfile,
  setActiveAgentProfileId,
  toggleAgentProfilePin,
  updateAgentProfile,
} from "../agents/agentProfileStore";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { showToast } from "../../ui/toastStore";
import type { HistoryItem } from "../history/useHistory";
import { useHistory } from "../history/useHistory";
import { useUsage } from "../costs/useUsage";
import { getAllBudgetUsage, type BudgetUsage } from "../../providers/budget";
import type { PrereqCheck } from "../prereqs/usePrerequisites";
import type { TabId } from "../../app/layout/TabId";
import "../page.css";
import "./WorkspacePage.css";

type DoctorSeverity = "critical" | "warning" | "info";
const CRITICAL_NAMES = new Set(["node", "node.js", "git"]);
const WARNING_NAMES = new Set([
  "python",
  "python3",
  "rust",
  "rustc",
  "pnpm",
  "yarn",
  "bun",
]);

function classifySeverity(name: string): DoctorSeverity {
  const lower = name.toLowerCase();
  if (CRITICAL_NAMES.has(lower)) return "critical";
  if (WARNING_NAMES.has(lower)) return "warning";
  return "info";
}

interface WorkspacePageProps {
  historyItems?: HistoryItem[];
  onNavigate?: (tab: TabId) => void;
}

export function WorkspacePage({ historyItems, onNavigate }: WorkspacePageProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => loadWorkspaces());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveWorkspaceId());
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>(() => loadAgentProfiles());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(() =>
    getActiveAgentProfileId(),
  );
  const [editing, setEditing] = useState<WorkspaceProfile | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [showRunbooks, setShowRunbooks] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProfile | null>(null);
  const [deleteAgentTarget, setDeleteAgentTarget] = useState<AgentProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleActivate = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveId(id);
  }, []);

  const handleDeactivate = useCallback(() => {
    setActiveWorkspaceId(null);
    setActiveId(null);
  }, []);

  const handleActivateAgent = useCallback((id: string) => {
    setActiveAgentProfileId(id);
    setActiveAgentId(id);
  }, []);

  const handleDeactivateAgent = useCallback(() => {
    setActiveAgentProfileId(null);
    setActiveAgentId(null);
  }, []);

  const executeDelete = useCallback(
    (id: string) => {
      setProfiles((prev) => removeWorkspace(prev, id));
      if (activeId === id) setActiveId(null);
      showToast(t("workspace.toastDeleted"), "success");
    },
    [activeId, t],
  );

  const handleTogglePin = useCallback((id: string) => {
    setProfiles((prev) => togglePin(prev, id));
  }, []);

  const handleSave = useCallback((profile: WorkspaceProfile) => {
    const isNew = !profiles.some((p) => p.id === profile.id);
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      return exists ? updateWorkspace(prev, profile.id, profile) : addWorkspace(prev, profile);
    });
    setEditing(null);
    setCreating(false);
    showToast(t(isNew ? "workspace.toastCreated" : "workspace.toastSaved"), "success");
  }, [profiles, t]);

  const handleCreateFromHistory = useCallback((item: HistoryItem) => {
    const now = new Date().toISOString();
    const profile: WorkspaceProfile = {
      id: generateWorkspaceId(),
      name: `${item.cli} - ${item.directory.split(/[/\\]/).pop() ?? "workspace"}`,
      description: item.description,
      directory: item.directory,
      cliKeys: item.cliKey ? [item.cliKey] : [],
      providerKey: item.providerId,
      envVars: {},
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setProfiles((prev) => addWorkspace(prev, profile));
    showToast(t("workspace.toastCreated"), "success");
  }, [t]);

  const handleNew = useCallback(() => {
    const now = new Date().toISOString();
    setEditing({
      id: generateWorkspaceId(),
      name: "",
      directory: "",
      cliKeys: [],
      envVars: {},
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    setCreating(true);
  }, []);

  const handleNewAgent = useCallback(() => {
    const now = new Date().toISOString();
    setEditingAgent({
      id: generateAgentProfileId(),
      name: "",
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    setCreatingAgent(true);
  }, []);

  const handleSaveAgent = useCallback(
    (profile: AgentProfile) => {
      const normalized = normalizeAgentProfile(profile);
      const isNew = !agentProfiles.some((item) => item.id === normalized.id);
      setAgentProfiles((prev) =>
        isNew
          ? addAgentProfile(prev, normalized)
          : updateAgentProfile(prev, normalized.id, normalized),
      );
      setEditingAgent(null);
      setCreatingAgent(false);
      showToast(
        t(isNew ? "workspace.agentToastCreated" : "workspace.agentToastSaved"),
        "success",
      );
    },
    [agentProfiles, t],
  );

  const executeDeleteAgent = useCallback(
    (id: string) => {
      setAgentProfiles((prev) => removeAgentProfile(prev, id));
      if (activeAgentId === id) setActiveAgentId(null);
      showToast(t("workspace.agentToastDeleted"), "success");
    },
    [activeAgentId, t],
  );

  const handleToggleAgentPin = useCallback((id: string) => {
    setAgentProfiles((prev) => toggleAgentProfilePin(prev, id));
  }, []);

  const handleExport = useCallback(() => {
    const json = exportWorkspaces(profiles);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-launcher-workspaces.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("workspace.toastExported"), "success");
  }, [profiles, t]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const merged = importWorkspaces(profiles, text);
        if (merged) {
          setProfiles(merged);
          showToast(t("workspace.toastImported"), "success");
        } else {
          showToast(t("workspace.toastImportFailed"), "error");
        }
      };
      reader.onerror = () => showToast(t("workspace.toastImportFailed"), "error");
      void reader.readAsText(file);
      e.target.value = "";
    },
    [profiles, t],
  );

  const activeProfile = getActiveWorkspace(profiles);
  const activeAgent = activeAgentId
    ? agentProfiles.find((profile) => profile.id === activeAgentId) ?? null
    : null;

  if (showRunbooks) {
    return (
      <section className="cd-page cd-ws">
        <RunbooksPanel
          cwd={activeProfile?.directory}
          onClose={() => setShowRunbooks(false)}
        />
      </section>
    );
  }

  if (editing) {
    return (
      <WorkspaceForm
        initial={editing}
        isNew={creating}
        onSave={handleSave}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    );
  }

  if (editingAgent) {
    return (
      <AgentProfileForm
        initial={editingAgent}
        isNew={creatingAgent}
        onSave={handleSaveAgent}
        onCancel={() => {
          setEditingAgent(null);
          setCreatingAgent(false);
        }}
      />
    );
  }

  const pinned = profiles.filter((p) => p.pinned);
  const unpinned = profiles.filter((p) => !p.pinned);
  const sorted = [...pinned, ...unpinned];

  return (
    <section className="cd-page cd-ws">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("workspace.title")}</h1>
          <p className="cd-page__sub">{t("workspace.subtitle")}</p>
        </div>
        <div className="cd-ws__actions">
          <button type="button" className="cd-ws__btn" onClick={handleNew}>
            {t("workspace.new")}
          </button>
          <button type="button" className="cd-ws__btn cd-ws__btn--ghost" onClick={handleExport}>
            {t("workspace.export")}
          </button>
          <button
            type="button"
            className="cd-ws__btn cd-ws__btn--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("workspace.import")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="cd-ws__file-input"
            onChange={handleImport}
          />
        </div>
      </header>

      {activeProfile && (
        <div className="cd-ws__active">
          <span className="cd-ws__active-label">{t("workspace.active")}</span>
          <span className="cd-ws__active-name">{activeProfile.name}</span>
          <span className="cd-ws__active-dir">{activeProfile.directory}</span>
          <button
            type="button"
            className="cd-ws__btn cd-ws__btn--ghost cd-ws__btn--sm"
            onClick={handleDeactivate}
          >
            {t("workspace.deactivate")}
          </button>
        </div>
      )}

      {activeAgent && (
        <div className="cd-ws__active cd-ws__active--agent">
          <span className="cd-ws__active-label">{t("workspace.activeAgent")}</span>
          <span className="cd-ws__active-name">{activeAgent.name}</span>
          <span className="cd-ws__active-dir">
            {[activeAgent.cliKey, activeAgent.runbookId, activeAgent.args].filter(Boolean).join(" · ")}
          </span>
          <button
            type="button"
            className="cd-ws__btn cd-ws__btn--ghost cd-ws__btn--sm"
            onClick={handleDeactivateAgent}
          >
            {t("workspace.deactivate")}
          </button>
        </div>
      )}

      <div className="cd-ws-bento">
        <ProfilesCard
          profiles={sorted}
          pinnedCount={pinned.length}
          activeId={activeId}
          historyItems={historyItems}
          onActivate={handleActivate}
          onEdit={(p) => {
            setEditing(p);
            setCreating(false);
          }}
          onDelete={(id) => setDeleteTarget(profiles.find((p) => p.id === id) ?? null)}
          onTogglePin={handleTogglePin}
          onNew={handleNew}
          onCreateFromHistory={handleCreateFromHistory}
        />

        <BudgetSummaryCard onNavigate={onNavigate} />

        <AgentProfilesCard
          profiles={[...agentProfiles.filter((p) => p.pinned), ...agentProfiles.filter((p) => !p.pinned)]}
          activeId={activeAgentId}
          onActivate={handleActivateAgent}
          onEdit={(profile) => {
            setEditingAgent(profile);
            setCreatingAgent(false);
          }}
          onDelete={(id) =>
            setDeleteAgentTarget(agentProfiles.find((profile) => profile.id === id) ?? null)
          }
          onTogglePin={handleToggleAgentPin}
          onNew={handleNewAgent}
        />

        <div className="cd-ws-bento__row">
          <DoctorSummaryCard onNavigate={onNavigate} />
          <RunbooksCard onOpen={() => setShowRunbooks(true)} />
          <RecentSessionsCard onNavigate={onNavigate} />
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title={t("workspace.deleteTitle")}
        message={t("workspace.deleteMessage", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          if (deleteTarget) executeDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deleteAgentTarget !== null}
        variant="danger"
        title={t("workspace.agentDeleteTitle")}
        message={t("workspace.agentDeleteMessage", { name: deleteAgentTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          if (deleteAgentTarget) executeDeleteAgent(deleteAgentTarget.id);
          setDeleteAgentTarget(null);
        }}
        onCancel={() => setDeleteAgentTarget(null)}
      />
    </section>
  );
}

// --- Bento Card shell --------------------------------------------------------

interface BentoCardProps {
  area: string;
  title: string;
  meta?: string;
  onActivate?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function BentoCard({ area, title, meta, onActivate, children, footer }: BentoCardProps) {
  const interactive = Boolean(onActivate);
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onActivate) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
  return (
    <div
      className={`cd-ws-bento__card cd-ws-bento__card--${area}${interactive ? " cd-ws-bento__card--interactive" : ""}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={interactive ? handleKey : undefined}
    >
      <div className="cd-ws-bento__head">
        <span className="cd-ws-bento__title">{title}</span>
        {meta && <span className="cd-ws-bento__meta">{meta}</span>}
      </div>
      <div className="cd-ws-bento__body">{children}</div>
      {footer && <div className="cd-ws-bento__foot">{footer}</div>}
    </div>
  );
}

// --- Profiles Card (large) ---------------------------------------------------

interface ProfilesCardProps {
  profiles: WorkspaceProfile[];
  pinnedCount: number;
  activeId: string | null;
  historyItems?: HistoryItem[];
  onActivate: (id: string) => void;
  onEdit: (profile: WorkspaceProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNew: () => void;
  onCreateFromHistory: (item: HistoryItem) => void;
}

function ProfilesCard({
  profiles,
  pinnedCount,
  activeId,
  historyItems,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
  onNew,
  onCreateFromHistory,
}: ProfilesCardProps) {
  const { t } = useTranslation();
  const meta = t("workspace.profilesMeta", {
    total: profiles.length,
    pinned: pinnedCount,
  });

  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={onNew}>
      + {t("workspace.new")}
    </button>
  );

  return (
    <BentoCard area="profiles" title={t("workspace.profilesTitle")} meta={meta} footer={footer}>
      {profiles.length === 0 ? (
        <div className="cd-ws-bento__empty">
          <p>{t("workspace.empty")}</p>
          {historyItems && historyItems.length > 0 && (
            <>
              <p className="cd-ws-bento__empty-hint">{t("workspace.createFromHistory")}</p>
              <div className="cd-ws-bento__history-list">
                {historyItems.slice(0, 5).map((item, i) => (
                  <button
                    key={`${item.cliKey}-${item.timestamp}-${i}`}
                    type="button"
                    className="cd-ws-bento__history-item"
                    onClick={() => onCreateFromHistory(item)}
                  >
                    <span className="cd-ws-bento__history-cli">{item.cli}</span>
                    <span className="cd-ws-bento__history-dir">{item.directory}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="cd-ws-bento__profiles">
          {profiles.map((profile) => (
            <WorkspaceCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              onActivate={onActivate}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </BentoCard>
  );
}

// --- Agent Profiles Card -----------------------------------------------------

interface AgentProfilesCardProps {
  profiles: AgentProfile[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNew: () => void;
}

function AgentProfilesCard({
  profiles,
  activeId,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
  onNew,
}: AgentProfilesCardProps) {
  const { t } = useTranslation();
  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={onNew}>
      + {t("workspace.agentNew")}
    </button>
  );

  return (
    <BentoCard
      area="agents"
      title={t("workspace.agentProfilesTitle")}
      meta={t("workspace.totalMeta", { count: profiles.length })}
      footer={footer}
    >
      {profiles.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.agentProfilesEmpty")}</p>
      ) : (
        <div className="cd-ws-agent-list">
          {profiles.map((profile) => (
            <AgentProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              onActivate={onActivate}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </BentoCard>
  );
}

interface AgentProfileCardProps {
  profile: AgentProfile;
  isActive: boolean;
  onActivate: (id: string) => void;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function AgentProfileCard({
  profile,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
}: AgentProfileCardProps) {
  const { t } = useTranslation();
  const summary = [
    profile.cliKey || t("workspace.agentDefaultCli"),
    profile.providerKey,
    profile.runbookId,
  ].filter(Boolean);

  return (
    <div className={`cd-ws-agent${isActive ? " cd-ws-agent--active" : ""}`}>
      <div className="cd-ws-agent__head">
        <span className="cd-ws-agent__name">
          {profile.pinned && <span className="cd-ws-card__pin-mark">★ </span>}
          {profile.name}
        </span>
        <button
          type="button"
          className="cd-ws-card__pin"
          onClick={() => onTogglePin(profile.id)}
          title={profile.pinned ? t("workspace.unpin") : t("workspace.pin")}
        >
          {profile.pinned ? "★" : "☆"}
        </button>
      </div>
      {profile.description && <p className="cd-ws-agent__desc">{profile.description}</p>}
      <p className="cd-ws-agent__meta">{summary.join(" · ")}</p>
      {profile.args && <code className="cd-ws-agent__args">{profile.args}</code>}
      {profile.tags.length > 0 && (
        <div className="cd-ws-agent__tags">
          {profile.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
      <div className="cd-ws-card__foot">
        {isActive ? (
          <span className="cd-ws-card__active-badge">{t("workspace.active")}</span>
        ) : (
          <button
            type="button"
            className="cd-ws-card__activate"
            onClick={() => onActivate(profile.id)}
          >
            {t("workspace.activate")}
          </button>
        )}
        <button type="button" className="cd-ws-card__edit" onClick={() => onEdit(profile)}>
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="cd-ws-card__delete"
          onClick={() => onDelete(profile.id)}
        >
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

// --- Budget Card (small) -----------------------------------------------------

function BudgetSummaryCard({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { t } = useTranslation();
  const { report } = useUsage();
  const entries = report?.entries ?? [];
  const usages = useMemo<BudgetUsage[]>(() => getAllBudgetUsage(entries), [entries]);

  const totalUsed = usages.reduce((s, u) => s + u.usedUsd, 0);
  const totalLimit = usages.reduce((s, u) => s + u.limitUsd, 0);
  const exceeded = usages.filter((u) => u.status === "exceeded").length;

  const meta = usages.length > 0
    ? `$${totalUsed.toFixed(2)} / $${totalLimit.toFixed(2)}`
    : t("workspace.noBudgetLimits");

  const handleActivate = onNavigate ? () => onNavigate("costs") : undefined;

  return (
    <BentoCard area="budget" title={t("workspace.budgetTitle")} meta={meta} onActivate={handleActivate}>
      {usages.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__budget-list">
          {usages.slice(0, 4).map((u) => {
            const pct = Math.min(u.percentUsed, 100);
            const statusClass = `cd-ws-bento__budget--${u.status}`;
            return (
              <li key={u.providerKey} className={`cd-ws-bento__budget-item ${statusClass}`}>
                <div className="cd-ws-bento__budget-row">
                  <span className="cd-ws-bento__budget-name">{u.providerKey}</span>
                  <span className="cd-ws-bento__budget-val">
                    ${u.usedUsd.toFixed(2)} / ${u.limitUsd.toFixed(2)}
                  </span>
                </div>
                <div className="cd-ws-bento__budget-track">
                  <div
                    className="cd-ws-bento__budget-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          {exceeded > 0 && (
            <li className="cd-ws-bento__budget-alert">
              {t("workspace.overLimit", { count: exceeded })}
            </li>
          )}
        </ul>
      )}
    </BentoCard>
  );
}

// --- Doctor Card (medium) ----------------------------------------------------

function DoctorSummaryCard({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
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

  const counts = useMemo(() => {
    const missing = items.filter((c) => !c.installed);
    let critical = 0;
    let warning = 0;
    let info = 0;
    for (const c of missing) {
      const sev = classifySeverity(c.name);
      if (sev === "critical") critical += 1;
      else if (sev === "warning") warning += 1;
      else info += 1;
    }
    return { critical, warning, info, missing: missing.length, total: items.length };
  }, [items]);

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

// --- Runbooks Card (medium) --------------------------------------------------

function RunbooksCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const runbooks = getRunbooks();

  const handleManage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpen();
    },
    [onOpen],
  );

  const meta = t("workspace.totalMeta", { count: runbooks.length });

  const footer = (
    <button type="button" className="cd-ws-bento__btn" onClick={handleManage}>
      {t("runbook.manage")}
    </button>
  );

  return (
    <BentoCard
      area="runbooks"
      title={t("workspace.runbooksTitle")}
      meta={meta}
      onActivate={onOpen}
      footer={footer}
    >
      {runbooks.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__runbook-list">
          {runbooks.slice(0, 5).map((rb) => (
            <li key={rb.id} className="cd-ws-bento__runbook-item">
              <span className="cd-ws-bento__runbook-name">{rb.name}</span>
              <span className="cd-ws-bento__runbook-steps">
                {t("runbook.stepsCount", { count: rb.steps.length })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

// --- Recent Sessions Card (medium) -------------------------------------------

function RecentSessionsCard({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { t } = useTranslation();
  const { items } = useHistory();
  const recent = items.slice(0, 5);
  const meta = t("workspace.totalMeta", { count: items.length });
  const handleActivate = onNavigate ? () => onNavigate("history") : undefined;

  return (
    <BentoCard
      area="sessions"
      title={t("workspace.sessionsTitle")}
      meta={meta}
      onActivate={handleActivate}
    >
      {recent.length === 0 ? (
        <p className="cd-ws-bento__dim">{t("workspace.nothingYet")}</p>
      ) : (
        <ul className="cd-ws-bento__session-list">
          {recent.map((item, i) => (
            <li
              key={`${item.sessionId ?? item.cliKey}-${item.timestamp}-${i}`}
              className="cd-ws-bento__session-item"
            >
              <span className={`cd-ws-bento__session-dot cd-ws-bento__session-dot--${item.status}`} />
              <span className="cd-ws-bento__session-cli">{item.cli}</span>
              <span className="cd-ws-bento__session-time">{timeAgo(item.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

// --- Workspace Card (reused from prior UI) -----------------------------------

interface WorkspaceCardProps {
  profile: WorkspaceProfile;
  isActive: boolean;
  onActivate: (id: string) => void;
  onEdit: (profile: WorkspaceProfile) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function WorkspaceCard({
  profile,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onTogglePin,
}: WorkspaceCardProps) {
  const { t } = useTranslation();

  return (
    <div className={`cd-ws-card${isActive ? " cd-ws-card--active" : ""}`}>
      <div className="cd-ws-card__head">
        <span className="cd-ws-card__name">
          {profile.pinned && <span className="cd-ws-card__pin-mark">★ </span>}
          {profile.name}
        </span>
        <button
          type="button"
          className="cd-ws-card__pin"
          onClick={() => onTogglePin(profile.id)}
          title={profile.pinned ? t("workspace.unpin") : t("workspace.pin")}
        >
          {profile.pinned ? "★" : "☆"}
        </button>
      </div>
      {profile.description && (
        <div className="cd-ws-card__desc">{profile.description}</div>
      )}
      <div className="cd-ws-card__dir">{profile.directory}</div>
      <div className="cd-ws-card__clis">
        {profile.cliKeys.map((key) => (
          <span key={key} className="cd-ws-card__cli-tag">
            {key}
          </span>
        ))}
      </div>
      {profile.providerKey && (
        <div className="cd-ws-card__provider">{profile.providerKey}</div>
      )}
      <div className="cd-ws-card__foot">
        {isActive ? (
          <span className="cd-ws-card__active-badge">{t("workspace.active")}</span>
        ) : (
          <button
            type="button"
            className="cd-ws-card__activate"
            onClick={() => onActivate(profile.id)}
          >
            {t("workspace.activate")}
          </button>
        )}
        <button
          type="button"
          className="cd-ws-card__edit"
          onClick={() => onEdit(profile)}
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="cd-ws-card__delete"
          onClick={() => onDelete(profile.id)}
        >
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

// --- Workspace Form ----------------------------------------------------------

interface WorkspaceFormProps {
  initial: WorkspaceProfile;
  isNew: boolean;
  onSave: (profile: WorkspaceProfile) => void;
  onCancel: () => void;
}

function WorkspaceForm({ initial, isNew, onSave, onCancel }: WorkspaceFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<WorkspaceProfile>({ ...initial });
  const [envKey, setEnvKey] = useState("");
  const [envVal, setEnvVal] = useState("");

  const setField = <K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddEnv = () => {
    const key = envKey.trim();
    if (!key) return;
    setForm((prev) => ({
      ...prev,
      envVars: { ...prev.envVars, [key]: envVal },
    }));
    setEnvKey("");
    setEnvVal("");
  };

  const handleRemoveEnv = (key: string) => {
    setForm((prev) => {
      const { [key]: _removed, ...rest } = prev.envVars;
      return { ...prev, envVars: rest };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.directory.trim()) return;
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="cd-ws-form">
      <header className="cd-ws-form__head">
        <h2 className="cd-ws-form__title">
          {isNew ? t("workspace.newTitle") : t("workspace.editTitle")}
        </h2>
      </header>

      <form className="cd-ws-form__body" onSubmit={handleSubmit}>
        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.nameLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.descriptionLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.description ?? ""}
            onChange={(e) => setField("description", e.target.value || undefined)}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.directoryLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.directory}
            onChange={(e) => setField("directory", e.target.value)}
            required
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.providerLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.providerKey ?? ""}
            onChange={(e) => setField("providerKey", e.target.value || undefined)}
            placeholder={t("workspace.providerPlaceholder")}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.tagsLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.tags.join(", ")}
            onChange={(e) =>
              setField(
                "tags",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder={t("workspace.tagsPlaceholder")}
          />
        </label>

        <fieldset className="cd-ws-form__env">
          <legend className="cd-ws-form__label">{t("workspace.envVarsLabel")}</legend>
          <div className="cd-ws-form__env-row">
            <input
              className="cd-ws-form__input cd-ws-form__input--sm"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="KEY"
            />
            <input
              className="cd-ws-form__input cd-ws-form__input--sm"
              value={envVal}
              onChange={(e) => setEnvVal(e.target.value)}
              placeholder="value"
            />
            <button type="button" className="cd-ws-form__env-add" onClick={handleAddEnv}>
              {t("common.add")}
            </button>
          </div>
          {Object.entries(form.envVars).map(([key, val]) => (
            <div key={key} className="cd-ws-form__env-entry">
              <span className="cd-ws-form__env-key">{key}</span>
              <span className="cd-ws-form__env-val">{val}</span>
              <button
                type="button"
                className="cd-ws-form__env-remove"
                onClick={() => handleRemoveEnv(key)}
              >
                {t("common.remove")}
              </button>
            </div>
          ))}
        </fieldset>

        <div className="cd-ws-form__foot">
          <button type="submit" className="cd-ws-form__save">
            {t("common.save")}
          </button>
          <button type="button" className="cd-ws-form__cancel" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}

// --- Agent Profile Form ------------------------------------------------------

interface AgentProfileFormProps {
  initial: AgentProfile;
  isNew: boolean;
  onSave: (profile: AgentProfile) => void;
  onCancel: () => void;
}

function AgentProfileForm({ initial, isNew, onSave, onCancel }: AgentProfileFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AgentProfile>({ ...initial });
  const runbooks = useMemo(() => getRunbooks(), []);

  const setField = <K extends keyof AgentProfile>(key: K, value: AgentProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="cd-ws-form">
      <header className="cd-ws-form__head">
        <h2 className="cd-ws-form__title">
          {isNew ? t("workspace.agentNewTitle") : t("workspace.agentEditTitle")}
        </h2>
      </header>

      <form className="cd-ws-form__body" onSubmit={handleSubmit}>
        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.nameLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.descriptionLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.description ?? ""}
            onChange={(e) => setField("description", e.target.value || undefined)}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentCliLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.cliKey ?? ""}
            onChange={(e) => setField("cliKey", e.target.value || undefined)}
            placeholder="claude"
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.providerLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.providerKey ?? ""}
            onChange={(e) => setField("providerKey", e.target.value || undefined)}
            placeholder={t("workspace.providerPlaceholder")}
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentArgsLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.args ?? ""}
            onChange={(e) => setField("args", e.target.value || undefined)}
            placeholder="--model gpt-5"
          />
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.agentRunbookLabel")}</span>
          <select
            className="cd-ws-form__input"
            value={form.runbookId ?? ""}
            onChange={(e) => setField("runbookId", e.target.value || undefined)}
          >
            <option value="">{t("workspace.agentNoRunbook")}</option>
            {runbooks.map((runbook) => (
              <option key={runbook.id} value={runbook.id}>
                {runbook.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cd-ws-form__field">
          <span className="cd-ws-form__label">{t("workspace.tagsLabel")}</span>
          <input
            className="cd-ws-form__input"
            value={form.tags.join(", ")}
            onChange={(e) =>
              setField(
                "tags",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder={t("workspace.tagsPlaceholder")}
          />
        </label>

        <div className="cd-ws-form__foot">
          <button type="submit" className="cd-ws-form__save">
            {t("common.save")}
          </button>
          <button type="button" className="cd-ws-form__cancel" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}
