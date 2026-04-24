#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# audit-release.sh — Validate that a GitHub release contains only assets
# matching the expected version tag.
#
# Usage: ./scripts/audit-release.sh <version-tag>
#   e.g.  ./scripts/audit-release.sh v15.0.0
#
# Exits non-zero if any asset filename does NOT contain the version string.
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
CHECKSUMS=()
SOURCE=()
OTHER=()
ERRORS=()

while IFS= read -r name; do
  echo "  - ${name}"

  # Categorize.
  if [[ "$name" == *"-setup.exe" ]] || [[ "$name" == *".msi" ]]; then
    INSTALLERS+=("$name")
  elif [[ "$name" == *".exe" ]] && [[ "$name" != *"-setup.exe" ]]; then
    PORTABLE+=("$name")
  elif [[ "$name" == *".sha256" ]] || [[ "$name" == *".checksum" ]]; then
    CHECKSUMS+=("$name")
  elif [[ "$name" == *".tar.gz" ]] || [[ "$name" == *".zip" ]] || [[ "$name" == "Source"* ]]; then
    SOURCE+=("$name")
  else
    OTHER+=("$name")
  fi

  # Validate version in filename.
  if [[ "$name" != *"${VERSION}"* ]]; then
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
echo "Checksums:       ${#CHECKSUMS[@]}"
for f in "${CHECKSUMS[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Source:          ${#SOURCE[@]}"
for f in "${SOURCE[@]}"; do echo "  $f"; done 2>/dev/null || true
echo "Other:           ${#OTHER[@]}"
for f in "${OTHER[@]}"; do echo "  $f"; done 2>/dev/null || true

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
