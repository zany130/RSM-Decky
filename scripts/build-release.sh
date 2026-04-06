#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "error: zip is required" >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required" >&2
  exit 1
fi

PLUGIN_NAME="RSM-Decky"
VERSION="$(python3 -c "import json; print(json.load(open('package.json'))['version'])")"
RELEASE_DIR="$ROOT/release"
STAGING_DIR="$RELEASE_DIR/$PLUGIN_NAME"
ZIP_NAME="${PLUGIN_NAME}-v${VERSION}.zip"
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"
LATEST_ZIP_PATH="$RELEASE_DIR/${PLUGIN_NAME}.zip"

echo "==> Building frontend"
pnpm build

echo "==> Preparing release staging"
rm -rf "$STAGING_DIR" "$ZIP_PATH" "$LATEST_ZIP_PATH"
mkdir -p "$STAGING_DIR/dist"

echo "==> Copying runtime files"
install -m0644 plugin.json package.json main.py README.md LICENSE "$STAGING_DIR/"
if [[ -f decky.pyi ]]; then
  install -m0644 decky.pyi "$STAGING_DIR/"
fi

install -m0644 dist/index.js "$STAGING_DIR/dist/"
rsync -a \
  --exclude "__pycache__/" \
  --exclude "*.pyc" \
  --exclude ".keep" \
  py_modules/ "$STAGING_DIR/py_modules/"

if [[ -d defaults ]] && find defaults -mindepth 1 -print -quit | grep -q .; then
  cp -a defaults "$STAGING_DIR/"
fi
if [[ -d assets ]] && find assets -mindepth 1 -print -quit | grep -q .; then
  cp -a assets "$STAGING_DIR/"
fi

echo "==> Creating release zip"
(
  cd "$RELEASE_DIR"
  zip -rq "$ZIP_NAME" "$PLUGIN_NAME"
  cp "$ZIP_NAME" "$LATEST_ZIP_PATH"
)

echo "Release zip created:"
echo "  $ZIP_PATH"
echo "  $LATEST_ZIP_PATH"
