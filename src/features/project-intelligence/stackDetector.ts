export type StackConfidence = "high" | "medium" | "low";

export interface ProjectFileSnapshot {
  files: string[];
  manifests?: Record<string, string>;
}

export interface DetectedStack {
  id: string;
  label: string;
  confidence: StackConfidence;
  evidence: string[];
  recommendedClis: string[];
  recommendedRunbooks: string[];
}

export interface ProjectStackScan {
  stacks: DetectedStack[];
  primary?: DetectedStack;
  profileHints: {
    cli?: string;
    runbook?: string;
    tags: string[];
  };
}

type StackCandidate = Omit<DetectedStack, "confidence"> & {
  score: number;
};

const STACK_ORDER = [
  "tauri",
  "react-vite",
  "node",
  "rust",
  "python",
  "go",
  "docker",
  "mcp",
  "ailauncher",
];

function normalizeFile(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function normalizeManifestKey(path: string): string {
  return normalizeFile(path);
}

function hasAny(files: Set<string>, patterns: Array<string | RegExp>): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === "string") {
      if (files.has(normalizeFile(pattern))) return true;
      continue;
    }
    for (const file of files) {
      if (pattern.test(file)) return true;
    }
  }
  return false;
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function packageJson(snapshot: ProjectFileSnapshot): Record<string, unknown> | undefined {
  const raw = manifest(snapshot, "package.json");
  const parsed = parseJson(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function manifest(snapshot: ProjectFileSnapshot, path: string): string | undefined {
  const manifests = snapshot.manifests ?? {};
  const normalized = normalizeManifestKey(path);
  for (const [key, value] of Object.entries(manifests)) {
    if (normalizeManifestKey(key) === normalized) return value;
  }
  return undefined;
}

function hasDependency(pkg: Record<string, unknown> | undefined, name: string): boolean {
  if (!pkg) return false;
  const groups = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  return groups.some((group) => {
    const deps = pkg[group];
    return Boolean(deps && typeof deps === "object" && name in deps);
  });
}

function addCandidate(candidates: StackCandidate[], candidate: StackCandidate): void {
  candidates.push({
    ...candidate,
    evidence: dedupe(candidate.evidence).slice(0, 4),
    recommendedClis: dedupe(candidate.recommendedClis),
    recommendedRunbooks: dedupe(candidate.recommendedRunbooks),
  });
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function confidence(score: number): StackConfidence {
  if (score >= 3) return "high";
  if (score === 2) return "medium";
  return "low";
}

function byPriority(a: DetectedStack, b: DetectedStack): number {
  const confidenceRank: Record<StackConfidence, number> = { high: 3, medium: 2, low: 1 };
  const confidenceDiff = confidenceRank[b.confidence] - confidenceRank[a.confidence];
  if (confidenceDiff !== 0) return confidenceDiff;
  return STACK_ORDER.indexOf(a.id) - STACK_ORDER.indexOf(b.id);
}

export function detectProjectStacks(snapshot: ProjectFileSnapshot): ProjectStackScan {
  const files = new Set(snapshot.files.map(normalizeFile).filter(Boolean));
  const pkg = packageJson(snapshot);
  const candidates: StackCandidate[] = [];

  const hasPackage = files.has("package.json") || Boolean(pkg);
  const hasTauriFile = hasAny(files, ["src-tauri/tauri.conf.json", "src-tauri/cargo.toml"]);
  const hasTauriDeps = hasDependency(pkg, "@tauri-apps/api") || hasDependency(pkg, "@tauri-apps/cli");
  if (hasTauriFile || hasTauriDeps) {
    addCandidate(candidates, {
      id: "tauri",
      label: "Tauri Desktop",
      score: hasTauriFile && hasTauriDeps ? 4 : hasTauriFile ? 3 : 2,
      evidence: [
        hasTauriFile ? "src-tauri" : "",
        hasTauriDeps ? "@tauri-apps/*" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["tauri-setup"],
    });
  }

  const hasVite = hasAny(files, [/^vite\.config\.(ts|js|mts|mjs|cts|cjs)$/]) || hasDependency(pkg, "vite");
  const hasReact =
    hasAny(files, ["src/app.tsx", "src/app.jsx", "src/main.tsx", "src/main.jsx"]) ||
    hasDependency(pkg, "react");
  if (hasVite || hasReact) {
    addCandidate(candidates, {
      id: "react-vite",
      label: "React/Vite",
      score: hasVite && hasReact ? 4 : 2,
      evidence: [hasReact ? "react" : "", hasVite ? "vite" : ""].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["node-setup"],
    });
  }

  if (hasPackage || hasAny(files, ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"])) {
    addCandidate(candidates, {
      id: "node",
      label: "Node.js",
      score: hasPackage ? 3 : 2,
      evidence: [
        hasPackage ? "package.json" : "",
        hasAny(files, ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"]) ? "lockfile" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["node-setup"],
    });
  }

  if (hasAny(files, ["cargo.toml", "cargo.lock", "src-tauri/cargo.toml"])) {
    addCandidate(candidates, {
      id: "rust",
      label: "Rust",
      score: files.has("cargo.toml") || files.has("src-tauri/cargo.toml") ? 3 : 2,
      evidence: [
        files.has("cargo.toml") ? "Cargo.toml" : "",
        files.has("src-tauri/cargo.toml") ? "src-tauri/Cargo.toml" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["rust-setup"],
    });
  }

  if (hasAny(files, ["pyproject.toml", "requirements.txt", "poetry.lock", "uv.lock"])) {
    addCandidate(candidates, {
      id: "python",
      label: "Python",
      score: hasAny(files, ["pyproject.toml"]) ? 3 : 2,
      evidence: [
        files.has("pyproject.toml") ? "pyproject.toml" : "",
        files.has("requirements.txt") ? "requirements.txt" : "",
        files.has("uv.lock") ? "uv.lock" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["python-setup"],
    });
  }

  if (hasAny(files, ["go.mod", "go.sum"])) {
    addCandidate(candidates, {
      id: "go",
      label: "Go",
      score: files.has("go.mod") ? 3 : 2,
      evidence: [files.has("go.mod") ? "go.mod" : "go.sum"],
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["go-setup"],
    });
  }

  if (hasAny(files, ["dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"])) {
    addCandidate(candidates, {
      id: "docker",
      label: "Docker",
      score: hasAny(files, ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"]) ? 3 : 2,
      evidence: [
        files.has("dockerfile") ? "Dockerfile" : "",
        hasAny(files, ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"]) ? "compose" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["docker-setup"],
    });
  }

  const profileRaw = manifest(snapshot, ".ailauncher.json");
  const profile = parseJson(profileRaw);
  const profileObject =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as Record<string, unknown>)
      : undefined;
  const profileMcp = Array.isArray(profileObject?.mcp) && profileObject.mcp.length > 0;
  if (hasAny(files, [".mcp.json", ".claude/.mcp.json"]) || profileMcp) {
    addCandidate(candidates, {
      id: "mcp",
      label: "MCP Context",
      score: profileMcp ? 3 : 2,
      evidence: [
        files.has(".mcp.json") ? ".mcp.json" : "",
        files.has(".claude/.mcp.json") ? ".claude/.mcp.json" : "",
        profileMcp ? ".ailauncher.json mcp" : "",
      ].filter(Boolean),
      recommendedClis: ["claude", "codex"],
      recommendedRunbooks: ["mcp-setup"],
    });
  }

  if (files.has(".ailauncher.json") || profileObject) {
    addCandidate(candidates, {
      id: "ailauncher",
      label: "AI Launcher Profile",
      score: profileObject ? 3 : 2,
      evidence: [".ailauncher.json"],
      recommendedClis: typeof profileObject?.cli === "string" ? [profileObject.cli] : ["claude"],
      recommendedRunbooks: typeof profileObject?.runbook === "string" ? [profileObject.runbook] : [],
    });
  }

  const stacks = candidates
    .map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      confidence: confidence(candidate.score),
      evidence: candidate.evidence,
      recommendedClis: candidate.recommendedClis,
      recommendedRunbooks: candidate.recommendedRunbooks,
    }))
    .sort(byPriority);
  const primary = stacks[0];
  const cliFromProfile = typeof profileObject?.cli === "string" ? profileObject.cli : undefined;
  const runbookFromProfile =
    typeof profileObject?.runbook === "string" ? profileObject.runbook : undefined;

  return {
    stacks,
    primary,
    profileHints: {
      cli: cliFromProfile ?? primary?.recommendedClis[0],
      runbook: runbookFromProfile ?? primary?.recommendedRunbooks[0],
      tags: stacks.map((stack) => stack.id),
    },
  };
}
