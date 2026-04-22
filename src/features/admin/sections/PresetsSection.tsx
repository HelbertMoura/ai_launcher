import { useEffect, useState } from "react";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Chip } from "../../../ui/Chip";
import {
  addPreset,
  loadPresets,
  removePreset,
  updatePreset,
} from "../../../presets/storage";
import type { LaunchPreset } from "../../../presets/types";
import { loadProviders } from "../../../providers/storage";
import type { ProviderProfile } from "../../../providers/types";
import { PresetEditor } from "../editors/PresetEditor";

function truncate(s: string, max = 40): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function PresetsSection() {
  const [presets, setPresets] = useState<LaunchPreset[]>(() => loadPresets());
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [editing, setEditing] = useState<LaunchPreset | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setProviders(loadProviders().profiles);
  }, []);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (preset: LaunchPreset) => {
    setEditing(preset);
    setOpen(true);
  };

  const handleSave = (preset: LaunchPreset) => {
    const exists = presets.some((p) => p.id === preset.id);
    const next = exists
      ? updatePreset(presets, preset.id, preset)
      : addPreset(presets, preset);
    setPresets(next);
    setOpen(false);
    setEditing(null);
  };

  const handleDelete = (preset: LaunchPreset) => {
    const ok = window.confirm(`Delete preset "${preset.name}"?`);
    if (!ok) return;
    setPresets(removePreset(presets, preset.id));
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
            {presets.length} preset{presets.length === 1 ? "" : "s"} saved
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + New preset
        </Button>
      </div>

      {presets.length === 0 ? (
        <div className="cd-page__empty">No presets yet.</div>
      ) : (
        <div className="cd-page__grid">
          {presets.map((p) => {
            const providerName = providerNameById(p.providerId);
            return (
              <Card key={p.id}>
                <div className="cd-admin-card">
                  <div className="cd-admin-card__name">
                    {p.emoji ? `${p.emoji} ` : ""}
                    {p.name}
                  </div>
                  <div className="cd-admin-card__meta">
                    <Chip variant="neutral">{p.cliKey}</Chip>
                    {providerName && (
                      <Chip variant="admin">{providerName}</Chip>
                    )}
                    {p.noPerms && <Chip variant="warn">no-perms</Chip>}
                  </div>
                  <div
                    className="cd-admin-card__detail"
                    title={p.directory}
                  >
                    {truncate(p.directory)}
                  </div>
                  {p.args.trim() && (
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
    </div>
  );
}
