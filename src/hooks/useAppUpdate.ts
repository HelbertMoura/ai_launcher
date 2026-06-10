import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface AppUpdateInfo {
  update_available: boolean;
  version: string;
  current_version: string;
  download_url: string;
  asset_name: string;
  checksum: string;
  release_notes_url: string;
  release_notes_body: string;
}

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
      const info = await invoke<AppUpdateInfo>("check_app_update");
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
      const filePath = await invoke<string>("download_app_update", {
        version: info.version,
        downloadUrl: info.download_url,
      });

      // Checksum verification is mandatory. If the backend did not provide a
      // checksum, the update is untrusted — abort instead of launching it.
      if (!info.checksum) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error:
            "No checksum available for this update. Aborting for safety. Please download the installer manually from the release page.",
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: "verifying" }));
      const valid = await invoke<boolean>("verify_update_checksum", {
        version: info.version,
        filePath,
        expectedChecksum: info.checksum,
      });
      if (!valid) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error:
            "Checksum verification failed. The downloaded file may be corrupted. Please try again.",
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: "ready", progress: { phase: "done", downloaded: 0, total: 0, percent: 100 } }));

      // Open the installer.
      await invoke("open_in_explorer", { path: filePath });
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
        status: event.payload.phase === "error" ? "error" : prev.status,
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
