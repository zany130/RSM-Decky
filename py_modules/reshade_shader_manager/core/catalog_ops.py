"""Fetch merged shader + plugin add-on catalogs (shared by GUI and CLI)."""

from __future__ import annotations

from reshade_shader_manager.core.config import AppConfig
from reshade_shader_manager.core.paths import RsmPaths
from reshade_shader_manager.core.pcgw import get_pcgw_repos_with_meta
from reshade_shader_manager.core.plugin_addons_catalog import get_upstream_plugin_addons_with_meta
from reshade_shader_manager.core.repos import merged_catalog


def fetch_merged_catalogs(
    paths: RsmPaths,
    cfg: AppConfig,
    *,
    force_refresh: bool,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    shader_cat, plugin_cat, _meta = fetch_merged_catalogs_with_meta(paths, cfg, force_refresh=force_refresh)
    return shader_cat, plugin_cat


def fetch_merged_catalogs_with_meta(
    paths: RsmPaths,
    cfg: AppConfig,
    *,
    force_refresh: bool,
) -> tuple[list[dict[str, str]], list[dict[str, str]], dict[str, bool]]:
    """
    Return ``(merged_shader_catalog, plugin_addon_catalog)``.

    Same sequence as the GUI catalog loader: PCGW → merged built-in/user/PCGW shader
    repos → official Addons.ini plugin catalog.
    """
    pcgw, pcgw_meta = get_pcgw_repos_with_meta(
        paths,
        ttl_hours=cfg.pcgw_cache_ttl_hours,
        force_refresh=force_refresh,
    )
    shader_cat = merged_catalog(paths, pcgw)
    plugin_cat, addons_meta = get_upstream_plugin_addons_with_meta(
        paths,
        ttl_hours=cfg.plugin_addons_catalog_ttl_hours,
        force_refresh=force_refresh,
    )
    return (
        shader_cat,
        plugin_cat,
        {
            "pcgw_upstream_ok": bool(pcgw_meta["upstream_ok"]),
            "pcgw_used_stale_cache": bool(pcgw_meta["used_stale_cache"]),
            "pcgw_from_ttl_cache": bool(pcgw_meta["from_ttl_cache"]),
            "addons_upstream_ok": bool(addons_meta["upstream_ok"]),
            "addons_used_stale_cache": bool(addons_meta["used_stale_cache"]),
            "addons_from_ttl_cache": bool(addons_meta["from_ttl_cache"]),
        },
    )
