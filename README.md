# RSM-Decky

RSM-Decky is a [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin for per-game [ReShade](https://reshade.me) management on Steam Deck.
It wraps `reshade-shader-manager` workflows in a controller-friendly UI.

## Related Project

- GTK app + CLI backend project: [reshade-shader-manager](https://github.com/zany130/reshadeshadermanager)

## Current Feature Set (v1.0.0)

- Per-game access via the Steam library context menu (right-click a game)
- ReShade install/update/uninstall/check per selected game
- Shader catalog refresh and downloaded shader repo update
- Add custom shader repositories
- Manage shader enable/disable selection and apply the changes to the game
- Manage plugin add-ons with architecture-aware filtering

## Install from Release Zip (Users)

1. Download the latest `RSM-Decky` release zip from the [Releases page](https://github.com/zany130/RSM-Decky/releases).
2. In Decky Loader, open the settings (⚙️ icon), go to **General** → **Other**, and enable **Developer Mode**.
3. Still in settings, scroll to the **Developer** section and use **Install Plugin from ZIP File** to select the downloaded zip.
4. Decky Loader will install the plugin automatically — no manual extraction or copying needed.

> **Alternative:** In the **Developer** section you can also use **Install Plugin from URL** and paste the direct download link to the release zip instead of downloading the file manually.

Expected final path:

`~/homebrew/plugins/RSM-Decky`

## Build (Developers)

Requirements:

- Node.js + `pnpm`
- Python 3
- Decky Loader environment (Steam Deck or compatible host)

Local build:

```bash
pnpm install
pnpm build
```

Build end-user release zip:

```bash
./scripts/build-release.sh
```

## Data Sources

- ReShade installer downloads: [reshade.me](https://reshade.me)
- Shader repos: merged built-in repos + PCGamingWiki-derived list + user-added repos
- Plugin add-ons: official `Addons.ini` catalog from [crosire/reshade-shaders](https://github.com/crosire/reshade-shaders)

## Disclaimer

This is a personal project built with [Cursor](https://www.cursor.com/) AI-assisted development.
It is provided as-is with no guarantees of active maintenance.
Issues will be looked at if they can be reproduced, or if a pull request is provided.

## Known Limitations / Caveats

- v1.0.0 targets standard Steam game installs; non-Steam shortcuts may not work correctly.
- TLS fallback behavior may be required on some systems with broken CA trust chains.
- Add-ons are filtered by detected game architecture; incompatible entries are hidden.
