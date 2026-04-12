import { call, toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, PanelSection, PanelSectionRow, showModal } from "@decky/ui";
import { useState } from "react";

import AddRepositoryModal from "../dialogs/AddRepositoryModal";
import ManageShadersView from "../manage/ManageShadersView";
import {
  catalogRefreshDegradedModalBody,
  catalogRefreshSuccessToastBody,
  type CatalogRefreshResult,
} from "../../utils/catalogRefreshToast";
import { toErrorDetails } from "../../utils/errorDetails";

type UpdateClonesResult = {
  status: "updated" | "already_up_to_date" | "partial_failure" | "complete_failure" | "no_clones";
  existing_clone_count: number;
  updated_count: number;
  failed_count: number;
  failures: string[];
};

type RepositoriesAddResult = {
  added_repo_id: string;
  user_repo_count: number;
};

type ShadersTabProps = {
  gameDir: string;
};

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

const ShadersTab = ({ gameDir }: ShadersTabProps) => {
  const [busyAction, setBusyAction] = useState<null | "refresh" | "update" | "add">(null);
  const [showManage, setShowManage] = useState(false);

  const refreshCatalog = async () => {
    setBusyAction("refresh");
    try {
      const res = await call<[boolean], CatalogRefreshResult>("catalog_refresh", true);
      switch (res.status) {
        case "success_no_changes":
        case "success_with_changes":
          toaster.toast({
            title: "RSM-Decky",
            body: catalogRefreshSuccessToastBody(res),
          });
          break;
        case "failed_with_cache":
        case "failed_no_cache":
          showError(catalogRefreshDegradedModalBody(res));
          break;
      }
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setBusyAction(null);
    }
  };

  const updateClones = async () => {
    setBusyAction("update");
    try {
      const res = await call<[], UpdateClonesResult>("catalog_update_clones");
      switch (res.status) {
        case "updated":
          toaster.toast({
            title: "RSM-Decky",
            body: `Updated ${res.updated_count} local clone(s).`,
          });
          break;
        case "already_up_to_date":
          toaster.toast({
            title: "RSM-Decky",
            body: "Local clones are already up to date.",
          });
          break;
        case "partial_failure":
          showError(
            `Updated ${res.updated_count} local clone(s), but ${res.failed_count} failed.\n\nFailures:\n${res.failures.join(
              "\n"
            )}`
          );
          break;
        case "complete_failure":
          showError("Failed to update local clones.");
          break;
        case "no_clones":
          showError("No local clones found to update.");
          break;
      }
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setBusyAction(null);
    }
  };

  const openAddRepository = () => {
    let handle: { Close: () => void } | undefined;
    handle = showModal(
      <AddRepositoryModal
        closeModal={() => handle?.Close()}
        onSubmit={async (form) => {
          setBusyAction("add");
          try {
            const res = await call<
              [string, string, string, string, string],
              RepositoriesAddResult
            >(
              "repositories_add",
              form.repoId,
              form.displayName,
              form.gitUrl,
              form.author,
              form.description
            );
            toaster.toast({
              title: "RSM-Decky",
              body: `Added repository "${res.added_repo_id}".`,
            });
          } finally {
            setBusyAction(null);
          }
        }}
      />,
      window as unknown as EventTarget,
      { strTitle: "Add Repository" }
    );
  };

  const disabled = busyAction !== null;

  if (showManage) {
    return <ManageShadersView gameDir={gameDir} onExit={() => setShowManage(false)} />;
  }

  return (
    <div style={{ padding: "8px", overflowY: "auto", maxHeight: "100%" }}>
      <PanelSection title="Shaders">
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={disabled} onClick={refreshCatalog}>
            {busyAction === "refresh" ? "Refreshing..." : "Refresh Shader Catalog"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={disabled} onClick={updateClones}>
            {busyAction === "update" ? "Updating..." : "Update Downloaded Shader Repos"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={disabled} onClick={openAddRepository}>
            {busyAction === "add" ? "Adding..." : "Add Repository"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={disabled} onClick={() => setShowManage(true)}>
            Manage Shaders
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

export default ShadersTab;
