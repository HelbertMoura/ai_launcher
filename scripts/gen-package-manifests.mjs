#!/usr/bin/env node
// gen-package-manifests.mjs — Fills the packaging templates (winget, scoop,
// Chocolatey) with the values of a published GitHub release.
//
// Usage:
//   node scripts/gen-package-manifests.mjs \
//     --version v22.7.0 \
//     --installer-url "https://github.com/HelbertMoura/ai_launcher/releases/download/v22.7.0/AI.Launcher_22.7.0_x64-setup.exe" \
//     --sha256 <sha256 of the -setup.exe> \
//     [--out <dir>] [--release-date YYYY-MM-DD]
//
// Read-only on the templates; output goes to --out (default:
// packaging/dist). Nothing here publishes or submits anything — the manual
// submission steps are documented in packaging/README.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGING_DIR = join(ROOT, "packaging");

const TEMPLATES = [
  "winget/DevManiacs.AILauncher.yaml",
  "winget/DevManiacs.AILauncher.installer.yaml",
  "winget/DevManiacs.AILauncher.locale.en-US.yaml",
  "scoop/ai-launcher.json",
  "choco/ai-launcher.nuspec",
  "choco/tools/chocolateyInstall.ps1",
];

const VERSION_RE = /^v?\d+\.\d+\.\d+(?:[-+][\w.]+)?$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function usage() {
  console.log(
    [
      "Usage: node scripts/gen-package-manifests.mjs --version <vX.Y.Z> --installer-url <url> --sha256 <hash> [--out <dir>] [--release-date YYYY-MM-DD]",
      "",
      "Fills packaging/{winget,scoop,choco} templates with release values.",
      "Output defaults to packaging/dist (not committed).",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    args[key] = next !== undefined && !next.startsWith("--") ? next : "";
  }
  return args;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help !== undefined || args.h !== undefined) {
    usage();
    process.exit(0);
  }

  const rawVersion = args.version ?? "";
  if (!VERSION_RE.test(rawVersion)) {
    usage();
    fail(`--version must be vX.Y.Z (semver), got: "${rawVersion}"`);
  }
  const version = rawVersion.replace(/^v/, "");
  const releaseTag = `v${version}`;

  const installerUrl = args["installer-url"] ?? "";
  if (!/^https:\/\/.+/.test(installerUrl)) {
    fail(`--installer-url must be an https URL, got: "${installerUrl}"`);
  }

  const sha256 = (args.sha256 ?? "").toLowerCase();
  if (!SHA256_RE.test(sha256)) {
    fail(`--sha256 must be a 64-char hex digest, got: "${args.sha256 ?? ""}"`);
  }

  const releaseDate =
    args["release-date"] ?? new Date().toISOString().slice(0, 10);
  if (!ISO_DATE_RE.test(releaseDate)) {
    fail(`--release-date must be YYYY-MM-DD, got: "${releaseDate}"`);
  }

  for (const [name, value] of Object.entries(args)) {
    if (!["version", "installer-url", "sha256", "out", "release-date", "help", "h"].includes(name)) {
      fail(`unknown option: --${name}`);
    }
    if (["version", "installer-url", "sha256", "out", "release-date"].includes(name) && !value) {
      fail(`--${name} requires a value`);
    }
  }

  const outDir = resolve(args.out ?? join(PACKAGING_DIR, "dist"));
  const values = {
    "{{VERSION}}": version,
    "{{RELEASE_TAG}}": releaseTag,
    "{{INSTALLER_URL}}": installerUrl,
    "{{SHA256}}": sha256,
    "{{RELEASE_DATE}}": releaseDate,
  };

  for (const rel of TEMPLATES) {
    const templatePath = join(PACKAGING_DIR, rel);
    if (!existsSync(templatePath)) {
      fail(`template missing: ${rel}`);
    }
  }

  const written = [];
  for (const rel of TEMPLATES) {
    let content = readFileSync(join(PACKAGING_DIR, rel), "utf8");
    for (const [token, value] of Object.entries(values)) {
      content = content.split(token).join(value);
    }
    if (content.includes("{{")) {
      fail(`unresolved placeholder remains in output for ${rel}`);
    }
    const outPath = join(outDir, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, "utf8");
    written.push(outPath);
  }

  // Validate the generated JSON (the YAML is validated by the caller; Node
  // ships no YAML parser).
  try {
    const scoop = JSON.parse(readFileSync(join(outDir, "scoop/ai-launcher.json"), "utf8"));
    if (scoop.version !== version || scoop.architecture["64bit"].hash !== sha256) {
      fail("generated scoop manifest failed value round-trip check");
    }
  } catch (error) {
    fail(`generated scoop manifest is not valid JSON: ${error.message}`);
  }

  console.log(`Generated ${written.length} manifest file(s) in ${outDir} for ${releaseTag}:`);
  for (const path of written) {
    console.log(`  - ${path}`);
  }
}

main();
