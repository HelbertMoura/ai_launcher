#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# audit-release.sh — Validate that a GitHub release contains only assets
# matching the expected version tag.
#
# Usage: ./scripts/audit-release.sh <version-tag>
#   e.g.  ./scripts/audit-release.sh v15.0.0
#
# Exits non-zero if any asset filename does NOT contain the version string.
# Windows installers + latest.json are mandatory (the Windows job gates the
# audit); macOS DMGs and Linux AppImage/deb are attached by sibling jobs that
# may still be running, so they are categorized and version-checked but their
# presence is not a hard requirement here.
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <version-tag>"
  echo "  e.g. $0 v15.0.0"
  exit 1
fi

TAG="$1"
VERSION="${TAG#v}"  # strip leading 'v'

REPO="HelbertMoura/ai_launcher"
API_URL="https://api.github.com/repos/${REPO}/releases/tags/${TAG}"

echo "=== Release Audit: ${TAG} ==="
echo ""

# Fetch release info.
RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API_URL")

if [[ -z "$RELEASE_JSON" ]]; then
  echo "ERROR: Failed to fetch release for tag ${TAG}"
  exit 1
fi

# Extract asset names.
ASSETS=$(echo "$RELEASE_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
assets = data.get('assets', [])
for a in assets:
    print(a['name'])
" 2>/dev/null || echo "$RELEASE_JSON" | jq -r '.assets[].name' 2>/dev/null)

if [[ -z "$ASSETS" ]]; then
  echo "ERROR: No assets found in release ${TAG}"
  exit 1
fi

echo "Assets found:"
echo ""

INSTALLERS=()
PORTABLE=()
MACOS_DMG=()
APPIMAGE=()
DEB=()
CHECKSUMS=()
MANIFESTS=()
SOURCE=()
OTHER=()
ERRORS=()

while IFS= read -r name; do
  name="${name%$'\r'}"
  echo "  - ${name}"

  # Categorize.
  if [[ "$name" == *"-setup.exe" ]] || [[ "$name" == *".msi" ]]; then
    INSTALLERS+=("$name")
  elif [[ "$name" == *".exe" ]] && [[ "$name" != *"-setup.exe" ]]; then
    PORTABLE+=("$name")
  elif [[ "$name" == *".dmg" ]]; then
    MACOS_DMG+=("$name")
  elif [[ "$name" == *".AppImage" ]]; then
    APPIMAGE+=("$name")
  elif [[ "$name" == *".deb" ]]; then
    DEB+=("$name")
  elif [[ "$name" == *".sha256" ]] || [[ "$name" == *".checksum" ]]; then
    CHECKSUMS+=("$name")
  elif [[ "$name" == "latest.json" ]]; then
    MANIFESTS+=("$name")
  elif [[ "$name" == *".tar.gz" ]] || [[ "$name" == *".zip" ]] || [[ "$name" == "Source"* ]]; then
    SOURCE+=("$name")
  else
    OTHER+=("$name")
  fi

  # Validate version in filename.
  if [[ "$name" != "latest.json" && "$name" != *"${VERSION}"* ]]; then
    ERRORS+=("$name")
  fi
done <<< "$ASSETS"

echo ""
echo "=== Asset Summary ==="
echo ""
echo "Installers:      ${#INSTALLERS[@]}"
for f in "${INSTALLERS[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Portable:        ${#PORTABLE[@]}"
for f in "${PORTABLE[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "macOS DMGs:      ${#MACOS_DMG[@]}"
for f in "${MACOS_DMG[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "AppImages:       ${#APPIMAGE[@]}"
for f in "${APPIMAGE[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Deb packages:    ${#DEB[@]}"
for f in "${DEB[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Checksums:       ${#CHECKSUMS[@]}"
for f in "${CHECKSUMS[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Manifests:       ${#MANIFESTS[@]}"
for f in "${MANIFESTS[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Source:          ${#SOURCE[@]}"
for f in "${SOURCE[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Other:           ${#OTHER[@]}"
for f in "${OTHER[@]}"; do echo "  $f"; done 2>/dev/null || true

if [[ ${#MANIFESTS[@]} -eq 0 ]]; then
  ERRORS+=("latest.json (missing)")
else
  LATEST_URL=$(echo "$RELEASE_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    if asset.get('name') == 'latest.json':
        print(asset.get('browser_download_url', ''))
        break
" 2>/dev/null || true)
  if [[ -z "$LATEST_URL" ]]; then
    ERRORS+=("latest.json (download url missing)")
  else
    LATEST_JSON=$(curl -fsSL "$LATEST_URL")
    if ! LATEST_JSON="$LATEST_JSON" ASSET_NAMES="$ASSETS" python3 - "$VERSION" "$TAG" <<'PY'
import json
import os
import sys
from urllib.parse import unquote, urlparse

expected_version = sys.argv[1]
expected_tag = sys.argv[2]
asset_names = {line.strip() for line in os.environ.get("ASSET_NAMES", "").splitlines() if line.strip()}
try:
    data = json.loads(os.environ["LATEST_JSON"])
except Exception as exc:
    print(f"ERROR: latest.json is not valid JSON: {exc}")
    sys.exit(1)

errors = []

# 1) version
if data.get("version") != expected_version:
    errors.append(f"version {data.get('version')!r} != {expected_version!r}")

# 2) collect Windows download URLs from every supported schema
windows_urls = []
seen = set()
def _add(u):
    if isinstance(u, str) and u.strip() and u not in seen:
        seen.add(u)
        windows_urls.append(u)

# Schema A: legacy (pre-2026) downloadUrls.{windowsNsis,windowsMsi,windows}
for src_key in ("downloadUrls",):
    src = data.get(src_key)
    if isinstance(src, dict):
        for key in ("windowsNsis", "windowsMsi", "windows"):
            _add(src.get(key))

# Schema B: tauri-plugin-updater (post-2026) platforms.<triple>.url
plat = data.get("platforms")
if isinstance(plat, dict):
    for _, pval in plat.items():
        if isinstance(pval, dict):
            _add(pval.get("url"))

# Schema C: tauri-plugin-updater single-platform root-level url
_add(data.get("url"))

if not windows_urls:
    errors.append("no Windows download URL present (downloadUrls/platforms/url)")
else:
    for url in windows_urls:
        if f"/download/{expected_tag}/" not in url:
            errors.append(f"download URL does not point at {expected_tag}: {url}")
        asset_name = unquote(os.path.basename(urlparse(url).path))
        if asset_names and asset_name not in asset_names:
            errors.append(f"download URL asset is not attached to release: {asset_name}")

# 3) release notes (any of the supported fields)
has_notes = any(
    isinstance(data.get(k), str) and data.get(k).strip()
    for k in ("notes", "releaseNotes", "releaseNotesUrl")
)
if not has_notes:
    errors.append("notes/releaseNotes/releaseNotesUrl all missing")

if errors:
    for error in errors:
        print(f"ERROR: latest.json {error}")
    sys.exit(1)
print("latest.json OK")
PY
    then
      ERRORS+=("latest.json (invalid manifest)")
    fi
  fi
fi

echo ""
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "=== ERRORS: Version mismatch in the following assets ==="
  for f in "${ERRORS[@]}"; do
    echo "  WRONG: '$f' does not contain '${VERSION}'"
  done
  echo ""
  echo "FAIL: ${#ERRORS[@]} asset(s) have version mismatch."
  exit 1
fi

echo "PASS: All assets match version ${VERSION}."
