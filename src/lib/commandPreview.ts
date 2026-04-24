// ==============================================================================
// AI Launcher Pro - Command Preview & Risk Classification (v15)
// Builds a safe preview of commands and classifies their risk level so users
// can make informed decisions before execution.
// ==============================================================================

export type RiskLevel = "safe" | "caution" | "dangerous";

export interface CommandPreview {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>; // redacted values
  riskLevel: RiskLevel;
  riskReasons: string[];
}

// ---------------------------------------------------------------------------
// Risk classification helpers
// ---------------------------------------------------------------------------

const DANGEROUS_EXECUTABLES = new Set([
  "rm",
  "rmdir",
  "del",
  "format",
  "mkfs",
  "fdisk",
  "shred",
  "wipefs",
  "sudo",
  "runas",
  "chmod",
  "chown",
  "dd",
]);

const DANGEROUS_FLAGS = new Set([
  "--force",
  "-f",
  "--force-delete",
  "--purge",
  "--unsafe",
]);

const READ_ONLY_EXECUTABLES = new Set([
  "ls",
  "dir",
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "echo",
  "which",
  "where",
  "find",
  "grep",
  "rg",
  "fd",
  "git",
  "gh",
]);

const VERSION_HELP_FLAGS = new Set([
  "--version",
  "-v",
  "-V",
  "--help",
  "-h",
  "/?",
]);

const INSTALL_EXECUTABLES = new Set([
  "npm",
  "yarn",
  "pnpm",
  "pip",
  "pip3",
  "cargo",
  "brew",
  "apt",
  "apt-get",
  "dnf",
  "yum",
  "pacman",
  "choco",
  "scoop",
  "winget",
]);

const SYSTEM_DIRS = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\ProgramData",
];

function hasRedirectOrPipe(args: string[]): boolean {
  return args.some(
    (a) =>
      a === ">" ||
      a === ">>" ||
      a === "|" ||
      a === "2>" ||
      a === "&>" ||
      a.startsWith(">") ||
      a.startsWith("|"),
  );
}

function targetsSystemDir(cwd: string): boolean {
  const normalized = cwd.replace(/\\/g, "/").toLowerCase();
  return SYSTEM_DIRS.some((d) => normalized.startsWith(d.toLowerCase()));
}

function classifyRisk(executable: string, args: string[], cwd: string): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  const exe = executable.toLowerCase().split(/[\\/]/).pop() ?? executable.toLowerCase();

  // --- Dangerous checks (highest priority) ---
  if (DANGEROUS_EXECUTABLES.has(exe)) {
    reasons.push(`Executable "${exe}" is a destructive system command`);
    return { level: "dangerous", reasons };
  }

  if (hasRedirectOrPipe(args)) {
    reasons.push("Command uses shell redirection or piping");
    return { level: "dangerous", reasons };
  }

  if (targetsSystemDir(cwd)) {
    reasons.push("Working directory targets a system directory");
    return { level: "dangerous", reasons };
  }

  // --- Caution checks ---
  if (INSTALL_EXECUTABLES.has(exe)) {
    const subcmd = args[0]?.toLowerCase();
    if (
      subcmd === "install" ||
      subcmd === "update" ||
      subcmd === "upgrade" ||
      subcmd === "add"
    ) {
      reasons.push("Command will install or update packages");
      return { level: "caution", reasons };
    }
  }

  const hasForceFlag = args.some((a) => DANGEROUS_FLAGS.has(a.toLowerCase()));
  if (hasForceFlag) {
    reasons.push("Command includes a force flag");
    return { level: "caution", reasons };
  }

  // --- Safe checks ---
  const onlyVersionOrHelp =
    args.length > 0 && args.every((a) => VERSION_HELP_FLAGS.has(a));
  if (onlyVersionOrHelp) {
    return { level: "safe", reasons: [] };
  }

  if (READ_ONLY_EXECUTABLES.has(exe)) {
    return { level: "safe", reasons: [] };
  }

  // Default: caution for unknown executables with args
  if (args.length > 0) {
    reasons.push("Custom command with arguments — verify before executing");
    return { level: "caution", reasons };
  }

  return { level: "safe", reasons: [] };
}

// ---------------------------------------------------------------------------
// Env redaction
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_PATTERNS = [
  /key/i,
  /token/i,
  /secret/i,
  /password/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
  /private/i,
];

function redactEnv(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
    result[key] = isSensitive ? "****" : value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a command string into executable + args.
 * Handles simple quoting (double quotes) but does NOT do full shell parsing.
 */
function parseCommand(cmd: string): { executable: string; args: string[] } {
  const trimmed = cmd.trim();
  if (!trimmed) return { executable: "", args: [] };

  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === " " && !inQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const [executable, ...args] = parts;
  return { executable: executable ?? "", args };
}

export function buildPreview(
  command: string,
  cwd: string,
  env: Record<string, string> = {},
): CommandPreview {
  const { executable, args } = parseCommand(command);
  const { level, reasons } = classifyRisk(executable, args, cwd);
  return {
    executable,
    args,
    cwd,
    env: redactEnv(env),
    riskLevel: level,
    riskReasons: reasons,
  };
}
