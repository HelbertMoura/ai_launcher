import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Chip } from "../../../ui/Chip";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import {
  loadProviders,
  loadProviderApiKey,
  removeProfile,
  saveProvidersSecure,
  setActive,
  upsertProfile,
  SECRET_KEY_MARKER,
} from "../../../providers/storage";
import type {
  ProviderProfile,
  ProvidersState,
} from "../../../providers/types";
import { ProviderEditor } from "../editors/ProviderEditor";

interface TestResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; ms: number }
  | { status: "err"; message: string };

export function ProvidersSection() {
  const { t } = useTranslation();
  const [state, setState] = useState<ProvidersState>(() => loadProviders());
  const [editing, setEditing] = useState<ProviderProfile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [confirmDelete, setConfirmDelete] = useState<ProviderProfile | null>(null);

  const existingIds = useMemo(
    () => state.profiles.map((p) => p.id),
    [state.profiles],
  );

  const refresh = () => setState(loadProviders());

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = async (profile: ProviderProfile) => {
    // Resolve API key from secure storage before opening the editor.
    const resolvedKey = await loadProviderApiKey(profile.id, profile.apiKey);
    setEditing({ ...profile, apiKey: resolvedKey });
    setEditorOpen(true);
  };

  const handleSave = (profile: ProviderProfile) => {
    const next = upsertProfile(state, profile);
    // Fire-and-forget secure save; state updates immediately for responsiveness.
    saveProvidersSecure(next);
    setState(next);
    setEditorOpen(false);
    setEditing(null);
  };

  const handleActivate = (id: string) => {
    const next = setActive(state, id);
    saveProvidersSecure(next);
    setState(next);
  };

  const handleDelete = (profile: ProviderProfile) => {
    if (profile.builtin) return;
    setConfirmDelete(profile);
  };

  const confirmDeleteProvider = () => {
    if (!confirmDelete) return;
    const next = removeProfile(state, confirmDelete.id);
    saveProvidersSecure(next);
    setState(next);
    setConfirmDelete(null);
  };

  const handleTest = async (profile: ProviderProfile) => {
    setTestStates((prev) => ({ ...prev, [profile.id]: { status: "testing" } }));
    try {
      // Resolve API key from secure storage if needed.
      const apiKey = profile.apiKey === SECRET_KEY_MARKER
        ? await loadProviderApiKey(profile.id)
        : profile.apiKey;
      const result = await invoke<TestResult>("test_provider_connection", {
        baseUrl: profile.baseUrl,
        apiKey,
        model: profile.mainModel,
        protocol: profile.protocol ?? null,
      });
      if (result.ok) {
        setTestStates((prev) => ({
          ...prev,
          [profile.id]: { status: "ok", ms: result.latencyMs ?? 0 },
        }));
      } else {
        setTestStates((prev) => ({
          ...prev,
          [profile.id]: { status: "err", message: result.message ?? "Unknown error" },
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStates((prev) => ({
        ...prev,
        [profile.id]: { status: "err", message: msg },
      }));
    }
  };

  return (
    <div>
      <div className="cd-admin-section__head">
        <div>
          <h3 className="cd-admin-section__title">Providers</h3>
          <p className="cd-admin-section__sub">
            {state.profiles.length} profile
            {state.profiles.length === 1 ? "" : "s"} · active:{" "}
            <code>{state.activeId}</code>
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + Add provider
        </Button>
      </div>

      {state.profiles.length === 0 ? (
        <div className="cd-page__empty">No providers configured.</div>
      ) : (
        <div className="cd-page__grid">
          {state.profiles.map((p) => {
            const isActive = p.id === state.activeId;
            const ts = testStates[p.id] ?? { status: "idle" };
            return (
              <Card key={p.id} active={isActive}>
                <div className="cd-admin-card">
                  <div className="cd-admin-card__name">{p.name}</div>
                  <div className="cd-admin-card__meta">
                    <Chip variant="neutral">{p.kind}</Chip>
                    {p.protocol && p.protocol !== 'anthropic_messages' && (
                      <Chip variant="neutral">{p.protocol}</Chip>
                    )}
                    {isActive && <Chip variant="online">active</Chip>}
                    {p.builtin && <Chip variant="admin">builtin</Chip>}
                  </div>
                  {p.mainModel && (
                    <div className="cd-admin-card__detail">
                      main: {p.mainModel}
                    </div>
                  )}
                  {p.fastModel && (
                    <div className="cd-admin-card__detail">
                      fast: {p.fastModel}
                    </div>
                  )}
                  {ts.status === "ok" && (
                    <div className="cd-admin-card__test cd-admin-card__test--ok">
                      ✓ {t("admin.providers.connected", { ms: ts.ms })}
                    </div>
                  )}
                  {ts.status === "err" && (
                    <div className="cd-admin-card__test cd-admin-card__test--err">
                      ✗ {t("admin.providers.failed", { error: ts.message })}
                    </div>
                  )}
                  <div className="cd-admin-card__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={ts.status === "testing"}
                      onClick={() => handleTest(p)}
                    >
                      {ts.status === "testing"
                        ? t("admin.providers.testing")
                        : t("admin.providers.testConnection")}
                    </Button>
                    {!isActive && (
                      <Button size="sm" onClick={() => handleActivate(p.id)}>
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </Button>
                    {!p.builtin && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(p)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ProviderEditor
        open={editorOpen}
        profile={editing}
        existingIds={existingIds}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
          refresh();
        }}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        variant="danger"
        title={t("admin.providers.deleteTitle", "Delete Provider")}
        message={t("admin.providers.deleteConfirm", {
          defaultValue: `Delete provider "${confirmDelete?.name ?? ""}"?`,
          name: confirmDelete?.name ?? "",
        })}
        confirmLabel={t("common.delete", "Delete")}
        cancelLabel={t("common.cancel", "Cancel")}
        onConfirm={confirmDeleteProvider}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
