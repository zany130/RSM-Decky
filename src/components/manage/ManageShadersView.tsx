import { call, toaster } from "@decky/api";
import { ButtonItem, ConfirmModal, PanelSection, PanelSectionRow, TextField, ToggleField, showModal } from "@decky/ui";
import { useEffect, useMemo, useState } from "react";
import { toErrorDetails } from "../../utils/errorDetails";

type ShaderRow = {
  id: string;
  name: string;
  author: string;
  description: string;
  installed: boolean;
};

type ShadersPreflightResult = {
  rows: ShaderRow[];
  baseline_repo_ids: string[];
  desired_repo_ids: string[];
  unknown_repo_ids: string[];
  has_changes: boolean;
  pending_install_ids: string[];
  pending_uninstall_ids: string[];
};

type ShadersApplyResult = {
  enabled_repo_ids: string[];
  applied_count: number;
};

type ManageShadersViewProps = {
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
        strTitle="Discard pending shader changes?"
        strDescription="You have unsaved changes in Manage Shaders."
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

const ManageShadersView = ({ gameDir, onExit }: ManageShadersViewProps) => {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ShaderRow[]>([]);
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [desired, setDesired] = useState<Set<string>>(new Set());

  const loadPreflight = async (desiredIds?: string[]) => {
    const selected = desiredIds ?? Array.from(desired);
    const res = await call<[string, string[]], ShadersPreflightResult>("shaders_preflight", gameDir, selected);
    setRows(
      [...res.rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
    const base = new Set(res.baseline_repo_ids);
    setBaseline(base);
    if (desiredIds) {
      setDesired(new Set(desiredIds));
    } else {
      setDesired(new Set(res.baseline_repo_ids));
    }
    setLoadError(null);
  };

  const retryLoad = async () => {
    setLoading(true);
    try {
      await loadPreflight();
    } catch (e: unknown) {
      setLoadError(toErrorDetails(e));
    } finally {
      setLoading(false);
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
          setLoadError(toErrorDetails(e));
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

  const toggleRow = (repoId: string, nextChecked: boolean) => {
    setDesired((prev) => {
      const next = new Set(prev);
      if (nextChecked) {
        next.add(repoId);
      } else {
        next.delete(repoId);
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
    if (!pendingChanges || applying || loadError) {
      return;
    }
    setApplying(true);
    try {
      const desiredIds = Array.from(desired).sort((a, b) => a.localeCompare(b));
      await call<[string, string[]], ShadersApplyResult>("shaders_apply", gameDir, desiredIds);
      await loadPreflight(desiredIds);
      toaster.toast({ title: "RSM-Decky", body: "Shader selection applied." });
      onExit();
    } catch (e: unknown) {
      showError(toErrorDetails(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ padding: "8px", overflowY: "auto", maxHeight: "100%" }}>
      <PanelSection title="Manage Shaders">
          <PanelSectionRow>
            <TextField
              label="Search"
              description="Filter by name, author, or description."
              value={search}
              disabled={loading || applying}
              onChange={(ev) => setSearch(ev.target.value)}
            />
          </PanelSectionRow>
          {loadError && (
            <>
              <PanelSectionRow>
                <div style={{ color: "salmon", fontSize: "12px", whiteSpace: "pre-wrap" }}>{loadError}</div>
              </PanelSectionRow>
              <PanelSectionRow>
                <ButtonItem layout="below" disabled={loading || applying} onClick={() => void retryLoad()}>
                  {loading ? "Retrying..." : "Retry"}
                </ButtonItem>
              </PanelSectionRow>
            </>
          )}
      </PanelSection>

      <PanelSection title={`Installed (${installedRows.length})`}>
          {installedRows.map((r) => (
            <PanelSectionRow key={r.id}>
              <ToggleField
                checked={desired.has(r.id)}
                disabled={loading || applying || !!loadError}
                onChange={(checked) => toggleRow(r.id, checked)}
                label={r.name}
                description={`${r.author || "Unknown author"}${r.description ? ` • ${r.description}` : ""}`}
              />
            </PanelSectionRow>
          ))}
          {installedRows.length === 0 && (
            <PanelSectionRow>
              <div style={{ opacity: 0.8, fontSize: "12px" }}>No installed shader repositories.</div>
            </PanelSectionRow>
          )}
      </PanelSection>

      <PanelSection title={`Available (${availableRows.length})`}>
          {availableRows.map((r) => (
            <PanelSectionRow key={r.id}>
              <ToggleField
                checked={desired.has(r.id)}
                disabled={loading || applying || !!loadError}
                onChange={(checked) => toggleRow(r.id, checked)}
                label={r.name}
                description={`${r.author || "Unknown author"}${r.description ? ` • ${r.description}` : ""}`}
              />
            </PanelSectionRow>
          ))}
          {availableRows.length === 0 && (
            <PanelSectionRow>
              <div style={{ opacity: 0.8, fontSize: "12px" }}>No available shader repositories.</div>
            </PanelSectionRow>
          )}
      </PanelSection>

      <PanelSection title="Actions">
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={!pendingChanges || applying || loading || !!loadError} onClick={apply}>
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

export default ManageShadersView;
