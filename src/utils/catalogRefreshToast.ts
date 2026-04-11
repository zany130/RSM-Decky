export type CatalogRefreshResult = {
  shader_repo_count: number;
  addon_count: number;
  force_refresh: boolean;
  ok: boolean;
  builtin_shader_repo_count: number;
  pcgw_upstream_ok: boolean;
  pcgw_used_stale_cache: boolean;
  pcgw_from_ttl_cache: boolean;
  addons_upstream_ok: boolean;
  addons_used_stale_cache: boolean;
  addons_from_ttl_cache: boolean;
  warning: string | null;
};

function catalogSummaryLine(res: CatalogRefreshResult): string {
  return `${res.shader_repo_count} shader repos (${res.builtin_shader_repo_count} built-in), ${res.addon_count} add-ons`;
}

/** Full upstream success (Decky: user forced refresh and both sources OK). */
export function catalogRefreshSuccessToastBody(res: CatalogRefreshResult): string {
  return `Catalog refreshed from upstream: ${catalogSummaryLine(res)}.`;
}

/** Degraded or incomplete refresh: modal copy (not a success toast). */
export function catalogRefreshDegradedModalBody(res: CatalogRefreshResult): string {
  const lines = [
    "Catalog refresh failed or was incomplete. Counts below may reflect cached data, built-in repositories only, or partial upstream results.",
    "",
    catalogSummaryLine(res) + ".",
  ];
  if (res.warning) {
    lines.push("");
    lines.push(res.warning);
  }
  if (res.force_refresh && !res.ok) {
    lines.push("");
    lines.push("One or both upstream sources did not confirm a successful refresh.");
  }
  return lines.join("\n");
}
