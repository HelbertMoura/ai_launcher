import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../../ui/Button";
import { Input } from "../../../ui/Input";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function HotkeyField() {
  const { t } = useTranslation();
  const [initial, setInitial] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    invoke<string>("get_tray_hotkey")
      .then((hk) => {
        setInitial(hk);
        setValue(hk);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[hotkey] get_tray_hotkey failed", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const dirty = value.trim() !== initial.trim();

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus({ kind: "saving" });
    try {
      await invoke("set_tray_hotkey", { hotkey: trimmed });
      setInitial(trimmed);
      setStatus({ kind: "saved" });
      window.setTimeout(() => {
        setStatus((current) => (current.kind === "saved" ? { kind: "idle" } : current));
      }, 2000);
    } catch (err) {
      const message = typeof err === "string" ? err : String(err);
      setStatus({ kind: "error", message });
    }
  };

  if (loading) return null;

  return (
    <div className="cd-appearance__group">
      <div className="cd-appearance__label">{t("admin.hotkey.label")}</div>
      <div className="cd-appearance__row" style={{ alignItems: "center", gap: 8 }}>
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status.kind !== "idle") setStatus({ kind: "idle" });
          }}
          placeholder="CmdOrCtrl+Alt+L"
          spellCheck={false}
          style={{ minWidth: 220 }}
        />
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || status.kind === "saving"}
        >
          {t("admin.hotkey.save")}
        </Button>
      </div>
      <div className="cd-muted" style={{ marginTop: 4, fontSize: 12 }}>
        {t("admin.hotkey.hint")}
      </div>
      {status.kind === "error" && (
        <div
          className="cd-muted"
          style={{ marginTop: 4, fontSize: 12, color: "var(--err)" }}
        >
          {t("admin.hotkey.invalid")}: {status.message}
        </div>
      )}
      {status.kind === "saved" && (
        <div className="cd-muted" style={{ marginTop: 4, fontSize: 12 }}>
          ✓
        </div>
      )}
    </div>
  );
}
