# Packaging — winget / Scoop / Chocolatey

Manifests and install scripts for publishing AI Launcher to the Windows
package managers. **Everything in this folder is prepared but NOT yet
submitted** — submission requires a published GitHub release with stable
download URLs, so it can only happen after the first real release is cut.

Nothing here is automated in CI: each store has its own manual submission
flow, described below.

## Layout

| Path | Purpose |
|------|---------|
| `winget/DevManiacs.AILauncher.yaml` | winget version manifest (template) |
| `winget/DevManiacs.AILauncher.installer.yaml` | winget installer manifest — NSIS x64 URL + SHA-256 (template) |
| `winget/DevManiacs.AILauncher.locale.en-US.yaml` | winget default-locale manifest (template) |
| `scoop/ai-launcher.json` | Scoop manifest (template) |
| `choco/ai-launcher.nuspec` | Chocolatey package metadata (template) |
| `choco/tools/chocolateyInstall.ps1` | Chocolatey install script — NSIS silent install (template) |
| `dist/` | Generated output (created by the script below; **not committed**) |

The committed files are **templates** containing `{{PLACEHOLDER}}` tokens.
Fill them with the values of a real release:

```bash
node scripts/gen-package-manifests.mjs \
  --version v22.7.0 \
  --installer-url "https://github.com/HelbertMoura/ai_launcher/releases/download/v22.7.0/AI.Launcher_22.7.0_x64-setup.exe" \
  --sha256 <sha256 of the -setup.exe> \
  [--release-date YYYY-MM-DD] \
  [--out <dir>]   # default: packaging/dist
```

The SHA-256 is the hash of the exact `-setup.exe` asset attached to that
release (PowerShell: `Get-FileHash .\AI.Launcher_22.7.0_x64-setup.exe`).

## winget (DevManiacs.AILauncher)

winget packages live in the [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs)
community repository. Submission is a pull request:

1. Cut a release and upload the NSIS installer (`*-setup.exe`) to it. Confirm
   the exact asset URL (this repo's release workflow already attaches it).
2. Generate the three manifests with the script above.
3. Fork `microsoft/winget-pkgs`, create a branch, and copy the three files to
   `manifests/d/DevManiacs/AILauncher/<version>/` (one commit).
4. Open the PR (title convention: `Add: DevManiacs.AILauncher version 22.7.0`).
   The `winget-pkgs-automation` bot runs schema/validation checks; fix any
   reported issue and wait for a maintainer review.
5. Local sanity check before the PR: `winget install --manifest packaging/dist/winget`.

Honest caveats: review time is typically days-to-weeks; the manifests here
target ManifestVersion 1.9.0 (bump to whatever `winget-pkgs` currently accepts
if the bot complains); the manifest advertises a single x64 NSIS installer.

## Scoop (ai-launcher)

There is no central mandatory bucket. Realistic options, in order of effort:

1. **Own bucket (recommended)**: create a repo (e.g. `HelbertMoura/scoop-bucket`),
   drop the generated `scoop/ai-launcher.json` at its root, add the bucket
   (`scoop bucket add devmaniacs <repo-url>`) and install with
   `scoop install ai-launcher`.
2. **Community bucket PR**: `extras` and `main` require the app to meet their
   notability criteria (stars/user base), so this is only realistic later.

Caveat: the `autoupdate` URL in the manifest guesses the NSIS asset naming
pattern (`AI.Launcher_<version>_x64-setup.exe`). **Confirm it against a real
release page** after the first release and fix the pattern if GitHub/tauri
named the asset differently.

## Chocolatey (ai-launcher)

Community repository at [community.chocolatey.org](https://community.chocolatey.org):

1. Generate `choco/ai-launcher.nuspec` + `choco/tools/chocolateyInstall.ps1`
   with the script above, keeping the `choco/` folder layout intact.
2. Pack locally: `cd packaging/dist/choco && choco pack` → `ai-launcher.<version>.nupkg`.
3. Test locally: `choco install ai-launcher --source .` (in the pack folder).
4. Push: `choco apikey add -k <API_KEY> -s https://push.chocolatey.org` then
   `choco push --source https://push.chocolatey.org`.
5. First-time submissions go through **manual moderation** (can take days);
   subsequent versions are auto-moderated faster.

Honest caveats: the package ID `ai-launcher` must still be free on the
community repo; a maintainer account (`devmaniacs`) needs to be created; the
installer checksum type is `sha256` (Chocolatey requires it to match exactly).

## Prerequisites checklist (all three)

- [ ] A GitHub release exists for tag `vX.Y.Z` with the NSIS `-setup.exe` asset.
- [ ] SHA-256 of that exact asset computed and used in the generator.
- [ ] (Recommended) Windows code signing configured — without it, every
      store install still triggers SmartScreen on first run. See
      `docs/SIGNING.md`.
- [ ] Out-of-scope by decision: the in-app updater (`latest.json`) remains
      Windows-only and is not generated for the macOS/Linux bundles.
