import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PrereqCheck {
  /** Canonical key used by install_prerequisite (e.g. "node", "git", "vscode"). */
  key: string;
  name: string;
  installed: boolean;
  version: string | null;
  install_command: string | null;
}

export function usePrerequisites() {
  const [items, setItems] = useState<PrereqCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await invoke<PrereqCheck[]>("check_environment");
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { items, loading, error, refresh: load };
}
