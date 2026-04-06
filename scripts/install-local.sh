#!/usr/bin/env bash
# Build RSM-Decky and copy the runtime layout into Decky Loader's plugins directory
# on *this* machine (Steam Deck, Bazzite + Decky, or any Linux setup using ~/homebrew).
#
# Usage:
#   ./scripts/install-local.sh
#   DECKY_PLUGINS_DIR=/path/to/homebrew/plugins ./scripts/install-local.sh
#   ./scripts/install-local.sh --dry-run
#
# After install, reload Decky from its menu or: systemctl restart plugin_loader (Deck / SteamOS)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
  esac
done

DECKY_PLUGINS="${DECKY_PLUGINS_DIR:-${HOME}/homebrew/plugins}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm not found (install pnpm 9+ and run pnpm i in the repo)." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 required to read plugin.json" >&2
  exit 1
fi

PLUGIN_SLUG="$(python3 -c "import json; n=json.load(open('plugin.json'))['name']; print(n.replace(' ', '-'))")"
TARGET="${DECKY_PLUGINS}/${PLUGIN_SLUG}"

if ! $DRY_RUN; then
  if [[ -e "$DECKY_PLUGINS" && ! -w "$DECKY_PLUGINS" ]]; then
    echo "error: Decky plugins directory is not writable: ${DECKY_PLUGINS}" >&2
    echo "Fix (Steam Deck / SteamOS): sudo chown -R \"\${USER}\" \"\${HOME}/homebrew/plugins\"" >&2
    echo "Or set DECKY_PLUGINS_DIR to a directory you own." >&2
    exit 1
  fi
  mkdir -p "$DECKY_PLUGINS" || {
    echo "error: could not create ${DECKY_PLUGINS}" >&2
    exit 1
  }
fi

run() {
  if $DRY_RUN; then
    printf 'DRY-RUN: '; printf '%q ' "$@"; echo
  else
    "$@"
  fi
}

echo "==> Installing to: ${TARGET}"
echo "    (set DECKY_PLUGINS_DIR to override; default is \$HOME/homebrew/plugins)"

run pnpm install
run pnpm run build

if ! $DRY_RUN && [[ ! -f dist/index.js ]]; then
  echo "error: dist/index.js missing after build" >&2
  exit 1
fi

if ! $DRY_RUN; then
  mkdir -p "${TARGET}/dist"
  install -m0644 main.py plugin.json package.json "${TARGET}/"
  install -m0644 dist/index.js "${TARGET}/dist/"
  [[ -f dist/index.js.map ]] && install -m0644 dist/index.js.map "${TARGET}/dist/" || true
  [[ -f LICENSE ]] && install -m0644 LICENSE "${TARGET}/" || true
  [[ -f decky.pyi ]] && install -m0644 decky.pyi "${TARGET}/" || true

  shopt -s nullglob
  for d in defaults assets; do
    if [[ -d "$d" ]] && compgen -G "$d/*" >/dev/null; then
      mkdir -p "${TARGET}/${d}"
      cp -a "${d}/." "${TARGET}/${d}/"
    fi
  done

  # Only ship py_modules if there is more than an empty .keep
  if [[ -d py_modules ]] && find py_modules -mindepth 1 ! -name '.keep' -print -quit | grep -q .; then
    mkdir -p "${TARGET}/py_modules"
    cp -a py_modules/. "${TARGET}/py_modules/"
  fi
  shopt -u nullglob
fi

echo ""
echo "Done. Reload Decky (Quick Access Menu → Decky → …) or restart plugin_loader."
if [[ -n "${XDG_RUNTIME_DIR:-}" ]] && systemctl is-active --quiet plugin_loader 2>/dev/null; then
  echo "Tip: sudo systemctl restart plugin_loader"
fi
