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
  deleteProviderApiKey,
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
import { showToast } from "../../../ui/toastStore";
import { EmptyState, ART_TOOLBOX } from "../../../ui/EmptyState";
import { buildProvidersOverview } from "../providersPageModel";

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
  const overview = useMemo(() => buildProvidersOverview(state), [state]);

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

  const handleSave = async (profile: ProviderProfile) => {
    const next = upsertProfile(state, profile);
    const saved = await saveProvidersSecure(next);
    if (!saved) {
      showToast(t("admin.providers.secureSaveFailed"), "error");
      return;
    }
    setState(next);
    setEditorOpen(false);
    setEditing(null);
  };

  const handleActivate = async (id: string) => {
    const next = setActive(state, id);
    const saved = await saveProvidersSecure(next);
    if (!saved) {
      showToast(t("admin.providers.secureSaveFailed"), "error");
      return;
    }
    setState(next);
  };

  const handleDelete = (profile: ProviderProfile) => {
    if (profile.builtin) return;
    setConfirmDelete(profile);
  };

  const confirmDeleteProvider = async () => {
    if (!confirmDelete) return;
    const next = removeProfile(state, confirmDelete.id);
    const saved = await saveProvidersSecure(next);
    if (!saved) {
      showToast(t("admin.providers.secureSaveFailed"), "error");
      return;
    }
    await deleteProviderApiKey(confirmDelete.id);
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
          <span className="cd-admin-section__eyebrow">{t("admin.providers.eyebrow")}</span>
          <h2 className="cd-admin-section__title">{t("admin.providers.title")}</h2>
          <p className="cd-admin-section__sub">
            {t("admin.providers.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + {t("admin.providers.add")}
        </Button>
      </div>

      <section className="cd-provider-overview" aria-label={t("admin.providers.overviewLabel")}>
        <div className="cd-provider-overview__active">
          <span>{t("admin.providers.activeProvider")}</span>
          <strong>{overview.activeName}</strong>
          <small>{t("admin.providers.activeHint")}</small>
        </div>
        <div className="cd-provider-overview__metrics">
          <div><strong>{overview.total}</strong><span>{t("admin.providers.metricProfiles")}</span></div>
          <div><strong>{overview.custom}</strong><span>{t("admin.providers.metricCustom")}</span></div>
          <div><strong>{overview.protectedCredentials}</strong><span>{t("admin.providers.metricProtected")}</span></div>
        </div>
      </section>

      {state.profiles.length === 0 ? (
        <EmptyState
          art={ART_TOOLBOX}
          title={t("admin.providers.emptyTitle")}
          description={t("admin.providers.emptyHint")}
          action={{ label: t("admin.providers.add"), onClick: openNew }}
        />
      ) : (
        <div className="cd-page__grid cd-provider-grid">
          {state.profiles.map((p) => {
            const isActive = p.id === state.activeId;
            const ts = testStates[p.id] ?? { status: "idle" };
            return (
              <Card key={p.id} active={isActive} className="cd-provider-card">
                <div className="cd-admin-card">
                  <div className="cd-admin-card__name">{p.name}</div>
                  <div className="cd-admin-card__meta">
                    <Chip variant="neutral">{p.kind}</Chip>
                    {p.protocol && p.protocol !== 'anthropic_messages' && (
                      <Chip variant="neutral">{p.protocol}</Chip>
                    )}
                    {isActive && <Chip variant="online">{t("admin.providers.active")}</Chip>}
                    {p.builtin && <Chip variant="admin">{t("admin.providers.builtin")}</Chip>}
                  </div>
                  {p.mainModel && (
                    <div className="cd-admin-card__detail">
                      {t("admin.providers.mainModel")}: {p.mainModel}
                    </div>
                  )}
                  {p.fastModel && (
                    <div className="cd-admin-card__detail">
                      {t("admin.providers.fastModel")}: {p.fastModel}
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
                        {t("admin.providers.activate")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(p)}
                    >
                      {t("common.edit")}
                    </Button>
                    {!p.builtin && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(p)}
                      >
                        {t("common.delete")}
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
