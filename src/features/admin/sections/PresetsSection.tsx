import { useEffect, useState } from "react";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Chip } from "../../../ui/Chip";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import {
  addProfile,
  loadProfiles,
  removeProfile,
  updateProfile,
} from "../../../domain/profileStore";
import type { LaunchProfile } from "../../../domain/types";
import { loadProviders } from "../../../providers/storage";
import type { ProviderProfile } from "../../../providers/types";
import { PresetEditor } from "../editors/PresetEditor";

function truncate(s: string, max = 40): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function PresetsSection() {
  const [profiles, setProfiles] = useState<LaunchProfile[]>(() => loadProfiles());
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [editing, setEditing] = useState<LaunchProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LaunchProfile | null>(null);

  useEffect(() => {
    setProviders(loadProviders().profiles);
  }, []);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (profile: LaunchProfile) => {
    setEditing(profile);
    setOpen(true);
  };

  const handleSave = (profile: LaunchProfile) => {
    const exists = profiles.some((p) => p.id === profile.id);
    const next = exists
      ? updateProfile(profiles, profile.id, profile)
      : addProfile(profiles, profile);
    setProfiles(next);
    setOpen(false);
    setEditing(null);
  };

  const handleDelete = (profile: LaunchProfile) => {
    setConfirmDelete(profile);
  };

  const confirmDeletePreset = () => {
    if (!confirmDelete) return;
    setProfiles(removeProfile(profiles, confirmDelete.id));
    setConfirmDelete(null);
  };

  const providerNameById = (id?: string): string | undefined => {
    if (!id) return undefined;
    return providers.find((p) => p.id === id)?.name;
  };

  return (
    <div>
      <div className="cd-admin-section__head">
        <div>
          <h3 className="cd-admin-section__title">Launch presets</h3>
          <p className="cd-admin-section__sub">
            {profiles.length} profile{profiles.length === 1 ? "" : "s"} saved
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + New preset
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="cd-page__empty">No profiles yet.</div>
      ) : (
        <div className="cd-page__grid">
          {profiles.map((p) => {
            const providerName = providerNameById(p.providerKey);
            const cliKey = p.cliKeys[0] ?? "";
            const icon = p.tags[0] ?? "";
            return (
              <Card key={p.id}>
                <div className="cd-admin-card">
                  <div className="cd-admin-card__name">
                    {icon ? `${icon} ` : ""}
                    {p.name}
                  </div>
                  <div className="cd-admin-card__meta">
                    <Chip variant="neutral">{cliKey}</Chip>
                    {providerName && (
                      <Chip variant="admin">{providerName}</Chip>
                    )}
                    {p.noPerms && <Chip variant="warn">no-perms</Chip>}
                  </div>
                  <div
                    className="cd-admin-card__detail"
                    title={p.directory ?? ""}
                  >
                    {truncate(p.directory ?? "")}
                  </div>
                  {p.args?.trim() && (
                    <div className="cd-admin-card__detail">
                      args: {truncate(p.args)}
                    </div>
                  )}
                  <div className="cd-admin-card__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(p)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PresetEditor
        open={open}
        preset={editing}
        providers={providers}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        variant="danger"
        title="Delete Preset"
        message={`Delete preset "${confirmDelete?.name ?? ""}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDeletePreset}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
