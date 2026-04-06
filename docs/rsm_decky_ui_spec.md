# RSM-Decky UI Spec

## Purpose
RSM-Decky is a per-game Decky Loader plugin for managing ReShade, shader repositories, and add-ons for the currently selected Steam game.

This plugin is **not** a global game manager.

It is launched from a specific game's context/options menu and operates on that game only.

---

## Core UX Model

### Entry Point
- User opens a game's context/options menu in Steam.
- User selects **RSM-Decky**.
- Plugin opens a game-specific fullscreen view.

### Main Navigation
The main RSM-Decky screen has a left sidebar with three sections:
- **ReShade**
- **Shaders**
- **Add-ons**

The right panel shows the selected section's content.

### Secondary Views
The following actions open fullscreen management views:
- **Manage Shaders**
- **Manage Add-ons**

These are not tiny dialogs. They behave like fullscreen modal/page views.

### Overlay Windows
Small overlay dialogs are reserved for:
- confirmation prompts
- error messages
- short input dialogs such as Add Repository

### Feedback Model
- **Success** -> toast
- **Error** -> overlay popup
- **Confirmation** -> overlay popup

---

## Scope Changes From GTK App

The Decky version intentionally removes the following from the main UI:
- recent games
- game directory picker
- executable picker / clear EXE

Reason: the target game is already implied by the Steam game context menu entry.

The Decky version keeps the functionality that still makes sense and reorganizes it into a controller-friendly per-game UI.

---

## Main Screen Layout

### Header
The top area should show game-specific context, for example:
- game name
- optional app ID

This is informational only. The user does not select a target game here.

### Sidebar
Three items:
- ReShade
- Shaders
- Add-ons

### Content Panel
The content panel changes based on the selected sidebar item.

---

## ReShade Tab

### Purpose
Handles core ReShade installation and maintenance for the current game.

### Sections

#### 1. Status
Show current ReShade state for the selected game.
Examples:
- Installed / Not Installed
- installed version if known

#### 2. Installation Settings
Fields:
- **Graphics API** (manual selection required)
- **Variant**
- **Version**

Notes:
- Graphics API is manual only.
- Auto-detection is not required.
- If no API is selected, install action can either be disabled or show an error popup. Either behavior is acceptable; use whichever is easier to implement cleanly.

#### 3. Actions
Buttons:
- **Install**
- **Update / Reinstall**
- **Uninstall**
- **Check**

### ReShade Tab Notes
- Use the term **Uninstall** consistently.
- Keep this tab focused on ReShade core behavior only.
- Do not add game path or EXE controls to the main v1 UI.

---

## Shaders Tab

### Purpose
Handles catalog and repository actions related to shader content.

### Buttons
- **Refresh Catalog**
- **Update Local Clones**
- **Add Repository**
- **Manage Shaders**

### Notes
- The catalog is treated as a shared logical catalog in the UX, even if underlying shader and add-on data come from different sources.
- Refresh Catalog is allowed here even though the catalog is shared.
- This tab should remain lightweight. Detailed item management happens in the fullscreen Manage Shaders view.

---

## Add-ons Tab

### Purpose
Handles catalog refresh and add-on management.

### Buttons
- **Refresh Catalog**
- **Manage Add-ons**

### Notes
- Use the standardized term **Add-ons** everywhere.
- Like the Shaders tab, this tab is a lightweight launcher for deeper management.

---

## Manage Shaders View

### Purpose
Allows the user to browse and choose the desired final set of shader repos/packages.

### Layout

#### Top
- Title: **Manage Shaders**
- Search field

#### Middle
A scrollable list grouped into:
- **Installed**
- **Available**

Each row should be controller-friendly, not a dense desktop table.

Recommended row contents:
- name
- author
- optional short description
- checkbox/checkmark

Description can be included if it fits cleanly. Search may match name, author, and optionally description.

#### Bottom
- **Cancel** / Back action
- **Apply** button

### Row Interaction
- User navigates to a row.
- Pressing **A** or tapping the checkbox toggles the desired state.
- A checkmark indicates the desired final state for that item.

### Desired State Rules
This is the final authoritative model:
- **Checked = desired final state is installed/enabled**
- **Unchecked = desired final state is not installed/enabled**

Interpretation by group:
- Installed + checked = no pending change
- Installed + unchecked = pending uninstall
- Available + unchecked = no pending change
- Available + checked = pending install

### Apply Behavior
- Apply is disabled until a real change exists.
- Pressing Apply executes immediately.
- No confirmation popup before Apply.
- A preflight verification runs first.
- No partial apply is allowed.
- Either all selected changes apply successfully, or none do.

### Leaving With Pending Changes
If the user tries to leave with pending changes:
- show confirmation overlay popup
- ask whether they are sure they want to discard changes

### Sorting and Search
- No sort control in v1.
- Default ordering is alphabetical.
- Search is live.
- Search should match:
  - name
  - author
  - optionally description if clean/easy

---

## Manage Add-ons View

### Purpose
Same model as Manage Shaders, but filtered to add-ons.

### Layout
Use the same structure as Manage Shaders:
- title
- search field
- Installed group
- Available group
- Apply button
- Cancel / Back action

### Behavior
Use the same behavior rules as Manage Shaders:
- checked means desired final state
- Apply is instant
- no partial apply
- back with pending changes requires confirmation
- success uses toast
- errors use overlay popup

---

## Overlay Dialogs

### Use Cases
Overlay dialogs should be used for:
- confirmations
- errors
- Add Repository input flow

### Examples
- Confirm discard changes
- Confirm uninstall/remove if needed
- Invalid repository URL
- Refresh failed
- Add Repository form

### Add Repository Dialog
This should be a simple popup dialog with text inputs for the required fields.
Exact fields can be finalized during implementation, but this is intentionally a small overlay interaction, not a fullscreen view.

---

## Toasts

### Use Cases
Toasts are used for successful operations only.

Examples:
- ReShade installed successfully
- Catalog refreshed
- 3 shaders applied successfully
- 2 add-ons applied successfully

### Notes
- Keep them brief.
- Do not use a popup for normal success.

---

## Loading States
Use a simple spinner/loading indicator for operations such as:
- loading management views
- refreshing catalog
- applying changes

If Decky already provides a simple spinner/loading component, use that.

---

## Terminology Standards
Use these labels consistently throughout the plugin:
- **Add-ons**
- **Manage Add-ons**
- **Uninstall**
- **Refresh Catalog**
- **Update / Reinstall**

Avoid mixing alternative labels unless required by backend naming.

---

## UI Mockups (Text Reference)

### Main Screen
```text
RSM-Decky
Hollow Knight

[ ReShade ]
[ Shaders ]
[ Add-ons ]

ReShade
---------------------
Status
ReShade: Not Installed

Installation Settings
Graphics API   [ DirectX 11 ▼ ]
Variant        [ Standard ▼ ]
Version        [ Latest ▼ ]

Actions
[ Install ]
[ Update / Reinstall ]
[ Uninstall ]
[ Check ]
```

### Shaders Tab
```text
Shaders
---------------------
Catalog
[ Refresh Catalog ]
[ Update Local Clones ]
[ Add Repository ]

Shader Management
[ Manage Shaders ]
```

### Add-ons Tab
```text
Add-ons
---------------------
Catalog
[ Refresh Catalog ]

Add-on Management
[ Manage Add-ons ]
```

### Manage Shaders View
```text
Manage Shaders
[ Search... ]

Installed
[✓] qUINT
Marty McFly

[✓] SweetFX
Crosire

Available
[ ] RTGI
Marty McFly

[ ] FilmicPass
Some Author

[ Cancel ]    [ Apply ]
```

### Manage Add-ons View
```text
Manage Add-ons
[ Search... ]

Installed
[✓] Add-on A
Author Name

Available
[ ] Add-on B
Author Name

[ Cancel ]    [ Apply ]
```

---

## Recommended Component Structure

```text
RSMDeckyRoot
├── GameHeader
├── SidebarNav
├── ReShadeTab
├── ShadersTab
├── AddonsTab
├── ManageShadersView
├── ManageAddonsView
├── OverlayDialog
├── ToastManager
└── LoadingSpinner
```

---

## Recommended State Concepts

### Per-game
- selected game / app ID context
- ReShade settings for that game
- selected API for that game

### Catalog / Global-ish
- shader catalog data
- add-on catalog data
- repositories

### Manage-view local state
- current search text
- desired final checked state
- pending changes detected or not

---

## Final UX Rules Summary

1. RSM-Decky is launched from a game's context menu.
2. Main UI uses a sidebar with ReShade, Shaders, and Add-ons.
3. Manage Shaders and Manage Add-ons open fullscreen secondary views.
4. Overlay dialogs are only for confirmations, errors, and small input forms.
5. Success uses toast.
6. Apply is immediate and has no confirmation.
7. No partial apply is allowed.
8. Checked means desired final state.
9. Back with pending changes asks for confirmation.
10. Search is live and sorting is simple alphabetical by default.

---

## Guidance For Implementation
When implementing, prioritize:
1. overall navigation flow
2. desired final state logic in manage views
3. disabling Apply until changes exist
4. preflight validation before apply
5. clean success/error feedback behavior

Avoid overengineering v1 with extra sort controls, extra global configuration screens, or manual file/executable picking.

