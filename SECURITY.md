# Security Policy

## Supported Versions

Only the latest release of **AI Launcher** is supported for security updates. Older
versions may receive a fix if the impact is severe, but the SLA is "best effort".

| Version | Supported          |
| ------- | ------------------ |
| >= 21.0 | :white_check_mark: |
| < 21.0  | :x:                |

## Reporting a Vulnerability

Security is a top priority for us. If you discover a security issue (e.g. arbitrary
code execution via installed CLI paths, environment variables, the local updater
manifest, or a Tauri capability), please do not disclose it publicly by creating a
normal GitHub issue.

Instead, open a **Private Vulnerability Report** on GitHub:

1. Go to the [Security Advisory page](https://github.com/HelbertMoura/ai_launcher/security/advisories).
2. Click on **Report a vulnerability**.
3. Fill out the form with as much detail as possible to help us reproduce and
   address the issue quickly.

We will acknowledge receipt as soon as possible and send you regular updates. If
the vulnerability is accepted we will cut a patch, request a CVE if applicable,
and publicly acknowledge your contribution (unless you prefer to remain anonymous).

## Hardening already in place

These are the controls that limit blast radius if a vulnerability is found:

- **Secrets**: API keys live in Windows Credential Manager, never plaintext
  on disk. See `src-tauri/src/secrets.rs`.
- **Updater**: payloads are signed against a public key baked into the build.
  The signature is verified before any binary is run. See
  `src-tauri/src/commands/updater.rs` and `.github/workflows/release.yml`.
- **Path validation**: `validate_directory` rejects UNC paths and non-existent
  directories. See `src-tauri/src/util/process.rs`.
- **Shell escaping**: `safety.rs` centralises the rules for sanitising CLI
  arguments and environment keys.
- **Tauri capabilities**: the capability manifest (`src-tauri/capabilities/default.json`)
  is audited by `npm run audit:capabilities` on every CI run.
- **Storage**: every read/write goes through a Zod-validated schema
  (`scripts/audit-storage-access.mjs`).
- **Audit trail**: `cargo audit` + `npm audit` + CodeQL + SBOM run on every
  release (`scripts/audit-release.sh`).

## Coordinated disclosure timeline

| Day | Action |
| --- | ------ |
| 0   | Report received. Ack within 48 h. |
| 7   | Triage complete. We confirm or reject. |
| 30  | Patch landed on a private branch and shared with the reporter. |
| 45  | Public advisory + release, unless extension is agreed. |

Thank you for helping keep the open-source community safe.
