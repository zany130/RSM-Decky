#!/usr/bin/env bash
set -euo pipefail

# ---- Config (override via env vars) ----
DECK_HOST="${DECK_HOST:-steamdeck.local}"
DECK_USER="${DECK_USER:-deck}"
PLUGIN_NAME="${PLUGIN_NAME:-RSM-Decky}"

# Real Decky plugin dir (root-owned / managed by Decky)
DECKY_PLUGINS_DIR_REL="${DECKY_PLUGINS_DIR_REL:-homebrew/plugins}"

# User-owned staging dir for development deploys
DECKY_DEV_DIR_REL="${DECKY_DEV_DIR_REL:-decky-dev/plugins}"

# Local plugin repo root (assumes script is in repo/scripts/)
LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE="${DECK_USER}@${DECK_HOST}"
SSH_OPTS=(-o ConnectTimeout=8)

echo "==> Checking SSH connectivity to ${REMOTE}"
if ! ssh "${SSH_OPTS[@]}" "${REMOTE}" "printf 'ok\n'" >/dev/null 2>&1; then
  echo "ERROR: Unable to SSH to ${REMOTE}." >&2
  echo "Check DECK_HOST/DECK_USER, network reachability, and SSH auth." >&2
  exit 1
fi

echo "==> Building frontend"
cd "${LOCAL_ROOT}"
pnpm build

echo "==> Preparing remote staging path"
ssh "${SSH_OPTS[@]}" "${REMOTE}" "
  set -e
  HOME_DIR=\${HOME:-\$(getent passwd \"${DECK_USER}\" | cut -d: -f6)}
  if [ -z \"\$HOME_DIR\" ]; then
    echo 'Could not determine remote home directory.' >&2
    exit 1
  fi

  DEV_ROOT=\"\$HOME_DIR/${DECKY_DEV_DIR_REL}\"
  PLUGIN_DEV_DIR=\"\$DEV_ROOT/${PLUGIN_NAME}\"

  mkdir -p \"\$PLUGIN_DEV_DIR\"
"

echo "==> Resolving remote paths"
REMOTE_HOME="$(ssh "${SSH_OPTS[@]}" "${REMOTE}" "HOME_DIR=\${HOME:-\$(getent passwd \"${DECK_USER}\" | cut -d: -f6)}; printf '%s' \"\$HOME_DIR\"")"
REMOTE_STAGING_DIR="${REMOTE_HOME}/${DECKY_DEV_DIR_REL}/${PLUGIN_NAME}"
REMOTE_REAL_DIR="${REMOTE_HOME}/${DECKY_PLUGINS_DIR_REL}/${PLUGIN_NAME}"

echo "==> Syncing files to staging dir"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.cursor/' \
  --exclude 'docs/' \
  "${LOCAL_ROOT}/" "${REMOTE}:${REMOTE_STAGING_DIR}/"

echo "==> Installing into Decky plugin dir and restarting loader"
ssh -t "${SSH_OPTS[@]}" "${REMOTE}" "
  set -e
  sudo mkdir -p '${REMOTE_REAL_DIR}'
  sudo rsync -a --delete '${REMOTE_STAGING_DIR}/' '${REMOTE_REAL_DIR}/'
  sudo systemctl restart plugin_loader.service
"

echo "==> Done: deployed ${PLUGIN_NAME} to ${REMOTE_REAL_DIR}"