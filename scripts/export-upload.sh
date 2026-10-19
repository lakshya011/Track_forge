#!/usr/bin/env bash
# Refresh the folder that gets dragged into GitHub's web uploader, and list what changed since the last upload.
#
#   npm run export:upload            # fills the upload folder from HEAD and writes UPLOAD-CHANGES.txt
#   npm run export:upload -- --mark  # after uploading: remember that HEAD is now what GitHub has
#
# The folder is ~/Documents/Track forge/track-forge-upload (override with TRACK_FORGE_UPLOAD_DIR). Only its
# contents are replaced; the parent folder holds other files and is never touched. The last uploaded
# commit is the git tag `uploaded`; without it, everything counts as new.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${TRACK_FORGE_UPLOAD_DIR:-$HOME/Documents/Track forge/track-forge-upload}"
PARENT="$(dirname "$DEST")"
CHANGES="$PARENT/UPLOAD-CHANGES.txt"

cd "$ROOT"

if [[ "${1:-}" == "--mark" ]]; then
  git tag -f uploaded HEAD >/dev/null
  echo "Marked $(git rev-parse --short HEAD) as uploaded. The next export lists changes from here."
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes; the export takes HEAD only, so commit first." >&2
  exit 1
fi

HEAD_SHORT="$(git rev-parse --short HEAD)"
mkdir -p "$DEST"
# Clear the folder's contents only.
find "$DEST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
git archive --format=tar HEAD | tar -x -C "$DEST"

if git rev-parse -q --verify uploaded >/dev/null; then
  BASE="$(git rev-parse --short uploaded)"
  STATUS="$(git diff --name-status --no-renames uploaded HEAD)"
  SINCE="since the last upload ($BASE)"
else
  BASE=""
  STATUS="$(git ls-files | sed $'s/^/A\t/')"
  SINCE="(first export: no \`uploaded\` tag yet, so every file counts as new)"
fi

ADDED="$(printf '%s\n' "$STATUS" | awk -F'\t' '$1=="A"{print $2}')"
MODIFIED="$(printf '%s\n' "$STATUS" | awk -F'\t' '$1=="M"{print $2}')"
DELETED="$(printf '%s\n' "$STATUS" | awk -F'\t' '$1=="D"{print $2}')"
count() { if [[ -z "$1" ]]; then echo 0; else printf '%s\n' "$1" | grep -c .; fi; }
NA="$(count "$ADDED")"; NM="$(count "$MODIFIED")"; ND="$(count "$DELETED")"

{
  echo "Track Forge: files to update on GitHub"
  echo "Commit $HEAD_SHORT, exported $(date '+%Y-%m-%d %H:%M'), $SINCE."
  echo "Added $NA · modified $NM · deleted $ND"
  echo
  echo "HOW TO UPLOAD"
  echo "1. Open the repository on github.com, click \"Add file\" > \"Upload files\"."
  echo "2. Drag the CONTENTS of $DEST into the drop zone (every folder and file inside it, not the folder itself)."
  echo "   GitHub replaces files that already exist and adds the new ones; files you do not drag are left alone."
  echo "3. Commit directly to main. The Pages workflow builds and redeploys the site in a minute or two."
  if [[ "$ND" -gt 0 ]]; then
    echo "4. Delete the files under DELETE below one by one: open each on github.com, use the \"...\" menu > \"Delete file\", commit."
    echo "5. Back here, run: npm run export:upload -- --mark"
  else
    echo "4. Back here, run: npm run export:upload -- --mark"
  fi
  echo
  echo "UPLOAD (added or replaced): the whole folder covers these"
  if [[ -n "$ADDED" ]]; then printf '%s\n' "$ADDED" | sed 's/^/  + /'; fi
  if [[ -n "$MODIFIED" ]]; then printf '%s\n' "$MODIFIED" | sed 's/^/  ~ /'; fi
  if [[ "$NA" -eq 0 && "$NM" -eq 0 ]]; then echo "  (nothing)"; fi
  echo
  echo "DELETE on GitHub (the uploader cannot remove files)"
  if [[ -n "$DELETED" ]]; then printf '%s\n' "$DELETED" | sed 's/^/  - /'; else echo "  (nothing)"; fi
} > "$CHANGES"

echo "Upload folder refreshed from $HEAD_SHORT: $DEST"
echo "Added $NA · modified $NM · deleted $ND  (details: $CHANGES)"
echo
echo "Next: drag the folder's contents into GitHub's \"Upload files\" page and commit to main;"
if [[ "$ND" -gt 0 ]]; then echo "      delete the $ND file(s) listed under DELETE in $CHANGES;"; fi
echo "      the Pages workflow redeploys; then run: npm run export:upload -- --mark"
