import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Banner } from "../../../ui/Banner";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import {
  CLI_OVERRIDES_CHANGED_EVENT,
  clearCliOverride,
  getEffectiveIcon,
  getEffectiveName,
  loadCliOverrides,
  saveCliOverrides,
  setCliOverride,
  type CliOverrides,
} from "../../../lib/clisOverrides";
import { getBuiltinIconAsset } from "../../../lib/iconRegistry";
import { readIconFileAsDataUrl } from "../../../lib/iconUpload";
import type { CliInfo } from "../../launcher/useClis";

type IconMode = "none" | "emoji" | "upload";

interface EditorState {
  cli: CliInfo;
  name: string;
  mode: IconMode;
  emoji: string;
  dataUrl: string;
}

function deriveMode(
  emoji: string | undefined,
  dataUrl: string | undefined,
): IconMode {
  if (dataUrl) return "upload";
  if (emoji) return "emoji";
  return "none";
}

export function CliOverridesSection() {
  const [clis, setClis] = useState<CliInfo[]>([]);
  const [overrides, setOverrides] = useState<CliOverrides>(() =>
    loadCliOverrides(),
  );
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<CliInfo[]>("get_all_clis")
      .then(setClis)
      .catch(() => setClis([]));
  }, []);

  useEffect(() => {
    const onChange = () => setOverrides(loadCliOverrides());
    window.addEventListener(CLI_OVERRIDES_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(CLI_OVERRIDES_CHANGED_EVENT, onChange);
  }, []);

  const openEditor = (cli: CliInfo) => {
    const o = overrides[cli.key];
    setEditor({
      cli,
      name: o?.name ?? "",
      mode: deriveMode(o?.iconEmoji, o?.iconDataUrl),
      emoji: o?.iconEmoji ?? "",
      dataUrl: o?.iconDataUrl ?? "",
    });
    setError(null);
  };

  const closeEditor = () => setEditor(null);

  const handleUpload = async (file: File | null) => {
    if (!file || !editor) return;
    try {
      const dataUrl = await readIconFileAsDataUrl(file);
      setEditor({ ...editor, dataUrl, mode: "upload" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = () => {
    if (!editor) return;
    const next = setCliOverride(overrides, editor.cli.key, {
      name: editor.name.trim() || undefined,
      iconEmoji: editor.mode === "emoji" ? editor.emoji.trim() : undefined,
      iconDataUrl: editor.mode === "upload" ? editor.dataUrl : undefined,
    });
    saveCliOverrides(next);
    setOverrides(next);
    closeEditor();
  };

  const handleReset = () => {
    if (!editor) return;
    const next = clearCliOverride(overrides, editor.cli.key);
    saveCliOverrides(next);
    setOverrides(next);
    closeEditor();
  };

  return (
    <div>
      <div className="cd-admin-section__head">
        <div>
          <h3 className="cd-admin-section__title">CLI overrides</h3>
          <p className="cd-admin-section__sub">
            Rename or re-skin built-in CLIs.
          </p>
        </div>
      </div>

      {clis.length === 0 ? (
        <div className="cd-page__empty">No built-in CLIs detected.</div>
      ) : (
        <div className="cd-page__grid">
          {clis.map((cli) => {
            const effectiveName = getEffectiveName(
              cli.key,
              cli.name,
              overrides,
            );
            const effIcon = getEffectiveIcon(cli.key, overrides);
            const builtinAsset = getBuiltinIconAsset("cli", cli.key);
            const hasOverride = Boolean(overrides[cli.key]);
            return (
              <Card key={cli.key}>
                <div className="cd-override-row">
                  <div className="cd-override-row__meta">
                    <div className="cd-override-row__icon">
                      {effIcon?.dataUrl ? (
                        <img src={effIcon.dataUrl} alt="" />
                      ) : effIcon?.emoji ? (
                        <span>{effIcon.emoji}</span>
                      ) : builtinAsset ? (
                        <img src={builtinAsset} alt="" />
                      ) : (
                        <span>▶</span>
                      )}
                    </div>
                    <div className="cd-override-row__names">
                      <div className="cd-override-row__name">
                        {effectiveName}
                      </div>
                      <div className="cd-override-row__key">
                        {cli.key}
                        {hasOverride ? " · override" : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditor(cli)}
                  >
                    Edit override
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={editor !== null}
        onClose={closeEditor}
        title={editor ? `Override ${editor.cli.name}` : "Override"}
        size="md"
        footer={
          editor && (
            <>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={closeEditor}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </>
          )
        }
      >
        {editor && (
          <>
            {error && <Banner variant="err">{error}</Banner>}
            <div className="cd-admin-field">
              <label className="cd-admin-field__label">Custom name</label>
              <Input
                value={editor.name}
                onChange={(e) =>
                  setEditor({ ...editor, name: e.target.value })
                }
                placeholder={editor.cli.name}
              />
              <span className="cd-admin-field__hint">
                Leave empty to use the built-in name.
              </span>
            </div>

            <div className="cd-admin-field">
              <label className="cd-admin-field__label">Icon</label>
              <div className="cd-override-radio">
                <label>
                  <input
                    type="radio"
                    name="icon-mode"
                    checked={editor.mode === "none"}
                    onChange={() => setEditor({ ...editor, mode: "none" })}
                  />
                  None
                </label>
                <label>
                  <input
                    type="radio"
                    name="icon-mode"
                    checked={editor.mode === "emoji"}
                    onChange={() => setEditor({ ...editor, mode: "emoji" })}
                  />
                  Emoji
                </label>
                <label>
                  <input
                    type="radio"
                    name="icon-mode"
                    checked={editor.mode === "upload"}
                    onChange={() => setEditor({ ...editor, mode: "upload" })}
                  />
                  Upload
                </label>
              </div>
            </div>

            {editor.mode === "emoji" && (
              <div className="cd-admin-field">
                <label className="cd-admin-field__label">Emoji</label>
                <Input
                  value={editor.emoji}
                  onChange={(e) =>
                    setEditor({ ...editor, emoji: e.target.value })
                  }
                  placeholder="🤖"
                />
              </div>
            )}

            {editor.mode === "upload" && (
              <div className="cd-admin-field">
                <label className="cd-admin-field__label">Image</label>
                <div className="cd-admin-field__row">
                  <div className="cd-override-preview">
                    {editor.dataUrl ? <img src={editor.dataUrl} alt="" /> : "?"}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    onChange={(e) =>
                      handleUpload(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <span className="cd-admin-field__hint">
                  PNG, SVG, JPEG or WebP up to 512 KB.
                </span>
              </div>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
