import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Banner } from "../../ui/Banner";
import { appendHistory } from "./history";
import type { CliInfo } from "./useClis";

interface LaunchDialogProps {
  cli: CliInfo | null;
  onClose: () => void;
}

export function LaunchDialog({ cli, onClose }: LaunchDialogProps) {
  const [directory, setDirectory] = useState("");
  const [args, setArgs] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cli) {
      setDirectory("");
      setArgs("");
      setError(null);
      setLaunching(false);
    }
  }, [cli]);

  const pickDirectory = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") setDirectory(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doLaunch = async () => {
    if (!cli) return;
    if (!directory.trim()) {
      setError("Select a working directory first.");
      return;
    }
    setLaunching(true);
    setError(null);
    try {
      await invoke<string>("launch_cli", {
        cliKey: cli.key,
        directory,
        args,
        noPerms: true,
        envVars: null,
      });
      appendHistory({
        cli: cli.name,
        cliKey: cli.key,
        directory,
        args,
        timestamp: new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog
      open={cli !== null}
      onClose={onClose}
      title={cli ? `Launch ${cli.name}` : "Launch"}
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={launching} onClick={doLaunch}>Launch</Button>
        </>
      }
    >
      {error && <Banner variant="err">{error}</Banner>}

      <div className="cd-launch-dialog__field">
        <label className="cd-launch-dialog__label">Working directory</label>
        <div className="cd-launch-dialog__row">
          <Input
            className="cd-launch-dialog__input"
            value={directory}
            placeholder="C:\\path\\to\\project"
            onChange={(e) => setDirectory(e.target.value)}
          />
          <Button size="sm" variant="ghost" onClick={pickDirectory}>Browse…</Button>
        </div>
      </div>

      <div className="cd-launch-dialog__field">
        <label className="cd-launch-dialog__label">Extra args (optional)</label>
        <Input
          className="cd-launch-dialog__input"
          value={args}
          placeholder="--model opus-4"
          onChange={(e) => setArgs(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
