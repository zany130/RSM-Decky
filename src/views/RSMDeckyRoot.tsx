import { SidebarNavigation, useParams } from "@decky/ui";
import { call } from "@decky/api";
import { useEffect, useMemo, useState } from "react";

import ReShadeTab from "../components/tabs/ReShadeTab";
import ShadersTab from "../components/tabs/ShadersTab";
import AddonsTab from "../components/tabs/AddonsTab";
import { toErrorDetails } from "../utils/errorDetails";

declare const SteamClient: {
  Apps: {
    RegisterForAppDetails(
      appId: number,
      callback: (data: Record<string, unknown>) => void
    ): {
      unregister: () => void;
    };
  };
};

type ValidateGameDirResult = { valid: boolean; reason?: string };

const RSMDeckyRoot = () => {
  const { appid } = useParams<{ appid: string }>();
  const appId = useMemo(() => {
    const parsed = typeof appid === "string" ? Number.parseInt(appid, 10) : Number(appid);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [appid]);

  const [title, setTitle] = useState<string>("Loading...");
  const [gameDir, setGameDir] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<string>("reshade");

  useEffect(() => {
    let registration: { unregister: () => void } | null = null;
    let cancelled = false;

    const resolveDetails = async (detail: Record<string, unknown>) => {
      const displayName = typeof detail.strDisplayName === "string" ? detail.strDisplayName : "";
      const installFolder = typeof detail.strInstallFolder === "string" ? detail.strInstallFolder.trim() : "";
      setTitle(displayName || "Unknown title");

      if (!installFolder) {
        setGameDir(null);
        setLoadError(
          "No valid install folder was provided by Steam AppDetails. v1 does not support this target yet."
        );
        setIsResolving(false);
        return;
      }

      try {
        const validation = await call<[string], ValidateGameDirResult>("validate_game_dir", installFolder);
        if (cancelled) {
          return;
        }
        if (!validation.valid) {
          setGameDir(null);
          setLoadError(
            validation.reason ||
              "The reported install folder is invalid. v1 currently supports standard installed Steam games only."
          );
          setIsResolving(false);
          return;
        }

        setGameDir(installFolder);
        setLoadError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setGameDir(null);
        setLoadError(`Could not validate install folder. ${toErrorDetails(error)}`);
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    };

    if (!appId) {
      setTitle("Unknown title");
      setGameDir(null);
      setLoadError("Invalid appId in route.");
      setIsResolving(false);
      return () => {
        cancelled = true;
      };
    }

    setIsResolving(true);
    setLoadError(null);
    setGameDir(null);

    registration = SteamClient.Apps.RegisterForAppDetails(appId, (detail) => {
      registration?.unregister();
      registration = null;
      void resolveDetails(detail);
    });

    return () => {
      cancelled = true;
      registration?.unregister();
    };
  }, [appId]);

  const header = (
    <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontWeight: 600, fontSize: "15px" }}>{title}</div>
      <div style={{ fontSize: "11px", opacity: 0.75, marginTop: "2px" }}>appId {appId || "—"}</div>
      {gameDir && (
        <div style={{ fontSize: "10px", opacity: 0.65, marginTop: "4px", wordBreak: "break-all" }}>{gameDir}</div>
      )}
      {isResolving && <div style={{ fontSize: "11px", marginTop: "6px", opacity: 0.8 }}>Resolving game…</div>}
      {loadError && (
        <div style={{ color: "salmon", fontSize: "12px", marginTop: "8px", lineHeight: 1.35 }}>{loadError}</div>
      )}
    </div>
  );

  const shellReady = Boolean(gameDir) && !loadError && !isResolving;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
      }}
    >
      {header}
      {shellReady && gameDir ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <SidebarNavigation
            title="RSM-Decky"
            page={activePage}
            onPageRequested={setActivePage}
            pages={[
              {
                title: "ReShade",
                identifier: "reshade",
                content: <ReShadeTab gameDir={gameDir} />,
              },
              {
                title: "Shaders",
                identifier: "shaders",
                content: <ShadersTab gameDir={gameDir} />,
              },
              {
                title: "Add-ons",
                identifier: "addons",
                content: <AddonsTab gameDir={gameDir} />,
              },
            ]}
          />
        </div>
      ) : (
        !isResolving &&
        loadError && (
          <div style={{ padding: "12px", fontSize: "12px", opacity: 0.85 }}>
            Fix the issue above, then reopen RSM-Decky from the game menu.
          </div>
        )
      )}
    </div>
  );
};

export default RSMDeckyRoot;
