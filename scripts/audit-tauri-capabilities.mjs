import { readFile } from "node:fs/promises";

const capabilityUrl = new URL(
  "../src-tauri/capabilities/default.json",
  import.meta.url,
);
const capability = JSON.parse(await readFile(capabilityUrl, "utf8"));
const permissions = Array.isArray(capability.permissions)
  ? capability.permissions
  : [];

const forbidden = [
  "shell:allow-execute",
  "shell:allow-spawn",
  "shell:allow-stdin-write",
  "shell:allow-kill",
];
const violations = forbidden.filter((permission) =>
  permissions.includes(permission),
);

if (violations.length > 0) {
  process.stderr.write(
    `Forbidden broad Tauri capabilities: ${violations.join(", ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Tauri capability audit passed (${permissions.length} permissions).\n`,
  );
}
