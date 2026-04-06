/**
 * Library context menu patch (pattern from decky-steamgriddb / CheatDeck).
 * Inject "RSM-Decky" and navigate to /rsm-decky/:appid.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  afterPatch,
  fakeRenderComponent,
  findInReactTree,
  findModuleByExport,
  Export,
  MenuItem,
  Navigation,
  Patch,
  findInTree,
} from "@decky/ui";
import type { FC } from "react";

const MENU_KEY = "rsm-decky-spike";

const spliceMenuItem = (children: any[], appid: number) => {
  const propertiesMenuItemIdx = children.findIndex((item) =>
    findInReactTree(item, (x) => x?.onSelected && x.onSelected.toString().includes("AppProperties"))
  );
  if (propertiesMenuItemIdx < 0) {
    return;
  }
  children.splice(
    propertiesMenuItemIdx,
    0,
    <MenuItem
      key={MENU_KEY}
      onSelected={() => {
        Navigation.Navigate(`/rsm-decky/${appid}`);
      }}
    >
      RSM-Decky
    </MenuItem>
  );
};

const isOpeningAppContextMenu = (items: any[]) => {
  if (!items?.length) {
    return false;
  }
  return !!findInReactTree(
    items,
    (x) => x?.props?.onSelected && x?.props?.onSelected.toString().includes("launchSource")
  );
};

const handleItemDupes = (items: any[]) => {
  const idx = items.findIndex((x: any) => x?.key === MENU_KEY);
  if (idx !== -1) {
    items.splice(idx, 1);
  }
};

const patchMenuItems = (menuItems: any[], appid: number) => {
  let updatedAppid: number = appid;
  const parentOverview = menuItems.find(
    (x: any) =>
      x?._owner?.pendingProps?.overview?.appid && x._owner.pendingProps.overview.appid !== appid
  );
  if (parentOverview) {
    updatedAppid = parentOverview._owner.pendingProps.overview.appid;
  }
  if (updatedAppid === appid) {
    const foundApp = findInTree(menuItems, (x) => x?.app?.appid, { walkable: ["props", "children"] });
    if (foundApp) {
      updatedAppid = foundApp.app.appid;
    }
  }
  spliceMenuItem(menuItems, updatedAppid);
};

const contextMenuPatch = (LibraryContextMenu: any) => {
  const patches: {
    outer?: Patch;
    inner?: Patch;
    unpatch: () => void;
  } = {
    unpatch: () => {
      return;
    },
  };
  patches.outer = afterPatch(LibraryContextMenu.prototype, "render", (_: Record<string, unknown>[], component: any) => {
    let appid = 0;
    if (component._owner) {
      appid = component._owner.pendingProps.overview.appid;
    } else {
      const foundApp = findInTree(component.props.children, (x) => x?.app?.appid, {
        walkable: ["props", "children"],
      });
      if (foundApp) {
        appid = foundApp.app.appid;
      }
    }

    if (!patches.inner) {
      patches.inner = afterPatch(component, "type", (_: any, ret: any) => {
        afterPatch(ret.type.prototype, "render", (_inner: any, ret2: any) => {
          const menuItems = ret2.props.children[0];
          if (!isOpeningAppContextMenu(menuItems)) {
            return ret2;
          }
          try {
            handleItemDupes(menuItems);
          } catch {
            return ret2;
          }
          patchMenuItems(menuItems, appid);
          return ret2;
        });

        afterPatch(ret.type.prototype, "shouldComponentUpdate", ([nextProps]: any, shouldUpdate: any) => {
          try {
            handleItemDupes(nextProps.children);
          } catch {
            return shouldUpdate;
          }
          if (shouldUpdate === true) {
            patchMenuItems(nextProps.children, appid);
          }
          return shouldUpdate;
        });
        return ret;
      });
    } else {
      spliceMenuItem(component.props.children, appid);
    }
    return component;
  });
  patches.unpatch = () => {
    patches.outer?.unpatch();
    patches.inner?.unpatch();
  };
  return patches;
};

export const LibraryContextMenu = fakeRenderComponent(
  Object.values(
    findModuleByExport((e: Export) => e?.toString && e.toString().includes("().LibraryContextMenu"))
  ).find((sibling) => sibling?.toString().includes("navigator:")) as FC
).type;

export default contextMenuPatch;
