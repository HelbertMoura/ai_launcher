import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  checkAppUpdate,
  downloadVerifiedAppUpdate,
  type AppUpdateInfo,
} from "../lib/tauri";

export type { AppUpdateInfo };

export interface DownloadProgress {
  phase: string;
  downloaded: number;
  total: number;
  percent: number;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "verifying"
  | "ready"
  | "error";

interface AppUpdateState {
  info: AppUpdateInfo | null;
  status: UpdateStatus;
  progress: DownloadProgress | null;
  error: string | null;
}

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({
    info: null,
    status: "idle",
    progress: null,
    error: null,
  });

  const check = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "checking", error: null }));
    try {
      const info = await checkAppUpdate();
      setState({
        info,
        status: info.update_available ? "available" : "idle",
        progress: null,
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  const download = useCallback(async () => {
    const info = state.info;
    if (!info) return;

    setState((prev) => ({ ...prev, status: "downloading", error: null }));
    try {
      await downloadVerifiedAppUpdate(info.version);

      setState((prev) => ({ ...prev, status: "ready", progress: { phase: "done", downloaded: 0, total: 0, percent: 100 } }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [state.info]);

  const dismiss = useCallback(() => {
    setState({ info: null, status: "idle", progress: null, error: null });
  }, []);

  // Listen for download progress events.
  useEffect(() => {
    const unlisten = listen<DownloadProgress>("app-update-download", (event) => {
      setState((prev) => ({
        ...prev,
        progress: event.payload,
        status:
          event.payload.phase === "error"
            ? "error"
            : event.payload.phase === "verifying"
              ? "verifying"
              : prev.status,
        error:
          event.payload.phase === "error"
            ? "Download failed"
            : prev.error,
      }));
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  return {
    ...state,
    check,
    download,
    dismiss,
  };
}
