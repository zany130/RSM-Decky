# RSM-Decky

RSM-Decky is a Decky Loader plugin for per-game ReShade management on Steam Deck.
It wraps `reshade-shader-manager` workflows in a controller-friendly UI.

## Related Project

- GTK app + CLI backend project: [reshade-shader-manager](https://github.com/zany130/reshadeshadermanager)

## Current Feature Set (v1.0.0)

- Per-game launch entry in the Steam library context menu
- ReShade install/update/uninstall/check per selected game
- Shader catalog refresh and downloaded shader repo update
- Add custom shader repositories
- Manage shader enable/disable selection with apply flow
- Manage plugin add-ons with architecture-aware filtering

## Status

`v1.0.0` is the focused release for stable per-game ReShade, shader repository, and add-on management on Steam Deck.

## Install from Release Zip (Users)

1. Download the latest `RSM-Decky` release zip.
2. Extract it so you get a folder named `RSM-Decky`.
3. Copy that folder to `~/homebrew/plugins/` on your Steam Deck.
4. Restart Decky Loader (`plugin_loader`) or reboot the Deck.

Expected final path:

`~/homebrew/plugins/RSM-Decky`

## Build / Deploy (Developers)

Requirements:

- Node.js + `pnpm`
- Python 3
- Decky Loader environment (Steam Deck or compatible host)

Local build:

```bash
pnpm install
pnpm build
```

Deploy to a Deck over SSH:

```bash
DECK_HOST=<deck-ip-or-hostname> DECK_USER=<user> ./scripts/deploy-deck.sh
```

Tail plugin logs on Deck:

```bash
DECK_HOST=<deck-ip-or-hostname> DECK_USER=<user> ./scripts/deck-logs.sh
```

Build end-user release zip:

```bash
./scripts/build-release.sh
```

## Data Sources

- ReShade installer downloads: `reshade.me`
- Shader repos: merged built-in repos + PCGamingWiki-derived list + user-added repos
- Plugin add-ons: official `Addons.ini` catalog from `crosire/reshade-shaders`

## Known Limitations / Caveats

- v1.0.0 targets standard Steam game installs; non-Steam shortcuts may fail fast.
- TLS fallback behavior may be required on some systems with broken CA trust chains.
- Add-ons are filtered by detected game architecture; incompatible entries are hidden.
