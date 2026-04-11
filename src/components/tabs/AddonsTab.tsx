import { call, toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, PanelSection, PanelSectionRow, showModal } from "@decky/ui";
import { useState } from "react";
import ManageAddonsView from "../manage/ManageAddonsView";
import {
  catalogRefreshDegradedModalBody,
  catalogRefreshSuccessToastBody,
  type CatalogRefreshResult,
} from "../../utils/catalogRefreshToast";
import { toErrorDetails } from "../../utils/errorDetails";

function showError(message: string): void {
  const handle = showModal(
    <ConfirmModal
      bAlertDialog
      strTitle="RSM-Decky"
      strDescription={<div style={{ whiteSpace: "pre-wrap" }}>{message}</div>}
      onOK={() => handle.Close()}
      strOKButtonText="OK"
    />,
    window as unknown as EventTarget
  );
}

type AddonsTabProps = {
  gameDir: string;
};

const AddonsTab = ({ gameDir }: AddonsTabProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const refreshCatalog = async () => {
    setIsRefreshing(true);
    try {
      const res = await call<[boolean], CatalogRefreshResult>("catalog_refresh", true);
      if (res.force_refresh && res.ok && !res.warning) {
        toaster.toast({
          title: "RSM-Decky",
          body: catalogRefreshSuccessToastBody(res),
        });
      } else {
        showError(catalogRefreshDegradedModalBody(res));
      }
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setIsRefreshing(false);
    }
  };

  if (showManage) {
    return <ManageAddonsView gameDir={gameDir} onExit={() => setShowManage(false)} />;
  }

  return (
    <div style={{ padding: "8px", overflowY: "auto", maxHeight: "100%" }}>
      <PanelSection title="Add-ons">
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={isRefreshing} onClick={refreshCatalog}>
            {isRefreshing ? "Refreshing..." : "Refresh Catalog"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={isRefreshing} onClick={() => setShowManage(true)}>
            Manage Add-ons
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

export default AddonsTab;
