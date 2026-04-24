import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceProfile } from "../../domain/types";
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
import type { HistoryItem } from "../history/useHistory";
import "./WorkspacePage.css";

interface WorkspacePageProps {
  historyItems?: HistoryItem[];
}

export function WorkspacePage({ historyItems }: WorkspacePageProps) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => loadWorkspaces());
  const [activeId, setActiveId] = useState<string | null>(() => getActiveWorkspaceId());
  const [editing, setEditing] = useState<WorkspaceProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleActivate = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      setActiveId(id);
    },
    [],
  );

  const handleDeactivate = useCallback(() => {
    setActiveWorkspaceId(null);
    setActiveId(null);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setProfiles((prev) => removeWorkspace(prev, id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  const handleTogglePin = useCallback((id: string) => {
    setProfiles((prev) => togglePin(prev, id));
  }, []);

  const handleSave = useCallback(
    (profile: WorkspaceProfile) => {
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === profile.id);
        return exists ? updateWorkspace(prev, profile.id, profile) : addWorkspace(prev, profile);
      });
      setEditing(null);
      setCreating(false);
    },
    [],
  );

  const handleCreateFromHistory = useCallback(
    (item: HistoryItem) => {
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
    },
    [],
  );

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

  const handleExport = useCallback(() => {
    const json = exportWorkspaces(profiles);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-launcher-workspaces.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [profiles]);

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
        }
      };
      void reader.readAsText(file);
      // Reset so the same file can be re-imported
      e.target.value = "";
    },
    [profiles],
  );

  const activeProfile = getActiveWorkspace(profiles);

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

  const pinned = profiles.filter((p) => p.pinned);
  const unpinned = profiles.filter((p) => !p.pinned);
  const sorted = [...pinned, ...unpinned];

  return (
    <section className="cd-ws">
      <header className="cd-ws__head">
        <div>
          <h1 className="cd-ws__title">{t("workspace.title")}</h1>
          <p className="cd-ws__sub">{t("workspace.subtitle")}</p>
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
          <button type="button" className="cd-ws__btn cd-ws__btn--ghost cd-ws__btn--sm" onClick={handleDeactivate}>
            {t("workspace.deactivate")}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="cd-ws__empty">
          <p>{t("workspace.empty")}</p>
          {historyItems && historyItems.length > 0 && (
            <>
              <p className="cd-ws__empty-hint">{t("workspace.createFromHistory")}</p>
              <div className="cd-ws__history-list">
                {historyItems.slice(0, 5).map((item, i) => (
                  <button
                    key={`${item.cliKey}-${item.timestamp}-${i}`}
                    type="button"
                    className="cd-ws__history-item"
                    onClick={() => handleCreateFromHistory(item)}
                  >
                    <span className="cd-ws__history-cli">{item.cli}</span>
                    <span className="cd-ws__history-dir">{item.directory}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="cd-ws__grid">
          {sorted.map((profile) => (
            <WorkspaceCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              onActivate={handleActivate}
              onEdit={(p) => {
                setEditing(p);
                setCreating(false);
              }}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// --- Workspace Card ---

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
        <span className="cd-ws-card__name">{profile.name}</span>
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

// --- Workspace Form ---

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
      const { [key]: _, ...rest } = prev.envVars;
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
        <h1 className="cd-ws-form__title">
          {isNew ? t("workspace.newTitle") : t("workspace.editTitle")}
        </h1>
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
