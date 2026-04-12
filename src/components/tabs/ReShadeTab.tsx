import {
  ButtonItem,
  ConfirmModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  showModal,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useCallback, useEffect, useRef, useState } from "react";

import { GRAPHICS_API_OPTIONS, VARIANT_OPTIONS } from "../../constants/reshade";
import { toErrorDetails } from "../../utils/errorDetails";

type GameManifestJson = {
  graphics_api?: string;
  reshade_variant?: string;
  reshade_version?: string;
  installed_reshade_files?: string[];
};

type ResolveManifestResult = {
  manifest: GameManifestJson;
  arch_error: string | null;
};

type ReshadeStatus = {
  has_manifest: boolean;
  installed: boolean;
  graphics_api: string | null;
  reshade_version: string | null;
  variant: string | null;
  arch: string | null;
  arch_error: string | null;
};

type ReShadeTabProps = {
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

function showAddonVersionWarning(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let handle: { Close: () => void } | undefined;
    const settle = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
      handle?.Close();
    };
    handle = showModal(
      <ConfirmModal
        bAlertDialog
        strTitle="Addon version warning"
        strDescription={
          <div style={{ whiteSpace: "pre-wrap" }}>
            {"The addon version of ReShade may trigger anti-cheat or integrity systems in some games.\n\nDo NOT use this in online or multiplayer games.\n\nContinue only if you understand the risk."}
          </div>
        }
        onCancel={() => settle(false)}
        onOK={() => settle(true)}
        strCancelButtonText="Cancel"
        strOKButtonText="Continue"
      />,
      window as unknown as EventTarget
    );
  });
}

const ReShadeTab = ({ gameDir }: ReShadeTabProps) => {
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [resolveArchError, setResolveArchError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReshadeStatus | null>(null);

  const [graphicsApi, setGraphicsApi] = useState<string>("");
  const [variant, setVariant] = useState<string>("standard");
  const [version, setVersion] = useState<string>("latest");

  const applyManifestToForm = useCallback((m: GameManifestJson) => {
    const hasInstallHint =
      (m.installed_reshade_files && m.installed_reshade_files.length > 0) ||
      !!(m.reshade_version && String(m.reshade_version).trim());

    if (hasInstallHint && m.graphics_api) {
      setGraphicsApi(String(m.graphics_api));
    } else {
      setGraphicsApi("");
    }
    setVariant(m.reshade_variant ? String(m.reshade_variant) : "standard");
    setVersion(m.reshade_version && String(m.reshade_version).trim() ? String(m.reshade_version) : "latest");
  }, []);

  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const [resolved, st] = await Promise.all([
        call<[string], ResolveManifestResult>("game_resolve_manifest", gameDir),
        call<[string], ReshadeStatus>("reshade_get_status", gameDir),
      ]);
      if (!mountedRef.current) {
        return;
      }
      setResolveArchError(resolved.arch_error ?? null);
      applyManifestToForm(resolved.manifest);
      setStatus(st);
    } catch (e: unknown) {
      if (!mountedRef.current) {
        return;
      }
      showError(toErrorDetails(e));
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }, [applyManifestToForm, gameDir]);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const runAction = async (toastBody: string, fn: () => Promise<unknown>) => {
    setActionBusy(true);
    try {
      await fn();
      toaster.toast({ title: "RSM-Decky", body: toastBody });
      await loadData();
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setActionBusy(false);
    }
  };

  const installDisabled =
    busy || actionBusy || !graphicsApi || !!(resolveArchError || status?.arch_error);

  const apiForUpdate = graphicsApi || (status?.graphics_api ?? "") || "";
  const variantForUpdate = variant || (status?.variant ?? "") || "standard";

  const combinedArchError = resolveArchError || status?.arch_error;
  const shouldWarnForAddonVariant = (v: string) => v.trim().toLowerCase() === "addon";

  const confirmAddonRiskIfNeeded = async (variantValue: string): Promise<boolean> => {
    if (!shouldWarnForAddonVariant(variantValue)) {
      return true;
    }
    return showAddonVersionWarning();
  };

  const statusLines = () => {
    if (!status) {
      return "Loading…";
    }
    if (!status.has_manifest) {
      return "No saved manifest yet (new game profile).";
    }
    const parts = [
      `Installed (tracked files): ${status.installed ? "yes" : "no"}`,
      `Architecture: ${status.arch ?? "—"}`,
      `Manifest API: ${status.graphics_api ?? "—"}`,
      `Manifest version: ${status.reshade_version ?? "—"}`,
      `Variant: ${status.variant ?? "—"}`,
    ];
    return parts.join("\n");
  };

  const onInstall = async () => {
    const confirmed = await confirmAddonRiskIfNeeded(variant);
    if (!confirmed) {
      return;
    }
    await runAction(
      "ReShade installed.",
      () =>
        call<[string, string, string, string], { message?: string }>(
          "reshade_install",
          gameDir,
          graphicsApi,
          variant,
          version.trim() || "latest"
        )
    );
  };

  const onUpdateReinstall = async () => {
    const confirmed = await confirmAddonRiskIfNeeded(variantForUpdate);
    if (!confirmed) {
      return;
    }
    await runAction(
      "ReShade updated / reinstalled.",
      () =>
        call<[string, string, string], { message?: string }>(
          "reshade_update_reinstall",
          gameDir,
          apiForUpdate,
          variantForUpdate
        )
    );
  };

  return (
    <div style={{ padding: "8px", overflowY: "auto", maxHeight: "100%" }}>
      <PanelSection title="Status">
        <PanelSectionRow>
          <div style={{ whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: 1.35 }}>{statusLines()}</div>
        </PanelSectionRow>
        {combinedArchError && (
          <PanelSectionRow>
            <div style={{ color: "salmon", fontSize: "12px" }}>{combinedArchError}</div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Installation settings">
        <PanelSectionRow>
          <DropdownItem
            label="Graphics API"
            disabled={busy || actionBusy}
            menuLabel="Graphics API"
            strDefaultLabel={graphicsApi ? undefined : "Select graphics API (required)"}
            rgOptions={[...GRAPHICS_API_OPTIONS]}
            selectedOption={graphicsApi}
            onChange={(opt) => {
              const parsed = String((opt as { data?: string }).data ?? "");
              setGraphicsApi(parsed);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <DropdownItem
            label="Variant"
            disabled={busy || actionBusy}
            menuLabel="Variant"
            rgOptions={[...VARIANT_OPTIONS]}
            selectedOption={variant}
            onChange={(opt) => {
              const parsed = String((opt as { data?: string }).data ?? "");
              setVariant(parsed);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="Version"
            description='ReShade version (e.g. 6.7.3) or "latest".'
            disabled={busy || actionBusy}
            value={version}
            onChange={(ev) => setVersion(ev.target.value)}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Actions">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={installDisabled}
            onClick={onInstall}
          >
            Install
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={
              busy || actionBusy || !!(resolveArchError || status?.arch_error) || !apiForUpdate || !status?.has_manifest
            }
            onClick={onUpdateReinstall}
          >
            Update / Reinstall
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busy || actionBusy || !status?.has_manifest}
            onClick={() =>
              runAction("ReShade uninstalled.", () =>
                call<[string], { message?: string }>("reshade_uninstall", gameDir)
              )
            }
          >
            Uninstall
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

export default ReShadeTab;
