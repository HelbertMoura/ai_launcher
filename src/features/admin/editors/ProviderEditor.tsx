import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Banner } from "../../../ui/Banner";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Input } from "../../../ui/Input";
import type {
  ProviderKind,
  ProviderProfile,
} from "../../../providers/types";

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

interface ProviderEditorProps {
  open: boolean;
  profile: ProviderProfile | null;
  existingIds: string[];
  onClose: () => void;
  onSave: (profile: ProviderProfile) => void;
}

const KINDS: ProviderKind[] = [
  "anthropic",
  "zai",
  "minimax",
  "moonshot",
  "qwen",
  "openrouter",
  "custom",
];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyProfile(): ProviderProfile {
  return {
    id: "",
    name: "",
    kind: "custom",
    baseUrl: "",
    apiKey: "",
    mainModel: "",
    fastModel: "",
    contextWindow: 200_000,
  };
}

export function ProviderEditor({
  open,
  profile,
  existingIds,
  onClose,
  onSave,
}: ProviderEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProviderProfile>(emptyProfile);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({ status: "idle" });
  const isEdit = profile !== null;

  useEffect(() => {
    if (open) {
      setDraft(profile ? { ...profile } : emptyProfile());
      setError(null);
      setTestState({ status: "idle" });
    }
  }, [open, profile]);

  const update = <K extends keyof ProviderProfile>(
    key: K,
    value: ProviderProfile[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    let id = draft.id;
    if (!isEdit) {
      id = slugify(name);
      if (!id) {
        setError("Name must contain letters or numbers.");
        return;
      }
      if (existingIds.includes(id)) {
        id = `${id}-${Date.now().toString(36)}`;
      }
    }
    onSave({
      ...draft,
      id,
      name,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey,
      mainModel: draft.mainModel.trim(),
      fastModel: draft.fastModel.trim(),
      contextWindow: Number(draft.contextWindow) || 0,
      priceInPerM: draft.priceInPerM ?? undefined,
      priceOutPerM: draft.priceOutPerM ?? undefined,
      dailyBudget: draft.dailyBudget ?? undefined,
      note: draft.note?.trim() || undefined,
    });
  };

  const handleTest = async () => {
    setTestState({ status: "testing" });
    try {
      const result = await invoke<TestResult>("test_provider_connection", {
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey,
        model: draft.mainModel.trim(),
      });
      if (result.ok) {
        setTestState({ status: "ok", ms: result.latencyMs ?? 0 });
      } else {
        setTestState({ status: "err", message: result.message ?? "Unknown error" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestState({ status: "err", message: msg });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${profile?.name ?? "provider"}` : "New provider"}
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
          placeholder="Anthropic Official"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Kind</label>
        <select
          className="cd-admin-select"
          value={draft.kind}
          onChange={(e) => update("kind", e.target.value as ProviderKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Base URL</label>
        <Input
          value={draft.baseUrl}
          onChange={(e) => update("baseUrl", e.target.value)}
          placeholder="https://api.anthropic.com"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">API key</label>
        <Input
          type="password"
          value={draft.apiKey}
          onChange={(e) => update("apiKey", e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Main model</label>
        <Input
          value={draft.mainModel}
          onChange={(e) => update("mainModel", e.target.value)}
          placeholder="claude-sonnet-4-5"
        />
      </div>

      <div className="cd-admin-field__row" style={{ gap: "var(--s-2)", alignItems: "center" }}>
        <Button
          size="sm"
          variant="ghost"
          loading={testState.status === "testing"}
          disabled={!draft.baseUrl.trim() || !draft.apiKey || !draft.mainModel.trim()}
          onClick={handleTest}
        >
          {testState.status === "testing"
            ? t("admin.providers.testing")
            : t("admin.providers.testConnection")}
        </Button>
        {testState.status === "ok" && (
          <span className="cd-admin-card__test cd-admin-card__test--ok">
            ✓ {t("admin.providers.connected", { ms: testState.ms })}
          </span>
        )}
        {testState.status === "err" && (
          <span className="cd-admin-card__test cd-admin-card__test--err">
            ✗ {t("admin.providers.failed", { error: testState.message })}
          </span>
        )}
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Fast / small model</label>
        <Input
          value={draft.fastModel}
          onChange={(e) => update("fastModel", e.target.value)}
          placeholder="claude-haiku-4"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Context window (tokens)</label>
        <Input
          type="number"
          value={String(draft.contextWindow)}
          onChange={(e) => update("contextWindow", Number(e.target.value) || 0)}
          placeholder="200000"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Price In / M (USD)</label>
        <Input
          type="number"
          value={draft.priceInPerM === undefined ? "" : String(draft.priceInPerM)}
          onChange={(e) =>
            update(
              "priceInPerM",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          placeholder="3.00"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Price Out / M (USD)</label>
        <Input
          type="number"
          value={
            draft.priceOutPerM === undefined ? "" : String(draft.priceOutPerM)
          }
          onChange={(e) =>
            update(
              "priceOutPerM",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          placeholder="15.00"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Daily budget (USD)</label>
        <Input
          type="number"
          value={
            draft.dailyBudget === undefined ? "" : String(draft.dailyBudget)
          }
          onChange={(e) =>
            update(
              "dailyBudget",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
          placeholder="0 = no limit"
        />
      </div>

      <div className="cd-admin-field">
        <label className="cd-admin-field__label">Notes</label>
        <textarea
          className="cd-admin-textarea"
          value={draft.note ?? ""}
          onChange={(e) => update("note", e.target.value)}
          placeholder="Free-form notes shown in Admin."
        />
      </div>
    </Dialog>
  );
}
