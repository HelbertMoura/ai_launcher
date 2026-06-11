import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  MCP_CLIS,
  isValidMcpName,
  type McpCli,
  type McpServerInput,
  type McpTransport,
} from "./types";

/**
 * Pre-fill payload for the dialog. `cli` may be locked (edit mode) or free
 * (add / catalog mode where the user picks the destination CLI).
 */
export interface McpDialogInitial {
  cli?: McpCli;
  /** When true the CLI selector is read-only (edit mode targets a fixed CLI). */
  cliLocked?: boolean;
  /** Original name when editing (used to detect rename). */
  originalName?: string;
  name?: string;
  transport?: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  /** Env var keys to seed as empty rows (values entered by the user). */
  envKeys?: string[];
}

interface McpServerDialogProps {
  open: boolean;
  mode: "add" | "edit";
  initial: McpDialogInitial;
  onClose: () => void;
  onSubmit: (cli: McpCli, name: string, server: McpServerInput) => Promise<void>;
}

interface KvRow {
  key: string;
  value: string;
}

function envKeysToRows(keys?: string[]): KvRow[] {
  if (!keys || keys.length === 0) return [];
  return keys.map((key) => ({ key, value: "" }));
}

function rowsToRecord(rows: KvRow[]): Record<string, string> | undefined {
  const filtered = rows.filter((r) => r.key.trim().length > 0);
  if (filtered.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const r of filtered) out[r.key.trim()] = r.value;
  return out;
}

const CLI_LABELS: Record<McpCli, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
};

export function McpServerDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: McpServerDialogProps) {
  const { t } = useTranslation();

  const [cli, setCli] = useState<McpCli>(initial.cli ?? "claude");
  const [name, setName] = useState(initial.name ?? "");
  const [transport, setTransport] = useState<McpTransport>(
    initial.transport ?? "stdio",
  );
  const [command, setCommand] = useState(initial.command ?? "");
  const [argsText, setArgsText] = useState((initial.args ?? []).join(" "));
  const [url, setUrl] = useState(initial.url ?? "");
  const [envRows, setEnvRows] = useState<KvRow[]>(envKeysToRows(initial.envKeys));
  const [headerRows, setHeaderRows] = useState<KvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Re-seed the form whenever the dialog (re)opens with new initial data.
  useEffect(() => {
    if (!open) return;
    setCli(initial.cli ?? "claude");
    setName(initial.name ?? "");
    setTransport(initial.transport ?? "stdio");
    setCommand(initial.command ?? "");
    setArgsText((initial.args ?? []).join(" "));
    setUrl(initial.url ?? "");
    setEnvRows(envKeysToRows(initial.envKeys));
    setHeaderRows([]);
    setFormError(null);
    setSubmitting(false);
  }, [open, initial]);

  const nameValid = isValidMcpName(name);
  const stdioValid = transport === "stdio" ? command.trim().length > 0 : true;
  const httpValid = transport === "http" ? url.trim().length > 0 : true;
  const canSubmit = nameValid && stdioValid && httpValid && !submitting;

  const args = useMemo(
    () => argsText.split(/\s+/).filter((a) => a.length > 0),
    [argsText],
  );

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setFormError(null);
    const payload: McpServerInput = {
      name: name.trim(),
      transport,
      enabled: true,
      ...(transport === "stdio"
        ? { command: command.trim(), args, env: rowsToRecord(envRows) }
        : { url: url.trim(), headers: rowsToRecord(headerRows) }),
    };
    setSubmitting(true);
    try {
      await onSubmit(cli, initial.originalName ?? name.trim(), payload);
      onClose();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  const title =
    mode === "add" ? t("mcp.dialogAddTitle") : t("mcp.dialogEditTitle");

  const footer = (
    <>
      <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>
        {t("common.cancel")}
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
        loading={submitting}
      >
        {mode === "add" ? t("mcp.add") : t("common.save")}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md" footer={footer}>
      <div className="cd-mcp-form">
        <label className="cd-mcp-form__field">
          <span className="cd-mcp-form__label">{t("mcp.fieldCli")}</span>
          <select
            className="cd-mcp-form__select"
            value={cli}
            disabled={initial.cliLocked || mode === "edit"}
            onChange={(e) => setCli(e.target.value as McpCli)}
          >
            {MCP_CLIS.map((c) => (
              <option key={c} value={c}>
                {CLI_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="cd-mcp-form__field">
          <span className="cd-mcp-form__label">{t("mcp.fieldName")}</span>
          <Input
            value={name}
            invalid={name.length > 0 && !nameValid}
            placeholder="context7"
            onChange={(e) => setName(e.target.value)}
          />
          {name.length > 0 && !nameValid && (
            <span className="cd-mcp-form__hint cd-mcp-form__hint--err">
              {t("mcp.nameInvalid")}
            </span>
          )}
        </label>

        <label className="cd-mcp-form__field">
          <span className="cd-mcp-form__label">{t("mcp.fieldTransport")}</span>
          <select
            className="cd-mcp-form__select"
            value={transport}
            onChange={(e) => setTransport(e.target.value as McpTransport)}
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </label>

        {transport === "stdio" ? (
          <>
            <label className="cd-mcp-form__field">
              <span className="cd-mcp-form__label">{t("mcp.fieldCommand")}</span>
              <Input
                value={command}
                placeholder="npx"
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
            <label className="cd-mcp-form__field">
              <span className="cd-mcp-form__label">{t("mcp.fieldArgs")}</span>
              <Input
                value={argsText}
                placeholder="-y @upstash/context7-mcp@latest"
                onChange={(e) => setArgsText(e.target.value)}
              />
              <span className="cd-mcp-form__hint">{t("mcp.argsHint")}</span>
            </label>
            <KvEditor
              label={t("mcp.fieldEnv")}
              rows={envRows}
              onChange={setEnvRows}
              addLabel={t("mcp.addEnv")}
            />
          </>
        ) : (
          <>
            <label className="cd-mcp-form__field">
              <span className="cd-mcp-form__label">{t("mcp.fieldUrl")}</span>
              <Input
                value={url}
                placeholder="https://example.com/mcp"
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <KvEditor
              label={t("mcp.fieldHeaders")}
              rows={headerRows}
              onChange={setHeaderRows}
              addLabel={t("mcp.addHeader")}
            />
          </>
        )}

        {formError && (
          <p className="cd-mcp-form__error" role="alert">
            {formError}
          </p>
        )}
      </div>
    </Dialog>
  );
}

interface KvEditorProps {
  label: string;
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  addLabel: string;
}

function KvEditor({ label, rows, onChange, addLabel }: KvEditorProps) {
  const update = (idx: number, patch: Partial<KvRow>): void => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number): void => {
    onChange(rows.filter((_, i) => i !== idx));
  };
  const add = (): void => {
    onChange([...rows, { key: "", value: "" }]);
  };

  return (
    <div className="cd-mcp-form__field">
      <span className="cd-mcp-form__label">{label}</span>
      {rows.map((row, idx) => (
        <div key={idx} className="cd-mcp-form__kv">
          <Input
            value={row.key}
            placeholder="KEY"
            onChange={(e) => update(idx, { key: e.target.value })}
          />
          <Input
            value={row.value}
            placeholder="value"
            type="password"
            onChange={(e) => update(idx, { value: e.target.value })}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => remove(idx)}
            aria-label="remove"
          >
            ×
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={add}>
        + {addLabel}
      </Button>
    </div>
  );
}
