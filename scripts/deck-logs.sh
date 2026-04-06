#!/usr/bin/env bash
set -euo pipefail

DECK_HOST="${DECK_HOST:-steamdeck.local}"
DECK_USER="${DECK_USER:-deck}"
PLUGIN_NAME="${PLUGIN_NAME:-RSM-Decky}"
DECKY_LOGS_DIR_REL="${DECKY_LOGS_DIR_REL:-homebrew/logs}"

REMOTE="${DECK_USER}@${DECK_HOST}"
SSH_OPTS=(-o ConnectTimeout=8)

ssh "${SSH_OPTS[@]}" "${REMOTE}" "
  set -e
  HOME_DIR=\${HOME:-\$(getent passwd \"${DECK_USER}\" | cut -d: -f6)}
  if [ -z \"\$HOME_DIR\" ]; then
    echo 'Could not determine remote home directory.' >&2
    exit 1
  fi
  LOG_DIR=\"\$HOME_DIR/${DECKY_LOGS_DIR_REL}/${PLUGIN_NAME}\"
  if [ ! -d \"\$LOG_DIR\" ]; then
    echo \"No log directory found yet: \$LOG_DIR\"
    exit 0
  fi
  latest=\$(ls -1t \"\$LOG_DIR\"/*.log 2>/dev/null | head -n1 || true)
  if [ -z \"\$latest\" ]; then
    echo \"No plugin log files found yet in: \$LOG_DIR\"
    exit 0
  fi
  echo \"Tailing: \$latest\"
  tail -F \"\$latest\"
"
