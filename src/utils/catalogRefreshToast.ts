export type CatalogRefreshResult = {
  status: "success_no_changes" | "success_with_changes" | "failed_with_cache" | "failed_no_cache";
  shader_repo_count: number;
  addon_count: number;
  force_refresh: boolean;
  builtin_shader_repo_count: number;
  changed: boolean;
  pcgw_upstream_ok: boolean;
  pcgw_used_stale_cache: boolean;
  pcgw_from_ttl_cache: boolean;
  addons_upstream_ok: boolean;
  addons_used_stale_cache: boolean;
  addons_from_ttl_cache: boolean;
  message?: string;
};

export function catalogRefreshSuccessToastBody(res: CatalogRefreshResult): string {
  if (res.status === "success_no_changes") {
    return "Catalog is already up to date.";
  }
  return "Catalog refreshed successfully.";
}

export function catalogRefreshDegradedModalBody(res: CatalogRefreshResult): string {
  if (res.status === "failed_with_cache") {
    return "Catalog refresh failed. Showing cached data.";
  }
  const lines = ["Catalog refresh failed. No cached catalog available."];
  if (res.builtin_shader_repo_count > 0) {
    lines.push("");
    lines.push(
      `Built-in shader repositories are still available (${res.builtin_shader_repo_count}).`
    );
  }
  if (res.message && res.message.trim()) {
    lines.push("");
    lines.push(res.message.trim());
  }
  return lines.join("\n");
}
