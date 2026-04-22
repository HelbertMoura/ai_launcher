import { useMemo, useState } from "react";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Chip } from "../../../ui/Chip";
import {
  loadProviders,
  removeProfile,
  saveProviders,
  setActive,
  upsertProfile,
} from "../../../providers/storage";
import type {
  ProviderProfile,
  ProvidersState,
} from "../../../providers/types";
import { ProviderEditor } from "../editors/ProviderEditor";

export function ProvidersSection() {
  const [state, setState] = useState<ProvidersState>(() => loadProviders());
  const [editing, setEditing] = useState<ProviderProfile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const existingIds = useMemo(
    () => state.profiles.map((p) => p.id),
    [state.profiles],
  );

  const refresh = () => setState(loadProviders());

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (profile: ProviderProfile) => {
    setEditing(profile);
    setEditorOpen(true);
  };

  const handleSave = (profile: ProviderProfile) => {
    const next = upsertProfile(state, profile);
    saveProviders(next);
    setState(next);
    setEditorOpen(false);
    setEditing(null);
  };

  const handleActivate = (id: string) => {
    const next = setActive(state, id);
    saveProviders(next);
    setState(next);
  };

  const handleDelete = (profile: ProviderProfile) => {
    if (profile.builtin) return;
    const ok = window.confirm(`Delete provider "${profile.name}"?`);
    if (!ok) return;
    const next = removeProfile(state, profile.id);
    saveProviders(next);
    setState(next);
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
            return (
              <Card key={p.id} active={isActive}>
                <div className="cd-admin-card">
                  <div className="cd-admin-card__name">{p.name}</div>
                  <div className="cd-admin-card__meta">
                    <Chip variant="neutral">{p.kind}</Chip>
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
                  <div className="cd-admin-card__actions">
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
    </div>
  );
}
