import {
  ButtonItem,
  ConfirmModal,
  PanelSection,
  PanelSectionRow,
  definePlugin,
  showModal,
  staticClasses,
} from "@decky/ui";
import { routerHook } from "@decky/api";
import { FaSlidersH } from "react-icons/fa";

import contextMenuPatch, { LibraryContextMenu } from "./patch";
import RSMDeckyRoot from "./views/RSMDeckyRoot";

const RSM_ROUTE = "/rsm-decky/:appid";
const GITHUB_URL = "https://github.com/zany130/RSM-Decky";

function openGitHubRepo(): void {
  window.open(GITHUB_URL, "_blank");
}

function showCredits(): void {
  const handle = showModal(
    <ConfirmModal
      bAlertDialog
      strTitle="Credits"
      strDescription={
        <div style={{ whiteSpace: "pre-wrap" }}>
          ReShade{"\n"}
          RSM (original project){"\n"}
          Decky Loader
        </div>
      }
      onOK={() => handle.Close()}
      strOKButtonText="Close"
    />,
    window as unknown as EventTarget
  );
}

export default definePlugin(() => {
  const menuPatches = contextMenuPatch(LibraryContextMenu);

  routerHook.addRoute(RSM_ROUTE, RSMDeckyRoot, { exact: true });

  return {
    name: "RSM-Decky",
    titleView: <div className={staticClasses.Title}>RSM-Decky</div>,
    content: (
      <div style={{ padding: "8px" }}>
        <PanelSection>
          <PanelSectionRow>
            <div style={{ fontSize: "20px", lineHeight: 1.3 }}>Manage ReShade, shaders, and addons</div>
          </PanelSectionRow>
          <PanelSectionRow>
            <div style={{ whiteSpace: "pre-line", fontSize: "17px", lineHeight: 1.35, opacity: 0.9 }}>
              {"Use from a game’s menu 🎮\nLibrary → Game → ⚙️ → RSM Decky"}
            </div>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={openGitHubRepo}>
              View on GitHub
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={showCredits}>
              Credits
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    ),
    icon: <FaSlidersH />,
    onDismount() {
      routerHook.removeRoute(RSM_ROUTE);
      menuPatches?.unpatch();
    },
  };
});
