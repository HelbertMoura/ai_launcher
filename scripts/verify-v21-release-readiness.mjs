#!/usr/bin/env node
// Local release-readiness checks for v21.
//
// This script is intentionally read-only. It does not build, tag, upload, sign,
// or publish anything; it verifies the repository has the release guardrails in
// place before a human starts the release workflow.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const checks = [];
const warnings = [];

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function ok(name, detail = "") {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail = "") {
  checks.push({ ok: false, name, detail });
}

function warn(name, detail = "") {
  warnings.push({ name, detail });
}

function requireFile(path) {
  if (existsSync(join(ROOT, path))) {
    ok(`file:${path}`);
    return true;
  }
  fail(`file:${path}`, "missing");
  return false;
}

function requireIncludes(path, needles) {
  if (!requireFile(path)) return;
  const text = read(path);
  for (const needle of needles) {
    if (text.includes(needle)) ok(`${path} contains ${needle}`);
    else fail(`${path} contains ${needle}`, "missing expected release guardrail");
  }
}

function versionFromCargoToml(text) {
  const match = text.match(/^\s*version\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? "";
}

function versionFromTauri(text) {
  try {
    return JSON.parse(text).version ?? "";
  } catch {
    return "";
  }
}

function countPlaywrightTests() {
  const files = [
    "e2e/launcher.spec.ts",
    "e2e/critical-workflows.spec.ts",
    "e2e/visual-baseline.spec.ts",
  ].filter((file) => existsSync(join(ROOT, file)));
  let count = 0;
  for (const file of files) {
    const text = read(file);
    count += [...text.matchAll(/\btest\(/g)].length;
  }
  return { count, files };
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const cargoToml = read("src-tauri/Cargo.toml");
const tauriConf = read("src-tauri/tauri.conf.json");

const versions = {
  npm: packageJson.version,
  lock: packageLock.version,
  cargo: versionFromCargoToml(cargoToml),
  tauri: versionFromTauri(tauriConf),
};

const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size === 1) ok("version consistency", JSON.stringify(versions));
else fail("version consistency", JSON.stringify(versions));

const expectedTag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || "";
if (expectedTag) {
  const expectedVersion = expectedTag.replace(/^refs\/tags\//, "").replace(/^v/, "");
  if (expectedVersion === versions.npm) ok("tag/version consistency", expectedTag);
  else fail("tag/version consistency", `tag=${expectedTag} package=${versions.npm}`);
}

for (const script of [
  "typecheck",
  "test",
  "build",
  "e2e",
  "audit:prod",
  "audit:capabilities",
  "audit:storage",
  "build:metrics",
  "smoke:packaged",
  "release:readiness",
]) {
  if (packageJson.scripts?.[script]) ok(`npm script:${script}`);
  else fail(`npm script:${script}`, "missing");
}

requireIncludes("src-tauri/tauri.conf.json", [
  '"targets": ["msi", "nsis"]',
  '"webviewInstallMode"',
  '"downloadBootstrapper"',
]);

requireIncludes(".github/workflows/quality.yml", [
  "npm run release:readiness",
  "npm run audit:prod",
  "npm run audit:capabilities",
  "npm run audit:storage",
  "npm run e2e",
  "npm run build:metrics",
]);

requireIncludes(".github/workflows/build.yml", [
  "npm run release:readiness",
  "npm run tauri build",
  "bundle/msi/*.msi",
  "bundle/nsis/*-setup.exe",
]);

requireIncludes(".github/workflows/release.yml", [
  "npm run release:readiness",
  "SIGNING_CERT_BASE64",
  "SIGNING_CERT_PASSWORD",
  "Get-FileHash",
  "latest.json",
  "scripts/audit-release.sh",
]);

requireFile("scripts/audit-release.sh");
requireFile("scripts/generate-latest-json.sh");
requireFile("scripts/smoke-packaged-app.mjs");
requireFile("docs/SIGNING.md");
requireFile(`docs/releases/v${versions.npm}.md`);

const e2e = countPlaywrightTests();
if (e2e.count >= 15) ok("critical E2E breadth", `${e2e.count} Playwright tests across ${e2e.files.join(", ")}`);
else fail("critical E2E breadth", `${e2e.count} Playwright tests; expected at least 15`);

if (!process.env.SIGNING_CERT_BASE64) {
  warn(
    "SIGNING_CERT_BASE64 not present locally",
    "Expected for CI release signing. Local absence is okay unless this machine is cutting a signed release.",
  );
}

if (!process.env.SIGNING_CERT_PASSWORD) {
  warn(
    "SIGNING_CERT_PASSWORD not present locally",
    "Expected for CI release signing. Local absence is okay unless this machine is cutting a signed release.",
  );
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const mark = check.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}
for (const item of warnings) {
  console.warn(`WARN ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`\nRelease readiness failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log(`\nRelease readiness PASS: ${checks.length} checks, ${warnings.length} warning(s).`);
