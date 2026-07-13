#!/usr/bin/env node
// Smoke-test a built Windows Tauri executable without installing or publishing it.
//
// Usage:
//   npm run smoke:packaged -- --exe "src-tauri/target/release/AI Launcher.exe"
//   npm run smoke:packaged -- --require-signature

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const DEFAULT_TIMEOUT_MS = 20_000;

function parseArgs(argv) {
  const args = {
    exe: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    requireSignature: false,
    keepOpen: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--exe") args.exe = argv[++i] ?? "";
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i] ?? DEFAULT_TIMEOUT_MS);
    else if (arg === "--require-signature") args.requireSignature = true;
    else if (arg === "--keep-open") args.keepOpen = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/smoke-packaged-app.mjs [--exe path] [--require-signature] [--timeout-ms ms] [--keep-open] [--json]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 5_000) {
    throw new Error("--timeout-ms must be at least 5000");
  }
  return args;
}

function discoverExe(explicit) {
  const candidates = [
    explicit,
    "src-tauri/target/release/AI Launcher.exe",
    "src-tauri/target/release/ai-launcher.exe",
    "src-tauri/target/release/ai_launcher.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const full = resolve(ROOT, candidate);
    if (existsSync(full)) return full;
  }
  throw new Error(
    `Packaged executable not found. Build first with "npm run tauri build", or pass --exe <path>. Checked:\n${candidates.map((p) => `  - ${resolve(ROOT, p)}`).join("\n")}`,
  );
}

function psJson(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `PowerShell exited ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`PowerShell returned non-JSON output: ${stdout}\n${error}`));
      }
    });
  });
}

async function readWindowsMetadata(exe) {
  const literal = exe.replace(/'/g, "''");
  return psJson(`
    $item = Get-Item -LiteralPath '${literal}'
    $sig = Get-AuthenticodeSignature -LiteralPath '${literal}'
    [PSCustomObject]@{
      path = $item.FullName
      sizeBytes = $item.Length
      productName = $item.VersionInfo.ProductName
      productVersion = $item.VersionInfo.ProductVersion
      fileDescription = $item.VersionInfo.FileDescription
      signatureStatus = if ($null -ne $sig.Status -and [string]$sig.Status) { [string]$sig.Status } else { "Unknown" }
      signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
    } | ConvertTo-Json -Compress
  `);
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function launch(exe, profileDir) {
  return spawn(exe, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      AI_LAUNCHER_SMOKE: "1",
      AI_LAUNCHER_SMOKE_PROFILE: profileDir,
      WEBVIEW2_USER_DATA_FOLDER: join(profileDir, "webview2"),
    },
    windowsHide: true,
    stdio: "ignore",
  });
}

async function waitForHealthyProcess(child, timeoutMs) {
  const startedAt = Date.now();
  let exit = null;
  child.once("exit", (code, signal) => {
    exit = { code, signal };
  });

  while (Date.now() - startedAt < timeoutMs) {
    if (exit) {
      throw new Error(`Executable exited too early: code=${exit.code} signal=${exit.signal}`);
    }
    if (child.pid) {
      const info = await processWindowInfo(child.pid);
      if (info.exists && info.mainWindowTitle) {
        return {
          pid: child.pid,
          bootMs: Date.now() - startedAt,
          mainWindowTitle: info.mainWindowTitle,
        };
      }
    }
    await delay(500);
  }
  throw new Error(`Executable did not expose a visible main window within ${timeoutMs}ms`);
}

async function processWindowInfo(pid) {
  try {
    return await psJson(`
      $p = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue
      [PSCustomObject]@{
        exists = [bool]$p
        mainWindowTitle = if ($p) { $p.MainWindowTitle } else { "" }
      } | ConvertTo-Json -Compress
    `);
  } catch {
    return { exists: false, mainWindowTitle: "" };
  }
}

async function verifySingleInstance(exe, profileDir, timeoutMs) {
  const second = launch(exe, profileDir);
  const startedAt = Date.now();
  let exit = null;
  second.once("exit", (code, signal) => {
    exit = { code, signal };
  });

  while (Date.now() - startedAt < Math.min(timeoutMs, 6_000)) {
    if (exit) return { ok: true, behavior: "second-process-exited", exit };
    await delay(250);
  }

  try {
    second.kill();
  } catch {
    // Best effort cleanup.
  }
  return {
    ok: false,
    behavior: "second-process-stayed-running",
    detail: "The second launch did not exit quickly; verify Tauri single-instance handling before release.",
  };
}

function stop(child) {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch {
    // Best effort.
  }
}

async function cleanupProfileDir(profileDir) {
  let lastError = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      lastError = error;
      await delay(500 * attempt);
    }
  }
  throw lastError;
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("Packaged smoke is Windows-only because the v21 release target is Windows.");
  }

  const args = parseArgs(process.argv.slice(2));
  const exe = discoverExe(args.exe);
  const profileDir = mkdtempSync(join(tmpdir(), "ai-launcher-smoke-"));
  const summary = {
    exe,
    profileDir,
    metadata: null,
    boot: null,
    singleInstance: null,
    warnings: [],
  };

  let primary = null;
  try {
    summary.metadata = await readWindowsMetadata(exe);
    if (summary.metadata.signatureStatus !== "Valid") {
      const message = `Authenticode signature is ${summary.metadata.signatureStatus}; release candidates should be signed.`;
      if (args.requireSignature) throw new Error(message);
      summary.warnings.push(message);
    }

    primary = launch(exe, profileDir);
    summary.boot = await waitForHealthyProcess(primary, args.timeoutMs);
    await delay(3_000);
    summary.singleInstance = await verifySingleInstance(exe, profileDir, args.timeoutMs);
    if (!summary.singleInstance.ok) throw new Error(summary.singleInstance.detail);

    if (!args.keepOpen) stop(primary);
    if (args.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log("Packaged smoke PASS");
      console.log(`  exe: ${exe}`);
      console.log(`  pid: ${summary.boot.pid}`);
      console.log(`  boot observed: ${summary.boot.bootMs}ms`);
      console.log(`  signature: ${summary.metadata.signatureStatus}`);
      for (const warning of summary.warnings) console.warn(`  warning: ${warning}`);
    }
  } finally {
    if (!args.keepOpen) {
      stop(primary);
      await delay(2_000);
      await cleanupProfileDir(profileDir);
    }
  }
}

main().catch((error) => {
  console.error(`Packaged smoke FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
