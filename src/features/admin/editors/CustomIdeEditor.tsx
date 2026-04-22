import { useEffect, useState } from "react";
import { Banner } from "../../../ui/Banner";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import {
  validateCustomIde,
  type CustomIde,
} from "../../../lib/customIdes";

interface CustomIdeEditorProps {
  open: boolean;
  ide: CustomIde | null;
  existingKeys: string[];
  onClose: () => void;
  onSave: (ide: CustomIde) => void;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyIde(): CustomIde {
  return {
    key: "",
    name: "",
    detectCmd: "",
    launchCmd: "",
    docsUrl: "",
    iconEmoji: "",
    createdAt: Date.now(),
  };
}

export function CustomIdeEditor({
  open,
  ide,
  existingKeys,
  onClose,
  onSave,
}: CustomIdeEditorProps) {
  const [draft, setDraft] = useState<CustomIde>(emptyIde);
  const [error, setError] = useState<string | null>(null);
  const isEdit = ide !== null;

  useEffect(() => {
    if (open) {
      setDraft(ide ? { ...ide } : emptyIde());
      setError(null);
    }
  }, [open, ide]);

  const update = <K extends keyof CustomIde>(
    key: K,
    value: CustomIde[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const name = draft.name.trim();
    const key = (draft.key || slugify(name)).trim();
    const candidate: CustomIde = {
      ...draft,
      name,
      key,
      detectCmd: draft.detectCmd.trim(),
      launchCmd: draft.launchCmd.trim(),
      docsUrl: draft.docsUrl?.trim() || undefined,
      iconEmoji: draft.iconEmoji?.trim() || undefined,
      createdAt: draft.createdAt || Date.now(),
    };

    const result = validateCustomIde(
      candidate,
      existingKeys,
      isEdit ? ide?.key : undefined,
    );
    if (!result.ok) {
      setError(`Field ${result.field}: ${result.messageKey}`);
      return;
    }

    if (!candidate.launchCmd) {
      setError("Launch command is required.");
      return;
    }

    onSave(candidate);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${ide?.name ?? "IDE"}` : "New custom IDE"}
      size="md"
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
          placeholder="Zed"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Key (slug)</label>
        <Input
          value={draft.key}
          onChange={(e) => update("key", e.target.value)}
          placeholder="zed"
          disabled={isEdit}
        />
        <span className="cd-admin-field__hint">
          Lowercase letters, numbers and dashes only.
        </span>
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Detect command</label>
        <Input
          value={draft.detectCmd}
          onChange={(e) => update("detectCmd", e.target.value)}
          placeholder="zed --version"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Launch command</label>
        <Input
          value={draft.launchCmd}
          onChange={(e) => update("launchCmd", e.target.value)}
          placeholder="zed <dir>"
        />
        <span className="cd-admin-field__hint">
          Use <code>&lt;dir&gt;</code> as a placeholder for the working
          directory.
        </span>
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Docs URL (optional)</label>
        <Input
          value={draft.docsUrl ?? ""}
          onChange={(e) => update("docsUrl", e.target.value)}
          placeholder="https://zed.dev/docs"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Icon emoji (optional)</label>
        <Input
          value={draft.iconEmoji ?? ""}
          onChange={(e) => update("iconEmoji", e.target.value)}
          placeholder="⚡"
        />
      </div>
    </Dialog>
  );
}
