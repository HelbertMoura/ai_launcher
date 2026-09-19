import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HistoryItem } from "../history/useHistory";
import { useHistory } from "../history/useHistory";
import type { TabId } from "../../app/layout/TabId";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { useAgentProfiles } from "./useAgentProfiles";
import { useWorkspaceProfiles } from "./useWorkspaceProfiles";
import { buildWorkspaceOverview } from "./workspaceOverviewModel";
import { RunbooksPanel } from "./RunbooksPanel";
import { AgentProfilesCard } from "./AgentProfilesCard";
import { BudgetSummaryCard } from "./BudgetSummaryCard";
import { DoctorSummaryCard } from "./DoctorSummaryCard";
import { ProfilesCard } from "./ProfilesCard";
import { RecentSessionsCard } from "./RecentSessionsCard";
import { RunbooksCard } from "./RunbooksCard";
import { AgentProfileForm } from "./AgentProfileForm";
import { WorkspaceForm } from "./WorkspaceForm";
import "../page.css";
import "./WorkspacePage.css";

interface WorkspacePageProps {
  historyItems?: HistoryItem[];
  onNavigate?: (tab: TabId) => void;
}

export function WorkspacePage({ historyItems, onNavigate }: WorkspacePageProps) {
  const { t } = useTranslation();
  const { items: storedHistoryItems } = useHistory();
  const resolvedHistoryItems = historyItems?.length ? historyItems : storedHistoryItems;
  const [showRunbooks, setShowRunbooks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    profiles,
    activeId,
    activeProfile,
    sortedProfiles,
    pinnedCount,
    editing,
    creating,
    deleteTarget,
    activate,
    deactivate,
    requestDelete,
    confirmDelete,
    cancelDelete,
    togglePin,
    save,
    startNew,
    startEdit,
    cancelEdit,
    createFromHistory,
    exportToFile,
    importFromFile,
  } = useWorkspaceProfiles();

  const {
    agentProfiles,
    activeAgentId,
    activeAgent,
    sortedAgents,
    editingAgent,
    creatingAgent,
    deleteAgentTarget,
    activateAgent,
    deactivateAgent,
    requestDeleteAgent,
    confirmDeleteAgent,
    cancelDeleteAgent,
    toggleAgentPin,
    saveAgent,
    startNewAgent,
    startEditAgent,
    cancelEditAgent,
  } = useAgentProfiles();

  const overview = buildWorkspaceOverview(
    profiles,
    agentProfiles,
    activeProfile,
    resolvedHistoryItems,
  );

  if (showRunbooks) {
    return (
      <section className="cd-page cd-ws">
        <RunbooksPanel
          cwd={activeProfile?.directory}
          workspaceId={activeProfile?.id}
          onNavigate={onNavigate}
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
        onSave={save}
        onCancel={cancelEdit}
      />
    );
  }

  if (editingAgent) {
    return (
      <AgentProfileForm
        initial={editingAgent}
        isNew={creatingAgent}
        onSave={saveAgent}
        onCancel={cancelEditAgent}
      />
    );
  }

  return (
    <section className="cd-page cd-ws">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("workspace.title")}</h1>
          <p className="cd-page__sub">{t("workspace.subtitle")}</p>
        </div>
        <div className="cd-ws__actions">
          <Button size="sm" onClick={startNew}>
            {t("workspace.new")}
          </Button>
          <Button size="sm" variant="ghost" onClick={exportToFile}>
            {t("workspace.export")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("workspace.import")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="cd-ws__file-input"
            onChange={importFromFile}
          />
        </div>
      </header>

      <section className="cd-ws-context" aria-label={t("workspace.operatingContext")}>
        <div className="cd-ws-context__main">
          <span className="cd-ws-context__eyebrow">{t("workspace.operatingContext")}</span>
          <strong>{activeProfile?.name ?? t("workspace.noActiveWorkspace")}</strong>
          <span className="cd-ws-context__path">
            {activeProfile?.directory ?? t("workspace.selectWorkspaceHint")}
          </span>
          <div className="cd-ws-context__agent">
            <span>{t("workspace.activeAgent")}</span>
            <strong>{activeAgent?.name ?? t("workspace.noActiveAgent")}</strong>
            {activeAgent && <code>{[activeAgent.cliKey, activeAgent.args].filter(Boolean).join(" · ")}</code>}
          </div>
        </div>
        <div className="cd-ws-context__metrics" aria-label={t("workspace.overviewLabel")}>
          <div><strong>{overview.profiles}</strong><span>{t("workspace.metricProfiles")}</span></div>
          <div><strong>{overview.agents}</strong><span>{t("workspace.metricAgents")}</span></div>
          <div><strong>{overview.activeSessions}</strong><span>{t("workspace.metricActiveSessions")}</span></div>
        </div>
        {(activeProfile || activeAgent) && (
          <div className="cd-ws-context__actions">
            {activeProfile && <Button size="sm" variant="ghost" onClick={deactivate}>{t("workspace.deactivateWorkspace")}</Button>}
            {activeAgent && <Button size="sm" variant="ghost" onClick={deactivateAgent}>{t("workspace.deactivateAgent")}</Button>}
          </div>
        )}
      </section>

      <div className="cd-ws-bento">
        <ProfilesCard
          profiles={sortedProfiles}
          pinnedCount={pinnedCount}
          activeId={activeId}
          historyItems={resolvedHistoryItems}
          onActivate={activate}
          onEdit={startEdit}
          onDelete={requestDelete}
          onTogglePin={togglePin}
          onNew={startNew}
          onCreateFromHistory={createFromHistory}
        />

        <BudgetSummaryCard onNavigate={onNavigate} />

        <AgentProfilesCard
          profiles={sortedAgents}
          activeId={activeAgentId}
          onActivate={activateAgent}
          onEdit={startEditAgent}
          onDelete={requestDeleteAgent}
          onTogglePin={toggleAgentPin}
          onNew={startNewAgent}
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
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <ConfirmDialog
        open={deleteAgentTarget !== null}
        variant="danger"
        title={t("workspace.agentDeleteTitle")}
        message={t("workspace.agentDeleteMessage", { name: deleteAgentTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={confirmDeleteAgent}
        onCancel={cancelDeleteAgent}
      />
    </section>
  );
}
