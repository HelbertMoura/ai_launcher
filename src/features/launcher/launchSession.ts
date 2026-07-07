import { invoke } from "@tauri-apps/api/core";
import { loadProviders, setActive, buildLaunchEnvAsync } from "../../providers/storage";
import type { ProvidersState } from "../../providers/types";
import { getActiveWorkspace, loadWorkspaces } from "../workspace/workspaceStore";
import { addRecentDir, saveLastDir } from "../history/useHistory";
import { appendHistory } from "./history";
import {
  mergeLaunchEnv,
  readProjectProfile,
  type ProjectProfile,
} from "../../lib/projectProfile";

export interface LaunchableCli {
  key: string;
  name: string;
}

interface LaunchCliSessionInput {
  cli: LaunchableCli;
  directory: string;
  args?: string;
  historyArgs?: string;
  noPerms?: boolean;
  providerId?: string;
  providersState?: ProvidersState | null;
  projectProfile?: ProjectProfile | null;
  readProjectProfile?: boolean;
}

export interface LaunchCliSessionResult {
  sessionId: string;
  message: string;
  directory: string;
  args: string;
  providerId?: string;
  projectProfileError?: string;
}

function pickProviderId(
  state: ProvidersState | null,
  requested?: string,
  projectProfile?: ProjectProfile | null,
): string | undefined {
  if (!state) return undefined;
  if (projectProfile?.provider && state.profiles.some((p) => p.id === projectProfile.provider)) {
    return projectProfile.provider;
  }
  if (requested && state.profiles.some((p) => p.id === requested)) return requested;
  return state.activeId;
}

async function loadProjectProfileSafely(
  directory: string,
): Promise<{ profile: ProjectProfile | null; error?: string }> {
  try {
    return { profile: await readProjectProfile(directory) };
  } catch (e) {
    return { profile: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function launchCliSession({
  cli,
  directory,
  args = "",
  historyArgs,
  noPerms = true,
  providerId,
  providersState,
  projectProfile,
  readProjectProfile: shouldReadProjectProfile = true,
}: LaunchCliSessionInput): Promise<LaunchCliSessionResult> {
  const initialDirectory = directory.trim();
  if (!initialDirectory) {
    throw new Error("Working directory is required.");
  }

  let projectProfileError: string | undefined;
  let profile = projectProfile ?? null;
  if (shouldReadProjectProfile && profile === null) {
    const loaded = await loadProjectProfileSafely(initialDirectory);
    profile = loaded.profile;
    projectProfileError = loaded.error;
  }

  const finalDirectory = profile?.directory?.trim() ? profile.directory : initialDirectory;
  const isClaude = cli.key === "claude";
  const providerState = providersState ?? (isClaude ? loadProviders() : null);
  const resolvedProviderId = isClaude ? pickProviderId(providerState, providerId, profile) : undefined;

  let defaultEnv: Record<string, string> | undefined;
  if (isClaude && providerState && resolvedProviderId) {
    defaultEnv = await buildLaunchEnvAsync(setActive(providerState, resolvedProviderId));
  }
  const workspaceEnv = getActiveWorkspace(loadWorkspaces())?.envVars;
  const mergedEnv = mergeLaunchEnv(defaultEnv, workspaceEnv, profile?.env);
  const envVars = Object.keys(mergedEnv).length > 0 ? mergedEnv : undefined;

  const result = await invoke<{ session_id: string; message: string }>("launch_cli", {
    cliKey: cli.key,
    directory: finalDirectory,
    args,
    noPerms,
    envVars: envVars ?? null,
  });

  const now = new Date().toISOString();
  saveLastDir(cli.key, finalDirectory);
  addRecentDir(cli.key, finalDirectory);
  appendHistory({
    cli: cli.name,
    cliKey: cli.key,
    directory: finalDirectory,
    args: historyArgs ?? args,
    timestamp: now,
    providerId: resolvedProviderId,
    status: "starting",
    sessionId: result.session_id,
    startedAt: now,
  });

  return {
    sessionId: result.session_id,
    message: result.message,
    directory: finalDirectory,
    args,
    providerId: resolvedProviderId,
    projectProfileError,
  };
}

export function recordFailedLaunch(
  cli: LaunchableCli,
  directory: string,
  args: string,
  errorMessage: string,
  providerId?: string,
): void {
  const now = new Date().toISOString();
  appendHistory({
    cli: cli.name,
    cliKey: cli.key,
    directory,
    args,
    timestamp: now,
    providerId,
    status: "failed",
    startedAt: now,
    errorMessage,
  });
}
