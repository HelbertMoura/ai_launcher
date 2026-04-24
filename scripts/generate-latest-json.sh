#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# generate-latest-json.sh — Generate a latest.json manifest from a GitHub
# release. This file is uploaded as a release asset and consumed by the
# self-updater to check for updates.
#
# Usage: ./scripts/generate-latest-json.sh <version-tag>
#   e.g.  ./scripts/generate-latest-json.sh v15.0.0
#
# Output: Writes latest.json to current directory.
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <version-tag>"
  echo "  e.g. $0 v15.0.0"
  exit 1
fi

TAG="$1"
VERSION="${TAG#v}"

REPO="HelbertMoura/ai_launcher"
API_URL="https://api.github.com/repos/${REPO}/releases/tags/${TAG}"

echo "=== Generating latest.json for ${TAG} ==="

# Fetch release info.
RELEASE_JSON=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API_URL")

if [[ -z "$RELEASE_JSON" ]]; then
  echo "ERROR: Failed to fetch release for tag ${TAG}"
  exit 1
fi

# Extract fields using python3 (fallback to jq).
python3 -c "
import json, sys, datetime

data = json.load(sys.stdin)
tag = data.get('tag_name', '')
version = tag.lstrip('v')
published = data.get('published_at', '')
notes = data.get('body', '')
notes_url = data.get('html_url', '')

assets = data.get('assets', [])

# Find download URLs per platform.
nsis_url = ''
msi_url = ''
checksum = ''

for a in assets:
    name = a.get('name', '').lower()
    url = a.get('browser_download_url', '')
    if name.endswith('-setup.exe'):
        nsis_url = url
    elif name.endswith('.msi'):
        msi_url = url
    elif name.endswith('.sha256') or name.endswith('.checksum'):
        # Fetch the checksum content.
        import urllib.request
        try:
            resp = urllib.request.urlopen(url)
            body = resp.read().decode('utf-8', errors='replace')
            checksum = body.strip().split()[0] if body.strip() else ''
        except Exception:
            checksum = ''

manifest = {
    'version': version,
    'releaseDate': published,
    'downloadUrls': {
        'windowsNsis': nsis_url,
        'windowsMsi': msi_url,
    },
    'checksums': {
        'sha256': checksum,
    },
    'releaseNotes': notes[:2000] if notes else '',
    'releaseNotesUrl': notes_url,
}

with open('latest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f'Written latest.json (version={version})')
print(f'  NSIS: {nsis_url}')
print(f'  MSI:  {msi_url}')
print(f'  SHA256: {checksum[:16]}...' if len(checksum) > 16 else f'  SHA256: {checksum}')
" <<< "$RELEASE_JSON" 2>/dev/null

if [[ ! -f "latest.json" ]]; then
  echo "ERROR: Failed to generate latest.json"
  exit 1
fi

echo "Done."
