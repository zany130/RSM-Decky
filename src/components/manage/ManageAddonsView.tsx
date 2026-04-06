import { call, toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, PanelSection, PanelSectionRow, TextField, ToggleField, showModal } from "@decky/ui";
import { useEffect, useMemo, useState } from "react";
import { toErrorDetails } from "../../utils/errorDetails";

type AddonRow = {
  id: string;
  name: string;
  author: string;
  description: string;
  installed: boolean;
  arch: string;
  download_arch: string;
  installability_reason: string;
};

type AddonsPreflightResult = {
  rows: AddonRow[];
  baseline_ids: string[];
  desired_ids: string[];
  unknown_ids: string[];
  has_changes: boolean;
  pending_install_ids: string[];
  pending_uninstall_ids: string[];
  arch: string;
  incompatible_count: number;
  incompatible_names: string[];
  incompatible_reason: string;
};

type AddonsApplyResult = {
  enabled_addon_ids: string[];
  applied_count: number;
};

type ManageAddonsViewProps = {
  gameDir: string;
  onExit: () => void;
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

function confirmDiscard(): Promise<boolean> {
  return new Promise((resolve) => {
    let handle: { Close: () => void } | undefined;
    handle = showModal(
      <ConfirmModal
        strTitle="Discard pending add-on changes?"
        strDescription="You have unsaved changes in Manage Add-ons."
        strOKButtonText="Discard"
        strCancelButtonText="Keep Editing"
        onOK={() => {
          handle?.Close();
          resolve(true);
        }}
        onCancel={() => {
          handle?.Close();
          resolve(false);
        }}
      />,
      window as unknown as EventTarget
    );
  });
}

const ManageAddonsView = ({ gameDir, onExit }: ManageAddonsViewProps) => {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AddonRow[]>([]);
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [desired, setDesired] = useState<Set<string>>(new Set());
  const [gameArch, setGameArch] = useState<string>("");
  const [incompatibleCount, setIncompatibleCount] = useState(0);
  const [incompatibleNames, setIncompatibleNames] = useState<string[]>([]);
  const [incompatibleReason, setIncompatibleReason] = useState("");

  const loadPreflight = async (desiredIds?: string[]) => {
    const selected = desiredIds ?? Array.from(desired);
    const res = await call<[string, string[]], AddonsPreflightResult>("addons_preflight", gameDir, selected);
    setRows(
      [...res.rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
    setGameArch(res.arch);
    setIncompatibleCount(res.incompatible_count || 0);
    setIncompatibleNames(Array.isArray(res.incompatible_names) ? res.incompatible_names : []);
    setIncompatibleReason(res.incompatible_reason || "");
    const base = new Set(res.baseline_ids);
    setBaseline(base);
    if (desiredIds) {
      setDesired(new Set(desiredIds));
    } else {
      setDesired(new Set(res.baseline_ids));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        await loadPreflight();
      } catch (e: unknown) {
        if (!cancelled) {
          showError(toErrorDetails(e));
          onExit();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [gameDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingChanges = useMemo(() => {
    if (desired.size !== baseline.size) {
      return true;
    }
    for (const rid of desired) {
      if (!baseline.has(rid)) {
        return true;
      }
    }
    return false;
  }, [baseline, desired]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter((r) => {
      const desc = r.description || "";
      return (
        r.name.toLowerCase().includes(term) ||
        r.author.toLowerCase().includes(term) ||
        desc.toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  const installedRows = filtered.filter((r) => baseline.has(r.id));
  const availableRows = filtered.filter((r) => !baseline.has(r.id));

  const toggleRow = (addonId: string, nextChecked: boolean) => {
    setDesired((prev) => {
      const next = new Set(prev);
      if (nextChecked) {
        next.add(addonId);
      } else {
        next.delete(addonId);
      }
      return next;
    });
  };

  const handleBack = async () => {
    if (!pendingChanges) {
      onExit();
      return;
    }
    const discard = await confirmDiscard();
    if (discard) {
      onExit();
    }
  };

  const apply = async () => {
    if (!pendingChanges || applying) {
      return;
    }
    setApplying(true);
    try {
      const desiredIds = Array.from(desired).sort((a, b) => a.localeCompare(b));
      await call<[string, string[]], AddonsApplyResult>("addons_apply", gameDir, desiredIds);
      setBaseline(new Set(desiredIds));
      await loadPreflight(desiredIds);
      toaster.toast({ title: "RSM-Decky", body: "Add-on selection applied." });
      onExit();
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ padding: "8px", overflowY: "auto", maxHeight: "100%" }}>
      <PanelSection title="Manage Add-ons">
        <PanelSectionRow>
          <TextField
            label="Search"
            description="Filter by name, author, or description."
            value={search}
            disabled={loading || applying}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </PanelSectionRow>
        {gameArch && (
          <PanelSectionRow>
            <div style={{ opacity: 0.8, fontSize: "12px" }}>
              Showing add-ons compatible with game architecture: {gameArch === "64" ? "x64" : "x86"}
            </div>
          </PanelSectionRow>
        )}
        {incompatibleCount > 0 && (
          <PanelSectionRow>
            <div style={{ opacity: 0.8, fontSize: "12px" }}>
              {incompatibleCount} add-on{incompatibleCount === 1 ? "" : "s"} hidden due to architecture
              mismatch.
              {incompatibleReason ? ` ${incompatibleReason}` : ""}
              {incompatibleNames.length ? ` Examples: ${incompatibleNames.join(", ")}.` : ""}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title={`Installed (${installedRows.length})`}>
        {installedRows.map((r) => (
          <PanelSectionRow key={r.id}>
            <ToggleField
              checked={desired.has(r.id)}
              disabled={loading || applying}
              onChange={(checked) => toggleRow(r.id, checked)}
              label={r.name}
              description={`${r.download_arch}${r.description ? ` • ${r.description}` : ""}`}
            />
          </PanelSectionRow>
        ))}
        {installedRows.length === 0 && (
          <PanelSectionRow>
            <div style={{ opacity: 0.8, fontSize: "12px" }}>No installed add-ons.</div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title={`Available (${availableRows.length})`}>
        {availableRows.map((r) => (
          <PanelSectionRow key={r.id}>
            <ToggleField
              checked={desired.has(r.id)}
              disabled={loading || applying}
              onChange={(checked) => toggleRow(r.id, checked)}
              label={r.name}
              description={`${r.download_arch}${r.description ? ` • ${r.description}` : ""}`}
            />
          </PanelSectionRow>
        ))}
        {availableRows.length === 0 && (
          <PanelSectionRow>
            <div style={{ opacity: 0.8, fontSize: "12px" }}>No available add-ons.</div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title="Actions">
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={!pendingChanges || applying || loading} onClick={apply}>
            {applying ? "Applying..." : "Apply"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={applying} onClick={handleBack}>
            Cancel / Back
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};

export default ManageAddonsView;
