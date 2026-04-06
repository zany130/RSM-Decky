import { definePlugin, staticClasses } from "@decky/ui";
import { routerHook } from "@decky/api";
import { FaFlask } from "react-icons/fa";

import contextMenuPatch, { LibraryContextMenu } from "./patch";
import RSMDeckyRoot from "./views/RSMDeckyRoot";

const SPIKE_ROUTE = "/rsm-decky/:appid";

export default definePlugin(() => {
  const menuPatches = contextMenuPatch(LibraryContextMenu);

  routerHook.addRoute(SPIKE_ROUTE, RSMDeckyRoot, { exact: true });

  return {
    name: "RSM-Decky",
    titleView: <div className={staticClasses.Title}>RSM-Decky</div>,
    content: (
      <div style={{ padding: "8px" }}>
        Open a game in your library → ⋯ menu → <b>RSM-Decky</b> to launch the per-game view.
      </div>
    ),
    icon: <FaFlask />,
    onDismount() {
      routerHook.removeRoute(SPIKE_ROUTE);
      menuPatches?.unpatch();
    },
  };
});
