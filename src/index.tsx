import { definePlugin, staticClasses } from "@decky/ui";
import { routerHook } from "@decky/api";
import { FaSlidersH } from "react-icons/fa";

import contextMenuPatch, { LibraryContextMenu } from "./patch";
import RSMDeckyRoot from "./views/RSMDeckyRoot";

const RSM_ROUTE = "/rsm-decky/:appid";

export default definePlugin(() => {
  const menuPatches = contextMenuPatch(LibraryContextMenu);

  routerHook.addRoute(RSM_ROUTE, RSMDeckyRoot, { exact: true });

  return {
    name: "RSM-Decky",
    titleView: <div className={staticClasses.Title}>RSM-Decky</div>,
    content: (
      <div style={{ padding: "8px" }}>
        Open a game in your library → ⋯ menu → <b>RSM-Decky</b> to launch the per-game view.
      </div>
    ),
    icon: <FaSlidersH />,
    onDismount() {
      routerHook.removeRoute(RSM_ROUTE);
      menuPatches?.unpatch();
    },
  };
});
