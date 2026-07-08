import type { AgentProfile } from "../../domain/types";
import { readKey, removeKey, writeKey } from "../../lib/storage";

const MAX_AGENT_PROFILES = 32;

function readAll(): AgentProfile[] {
  return readKey("agentProfiles") as unknown as AgentProfile[];
}

function writeAll(profiles: AgentProfile[]): void {
  writeKey("agentProfiles", profiles.slice(0, MAX_AGENT_PROFILES) as never);
}

export function loadAgentProfiles(): AgentProfile[] {
  return readAll();
}

export function saveAgentProfiles(profiles: AgentProfile[]): void {
  writeAll(profiles);
}

export function generateAgentProfileId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function addAgentProfile(
  list: AgentProfile[],
  profile: AgentProfile,
): AgentProfile[] {
  const next = [profile, ...list.filter((item) => item.id !== profile.id)].slice(
    0,
    MAX_AGENT_PROFILES,
  );
  writeAll(next);
  return next;
}

export function updateAgentProfile(
  list: AgentProfile[],
  id: string,
  patch: Partial<AgentProfile>,
): AgentProfile[] {
  const now = new Date().toISOString();
  const next = list.map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: now } : item,
  );
  writeAll(next);
  return next;
}

export function removeAgentProfile(list: AgentProfile[], id: string): AgentProfile[] {
  const next = list.filter((item) => item.id !== id);
  writeAll(next);
  if (getActiveAgentProfileId() === id) {
    setActiveAgentProfileId(null);
  }
  return next;
}

export function toggleAgentProfilePin(
  list: AgentProfile[],
  id: string,
): AgentProfile[] {
  const now = new Date().toISOString();
  const next = list.map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned, updatedAt: now } : item,
  );
  writeAll(next);
  return next;
}

export function getActiveAgentProfileId(): string | null {
  const id = readKey("activeAgentProfile");
  return id ? id : null;
}

export function setActiveAgentProfileId(id: string | null): void {
  if (id) {
    writeKey("activeAgentProfile", id);
  } else {
    removeKey("activeAgentProfile");
  }
}

export function getActiveAgentProfile(list: AgentProfile[]): AgentProfile | null {
  const id = getActiveAgentProfileId();
  if (!id) return null;
  return list.find((item) => item.id === id) ?? null;
}

export function normalizeAgentProfile(profile: AgentProfile): AgentProfile {
  return {
    ...profile,
    name: profile.name.trim(),
    description: profile.description?.trim() || undefined,
    cliKey: profile.cliKey?.trim() || undefined,
    providerKey: profile.providerKey?.trim() || undefined,
    args: profile.args?.trim() || undefined,
    runbookId: profile.runbookId?.trim() || undefined,
    tags: profile.tags.map((tag) => tag.trim()).filter(Boolean),
  };
}
