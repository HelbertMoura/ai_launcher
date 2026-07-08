// ==============================================================================
// AI Launcher Pro - Unified Launch Profile
// Single model that replaces LaunchPreset (admin) + SessionTemplate (launcher).
// ==============================================================================

export interface LaunchProfile {
  id: string;
  name: string;
  description?: string;
  directory?: string;
  cliKeys: string[];
  toolKeys: string[];
  providerKey?: string;
  args?: string;
  noPerms?: boolean;
  clipboardPrompt?: boolean;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// AI Launcher Pro - Workspace Profile
// Saved workspace configuration with directory, CLIs, provider, env vars.
// ==============================================================================

export interface WorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  directory: string;
  cliKeys: string[];
  providerKey?: string;
  envVars: Record<string, string>;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// AI Launcher Pro - Agent Profile
// Named working mode for an AI agent: preferred CLI, provider, args and runbook.
// ==============================================================================

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  cliKey?: string;
  providerKey?: string;
  args?: string;
  runbookId?: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================================
// AI Launcher Pro - Agent Runbook
// Sequence of steps that can be executed manually or automatically.
// ==============================================================================

export type RunbookStepType = 'install' | 'configure' | 'launch' | 'check';
export type RunbookConditionType =
  | 'always'
  | 'fileExists'
  | 'commandExists'
  | 'envExists'
  | 'previousSucceeded';

export interface RunbookCondition {
  type: RunbookConditionType;
  value?: string;
  negate?: boolean;
}

export interface RunbookStep {
  id: string;
  label: string;
  type: RunbookStepType;
  command?: string;
  toolKey?: string;
  cliKey?: string;
  condition?: RunbookCondition;
  auto: boolean;
}

export interface Runbook {
  id: string;
  name: string;
  description?: string;
  steps: RunbookStep[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
