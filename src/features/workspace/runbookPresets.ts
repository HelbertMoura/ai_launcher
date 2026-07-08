import type { Runbook, RunbookStep } from "../../domain/types";
import { createRunbook, getRunbooks } from "./runbookStore";

export interface RunbookPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  steps: Array<Omit<RunbookStep, "id">>;
}

export interface PresetInstallResult {
  created: Runbook[];
  skipped: RunbookPreset[];
}

export const RUNBOOK_PRESETS: RunbookPreset[] = [
  {
    id: "node-setup",
    name: "Node/Vite setup",
    description: "Check Node and npm, install dependencies, then run tests and build.",
    tags: ["preset", "node", "vite"],
    steps: [
      { label: "Check Node", type: "check", command: "node --version", auto: true },
      { label: "Check npm", type: "check", command: "npm --version", auto: true },
      {
        label: "Install dependencies",
        type: "install",
        command: "npm install --legacy-peer-deps",
        auto: false,
      },
      { label: "Run tests", type: "check", command: "npm test", auto: false },
      { label: "Build app", type: "check", command: "npm run build", auto: false },
    ],
  },
  {
    id: "tauri-setup",
    name: "Tauri/Rust setup",
    description: "Check Rust and Cargo, then validate the Tauri backend.",
    tags: ["preset", "tauri", "rust"],
    steps: [
      { label: "Check Rust", type: "check", command: "rustc --version", auto: true },
      { label: "Check Cargo", type: "check", command: "cargo --version", auto: true },
      {
        label: "Format check",
        type: "check",
        command: "cargo fmt --check --manifest-path src-tauri/Cargo.toml",
        auto: false,
      },
      {
        label: "Rust tests",
        type: "check",
        command: "cargo test --manifest-path src-tauri/Cargo.toml",
        auto: false,
      },
      {
        label: "Rust build check",
        type: "check",
        command: "cargo check --manifest-path src-tauri/Cargo.toml",
        auto: false,
      },
    ],
  },
  {
    id: "rust-setup",
    name: "Rust setup",
    description: "Validate a Rust project with format, tests, and cargo check.",
    tags: ["preset", "rust"],
    steps: [
      { label: "Check Cargo", type: "check", command: "cargo --version", auto: true },
      { label: "Format check", type: "check", command: "cargo fmt --check", auto: false },
      { label: "Run tests", type: "check", command: "cargo test", auto: false },
      { label: "Cargo check", type: "check", command: "cargo check", auto: false },
    ],
  },
  {
    id: "python-setup",
    name: "Python setup",
    description: "Check Python and install requirements when the project uses requirements.txt.",
    tags: ["preset", "python"],
    steps: [
      { label: "Check Python", type: "check", command: "python --version", auto: true },
      { label: "Check pip", type: "check", command: "python -m pip --version", auto: true },
      {
        label: "Install requirements",
        type: "install",
        command: "python -m pip install -r requirements.txt",
        condition: { type: "fileExists", value: "requirements.txt" },
        auto: false,
      },
      { label: "Run pytest", type: "check", command: "python -m pytest", auto: false },
    ],
  },
  {
    id: "go-setup",
    name: "Go setup",
    description: "Check Go and run the standard project test command.",
    tags: ["preset", "go"],
    steps: [
      { label: "Check Go", type: "check", command: "go version", auto: true },
      { label: "Download modules", type: "install", command: "go mod download", auto: false },
      { label: "Run tests", type: "check", command: "go test ./...", auto: false },
    ],
  },
  {
    id: "docker-setup",
    name: "Docker sanity check",
    description: "Check Docker and validate compose configuration.",
    tags: ["preset", "docker"],
    steps: [
      { label: "Check Docker", type: "check", command: "docker --version", auto: true },
      { label: "Check Compose", type: "check", command: "docker compose version", auto: true },
      { label: "Validate Compose", type: "check", command: "docker compose config", auto: false },
    ],
  },
  {
    id: "mcp-setup",
    name: "MCP sanity check",
    description: "Check common CLIs before validating project MCP configuration manually.",
    tags: ["preset", "mcp"],
    steps: [
      { label: "Check Node", type: "check", command: "node --version", auto: true },
      { label: "Check npm", type: "check", command: "npm --version", auto: true },
      { label: "Review MCP configuration", type: "configure", auto: false },
    ],
  },
];

export function getRunbookPreset(id: string): RunbookPreset | undefined {
  return RUNBOOK_PRESETS.find((preset) => preset.id === id);
}

export function getSuggestedRunbookPresets(ids: string[]): RunbookPreset[] {
  const seen = new Set<string>();
  return ids
    .map((id) => getRunbookPreset(id))
    .filter((preset): preset is RunbookPreset => {
      if (!preset || seen.has(preset.id)) return false;
      seen.add(preset.id);
      return true;
    });
}

export function materializeRunbookPreset(preset: RunbookPreset): Pick<Runbook, "name" | "description" | "tags" | "steps"> {
  return {
    name: preset.name,
    description: preset.description,
    tags: [...preset.tags, `preset:${preset.id}`],
    steps: preset.steps.map((step, index) => ({
      id: `preset-${preset.id}-${index + 1}`,
      ...step,
    })),
  };
}

export function installRunbookPresets(ids: string[]): PresetInstallResult {
  const presets = getSuggestedRunbookPresets(ids);
  const existingTags = new Set(getRunbooks().flatMap((runbook) => runbook.tags));
  const created: Runbook[] = [];
  const skipped: RunbookPreset[] = [];

  for (const preset of presets) {
    if (existingTags.has(`preset:${preset.id}`)) {
      skipped.push(preset);
      continue;
    }
    const runbook = createRunbook(materializeRunbookPreset(preset));
    created.push(runbook);
    existingTags.add(`preset:${preset.id}`);
  }

  return { created, skipped };
}
