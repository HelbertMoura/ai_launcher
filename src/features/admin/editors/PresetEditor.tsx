import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Banner } from "../../../ui/Banner";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import { Toggle } from "../../../ui/Toggle";
import { generateProfileId } from "../../../domain/profileStore";
import type { LaunchProfile } from "../../../domain/types";
import type { CliInfo } from "../../launcher/useClis";
import type { ProviderProfile } from "../../../providers/types";

interface PresetEditorProps {
  open: boolean;
  preset: LaunchProfile | null;
  providers: ProviderProfile[];
  onClose: () => void;
  onSave: (preset: LaunchProfile) => void;
}

function emptyProfile(): LaunchProfile {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    cliKeys: [],
    toolKeys: [],
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function PresetEditor({
  open,
  preset,
  providers,
  onClose,
  onSave,
}: PresetEditorProps) {
  const [draft, setDraft] = useState<LaunchProfile>(emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [clis, setClis] = useState<CliInfo[]>([]);
  const isEdit = preset !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(preset ? { ...preset } : emptyProfile());
    setError(null);
    invoke<CliInfo[]>("get_all_clis")
      .then((list) => setClis(list))
      .catch(() => setClis([]));
  }, [open, preset]);

  const update = <K extends keyof LaunchProfile>(
    key: K,
    value: LaunchProfile[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // Convenience getters/setters for the first cliKey (single-CLI backwards compat)
  const cliKey = draft.cliKeys[0] ?? "";

  const setCliKey = (key: string) => {
    setDraft((prev) => ({ ...prev, cliKeys: key ? [key] : [] }));
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
    if (!cliKey) {
      setError("Choose a CLI.");
      return;
    }
    if (!draft.directory?.trim()) {
      setError("Working directory is required.");
      return;
    }
    const now = new Date().toISOString();
    onSave({
      ...draft,
      id: draft.id || generateProfileId(),
      name,
      directory: draft.directory.trim(),
      args: draft.args?.trim() || undefined,
      providerKey:
        cliKey === "claude" ? draft.providerKey || undefined : undefined,
      tags: draft.tags.filter(Boolean),
      createdAt: draft.createdAt || now,
      updatedAt: now,
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
          value={cliKey}
          onChange={(e) => setCliKey(e.target.value)}
        >
          <option value="">— pick a CLI —</option>
          {clis.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {cliKey === "claude" && (
        <div className="cd-admin-field">
          <label className="cd-admin-field__label">Provider (optional)</label>
          <select
            className="cd-admin-select"
            value={draft.providerKey ?? ""}
            onChange={(e) =>
              update("providerKey", e.target.value || undefined)
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
            value={draft.directory ?? ""}
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
          value={draft.args ?? ""}
          onChange={(e) => update("args", e.target.value)}
          placeholder="--model opus-4"
        />
      </div>

      <div className="cd-admin-field">
        <Toggle
          checked={draft.noPerms ?? true}
          onChange={(v) => update("noPerms", v)}
          label="Skip permissions prompt (--dangerously-skip-permissions)"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Icon / Emoji (optional)</label>
        <Input
          value={draft.tags[0] ?? ""}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              tags: e.target.value.trim() ? [e.target.value.trim()] : [],
            }))
          }
          placeholder="🚀"
        />
      </div>
    </Dialog>
  );
}
