import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Banner } from "../../../ui/Banner";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import { Toggle } from "../../../ui/Toggle";
import { generatePresetId } from "../../../presets/storage";
import type { LaunchPreset } from "../../../presets/types";
import type { CliInfo } from "../../launcher/useClis";
import type { ProviderProfile } from "../../../providers/types";

interface PresetEditorProps {
  open: boolean;
  preset: LaunchPreset | null;
  providers: ProviderProfile[];
  onClose: () => void;
  onSave: (preset: LaunchPreset) => void;
}

function emptyPreset(): LaunchPreset {
  return {
    id: "",
    name: "",
    cliKey: "",
    providerId: undefined,
    directory: "",
    args: "",
    noPerms: true,
    color: undefined,
    emoji: undefined,
    createdAt: new Date().toISOString(),
  };
}

export function PresetEditor({
  open,
  preset,
  providers,
  onClose,
  onSave,
}: PresetEditorProps) {
  const [draft, setDraft] = useState<LaunchPreset>(emptyPreset);
  const [error, setError] = useState<string | null>(null);
  const [clis, setClis] = useState<CliInfo[]>([]);
  const isEdit = preset !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(preset ? { ...preset } : emptyPreset());
    setError(null);
    invoke<CliInfo[]>("get_all_clis")
      .then((list) => setClis(list))
      .catch(() => setClis([]));
  }, [open, preset]);

  const update = <K extends keyof LaunchPreset>(
    key: K,
    value: LaunchPreset[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const pickDirectory = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") update("directory", picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!draft.cliKey) {
      setError("Choose a CLI.");
      return;
    }
    if (!draft.directory.trim()) {
      setError("Working directory is required.");
      return;
    }
    onSave({
      ...draft,
      id: draft.id || generatePresetId(),
      name,
      directory: draft.directory.trim(),
      args: draft.args.trim(),
      providerId:
        draft.cliKey === "claude" ? draft.providerId || undefined : undefined,
      emoji: draft.emoji?.trim() || undefined,
      color: draft.color?.trim() || undefined,
      createdAt: draft.createdAt || new Date().toISOString(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${preset?.name ?? "preset"}` : "New preset"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      {error && <Banner variant="err">{error}</Banner>}

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Name</label>
        <Input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Claude · project-x"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">CLI</label>
        <select
          className="cd-admin-select"
          value={draft.cliKey}
          onChange={(e) => update("cliKey", e.target.value)}
        >
          <option value="">— pick a CLI —</option>
          {clis.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {draft.cliKey === "claude" && (
        <div className="cd-admin-field">
          <label className="cd-admin-field__label">Provider (optional)</label>
          <select
            className="cd-admin-select"
            value={draft.providerId ?? ""}
            onChange={(e) =>
              update("providerId", e.target.value || undefined)
            }
          >
            <option value="">— default —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Working directory</label>
        <div className="cd-admin-field__row">
          <Input
            value={draft.directory}
            onChange={(e) => update("directory", e.target.value)}
            placeholder="C:\\path\\to\\project"
          />
          <Button size="sm" variant="ghost" onClick={pickDirectory}>
            Browse…
          </Button>
        </div>
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Extra args (optional)</label>
        <Input
          value={draft.args}
          onChange={(e) => update("args", e.target.value)}
          placeholder="--model opus-4"
        />
      </div>

      <div className="cd-admin-field">
        <Toggle
          checked={draft.noPerms}
          onChange={(v) => update("noPerms", v)}
          label="Skip permissions prompt (--dangerously-skip-permissions)"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Emoji (optional)</label>
        <Input
          value={draft.emoji ?? ""}
          onChange={(e) => update("emoji", e.target.value)}
          placeholder="🚀"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Color hex (optional)</label>
        <Input
          value={draft.color ?? ""}
          onChange={(e) => update("color", e.target.value)}
          placeholder="#E07A5F"
        />
      </div>
    </Dialog>
  );
}
