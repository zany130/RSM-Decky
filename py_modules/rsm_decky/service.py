from __future__ import annotations

from pathlib import Path
import logging

from reshade_shader_manager.core.catalog_ops import fetch_merged_catalogs
from reshade_shader_manager.core.config import AppConfig, load_config
from reshade_shader_manager.core.exceptions import RSMError
from reshade_shader_manager.core.git_sync import pull_existing_clones_for_catalog
from reshade_shader_manager.core.link_farm import apply_shader_projection
from reshade_shader_manager.core.manifest import GameManifest, load_game_manifest, new_game_manifest
from reshade_shader_manager.core.paths import RsmPaths, canonical_game_dir, get_paths
from reshade_shader_manager.core.plugin_addons_install import (
    apply_plugin_addon_installation,
    installability_detail,
)
from reshade_shader_manager.core.repos import add_user_repo
from reshade_shader_manager.core.reshade import check_reshade, install_reshade, remove_reshade_binaries
from reshade_shader_manager.core.targets import detect_game_arch

log = logging.getLogger(__name__)


def _paths_cfg() -> tuple[RsmPaths, AppConfig]:
    paths = get_paths(ensure_layout=True)
    cfg = load_config(paths)
    return paths, cfg


def _refresh_arch(m: GameManifest, gd: Path) -> str | None:
    exe_path = Path(m.game_exe).expanduser() if m.game_exe else None
    if exe_path and not exe_path.is_file():
        exe_path = None
    try:
        m.reshade_arch = detect_game_arch(gd, exe_path)
        return None
    except ValueError:
        if m.reshade_arch in ("32", "64"):
            return None
        return (
            "Could not detect 32/64-bit architecture. Add a Windows .exe to the game directory, "
            "or use a game whose install folder contains an .exe."
        )


class RsmDeckyService:
    @staticmethod
    def _normalize_repo_ids(repo_ids: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for raw in repo_ids:
            rid = str(raw).strip().lower()
            if not rid or rid in seen:
                continue
            seen.add(rid)
            out.append(rid)
        return out

    def catalog_refresh(self, force_refresh: bool) -> dict:
        paths, cfg = _paths_cfg()
        shader_cat, addon_cat = fetch_merged_catalogs(paths, cfg, force_refresh=force_refresh)
        return {
            "shader_repo_count": len(shader_cat),
            "addon_count": len(addon_cat),
            "force_refresh": bool(force_refresh),
        }

    def catalog_update_clones(self) -> dict:
        paths, cfg = _paths_cfg()
        shader_cat, _ = fetch_merged_catalogs(paths, cfg, force_refresh=False)
        existing_repo_ids: list[str] = []
        for row in shader_cat:
            rid = str(row.get("id", "")).strip()
            if not rid:
                continue
            if (paths.repo_clone_dir(rid) / ".git").exists():
                existing_repo_ids.append(rid)

        failures = pull_existing_clones_for_catalog(paths, shader_cat)
        return {
            "existing_clone_count": len(existing_repo_ids),
            "updated_count": max(0, len(existing_repo_ids) - len(failures)),
            "failures": failures,
        }

    def repositories_add(
        self,
        repo_id: str,
        display_name: str,
        git_url: str,
        author: str,
        description: str,
    ) -> dict:
        paths, _cfg = _paths_cfg()
        user_repos = add_user_repo(
            paths,
            repo_id=repo_id,
            name=display_name,
            git_url=git_url,
            author=author,
            description=description,
        )
        return {
            "added_repo_id": repo_id.strip().lower(),
            "user_repo_count": len(user_repos),
        }

    def shaders_preflight(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        paths, cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd) or new_game_manifest(gd)
        shader_cat, _addon_cat = fetch_merged_catalogs(paths, cfg, force_refresh=False)
        by_id = {str(r.get("id", "")).strip().lower(): r for r in shader_cat}

        baseline_ids = sorted({str(x).strip().lower() for x in m.enabled_repo_ids if str(x).strip()})
        desired_ids = self._normalize_repo_ids(desired_repo_ids)
        unknown_ids = [rid for rid in desired_ids if rid not in by_id]

        rows: list[dict] = []
        for row in shader_cat:
            rid = str(row.get("id", "")).strip().lower()
            if not rid:
                continue
            rows.append(
                {
                    "id": rid,
                    "name": str(row.get("name", rid)),
                    "author": str(row.get("author", "")),
                    "description": str(row.get("description", "")),
                    "installed": rid in baseline_ids,
                }
            )

        desired_set = set(desired_ids)
        baseline_set = set(baseline_ids)
        has_changes = desired_set != baseline_set
        pending_install = sorted(desired_set - baseline_set)
        pending_uninstall = sorted(baseline_set - desired_set)

        log.info(
            "shaders_preflight game_dir=%s desired_count=%d baseline_count=%d has_changes=%s unknown_count=%d (no clone operation in preflight)",
            gd,
            len(desired_ids),
            len(baseline_ids),
            has_changes,
            len(unknown_ids),
        )

        return {
            "rows": rows,
            "baseline_repo_ids": baseline_ids,
            "desired_repo_ids": desired_ids,
            "unknown_repo_ids": unknown_ids,
            "has_changes": has_changes,
            "pending_install_ids": pending_install,
            "pending_uninstall_ids": pending_uninstall,
        }

    def shaders_apply(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        paths, cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        shader_cat, _addon_cat = fetch_merged_catalogs(paths, cfg, force_refresh=False)
        by_id = {str(r.get("id", "")).strip().lower(): r for r in shader_cat if str(r.get("id", "")).strip()}

        desired_ids = self._normalize_repo_ids(desired_repo_ids)
        unknown_ids = [rid for rid in desired_ids if rid not in by_id]
        if unknown_ids:
            log.error(
                "shaders_apply unknown repo ids game_dir=%s unknown=%s desired=%s",
                gd,
                unknown_ids,
                desired_ids,
            )
            raise RSMError(f"Unknown repository id(s): {', '.join(unknown_ids)}")

        clone_targets = [
            {"id": rid, "git_url": str(by_id[rid].get("git_url", "")), "repo_dir": str(paths.repo_clone_dir(rid))}
            for rid in desired_ids
        ]
        log.info(
            "shaders_apply start game_dir=%s desired_count=%d clone_targets=%s",
            gd,
            len(desired_ids),
            clone_targets,
        )
        apply_shader_projection(
            paths=paths,
            game_dir=gd,
            desired_repo_ids=set(desired_ids),
            catalog_by_id=by_id,
            git_pull=False,
        )
        log.info("shaders_apply success game_dir=%s enabled_repo_ids=%s", gd, desired_ids)
        return {"enabled_repo_ids": desired_ids, "applied_count": len(desired_ids)}

    def addons_preflight(self, game_dir: str, desired_addon_ids: list[str]) -> dict:
        paths, cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd) or new_game_manifest(gd)
        arch_error = _refresh_arch(m, gd)
        if arch_error:
            raise RSMError(arch_error)

        _shader_cat, addon_cat = fetch_merged_catalogs(paths, cfg, force_refresh=False)
        arch = m.reshade_arch
        by_id = {str(r.get("id", "")).strip().lower(): r for r in addon_cat}
        installable_ids: set[str] = set()
        incompatible_names: list[str] = []

        rows: list[dict] = []
        for row in addon_cat:
            rid = str(row.get("id", "")).strip().lower()
            if not rid:
                continue
            ok, reason = installability_detail(row, arch=arch)
            if not ok:
                incompatible_names.append(str(row.get("name", rid)))
                continue
            installable_ids.add(rid)
            rows.append(
                {
                    "id": rid,
                    "name": str(row.get("name", rid)),
                    "author": "",
                    "description": str(row.get("description", "")),
                    "installed": rid in m.enabled_plugin_addon_ids,
                    "arch": arch,
                    "download_arch": (
                        "x86/x64"
                        if (str(row.get("download_url_32", "")).strip() and str(row.get("download_url_64", "")).strip())
                        else ("x64" if str(row.get("download_url_64", "")).strip() else "x86")
                    ),
                    "installability_reason": reason,
                }
            )

        requested_ids = self._normalize_repo_ids(desired_addon_ids)
        baseline_ids = sorted({rid for rid in self._normalize_repo_ids(m.enabled_plugin_addon_ids) if rid in installable_ids})
        desired_ids = [rid for rid in requested_ids if rid in installable_ids]
        unknown_ids = [rid for rid in requested_ids if rid not in by_id]

        desired_set = set(desired_ids)
        baseline_set = set(baseline_ids)
        has_changes = desired_set != baseline_set
        pending_install = sorted(desired_set - baseline_set)
        pending_uninstall = sorted(baseline_set - desired_set)

        return {
            "rows": rows,
            "baseline_ids": baseline_ids,
            "desired_ids": desired_ids,
            "unknown_ids": unknown_ids,
            "has_changes": has_changes,
            "pending_install_ids": pending_install,
            "pending_uninstall_ids": pending_uninstall,
            "arch": arch,
            "incompatible_count": len(incompatible_names),
            "incompatible_names": sorted(incompatible_names)[:3],
            "incompatible_reason": "Hidden because incompatible with current game architecture.",
        }

    def addons_apply(self, game_dir: str, desired_addon_ids: list[str]) -> dict:
        paths, cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd) or new_game_manifest(gd)
        arch_error = _refresh_arch(m, gd)
        if arch_error:
            raise RSMError(arch_error)

        _shader_cat, addon_cat = fetch_merged_catalogs(paths, cfg, force_refresh=False)
        arch = m.reshade_arch
        by_id: dict[str, dict] = {}
        for row in addon_cat:
            rid = str(row.get("id", "")).strip().lower()
            if not rid:
                continue
            ok, _reason = installability_detail(row, arch=arch)
            if ok:
                by_id[rid] = row

        desired_ids = self._normalize_repo_ids(desired_addon_ids)
        unknown_ids = [rid for rid in desired_ids if rid not in by_id]
        if unknown_ids:
            raise RSMError(f"Unknown or incompatible add-on id(s): {', '.join(unknown_ids)}")

        apply_plugin_addon_installation(
            paths=paths,
            manifest=m,
            game_dir=gd,
            desired_plugin_addon_ids=set(desired_ids),
            catalog_by_id=by_id,
        )
        return {"enabled_addon_ids": desired_ids, "applied_count": len(desired_ids)}

    def game_resolve_manifest(self, game_dir: str) -> dict:
        paths, _cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd) or new_game_manifest(gd)
        arch_error = _refresh_arch(m, gd)
        return {"manifest": m.to_json_dict(), "arch_error": arch_error}

    def reshade_get_status(self, game_dir: str) -> dict:
        paths, _cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd)
        if not m:
            return {
                "has_manifest": False,
                "installed": False,
                "graphics_api": None,
                "reshade_version": None,
                "variant": None,
                "arch": None,
                "check": None,
                "arch_error": None,
            }
        arch_error = _refresh_arch(m, gd)
        installed = bool(m.installed_reshade_files)
        cr = check_reshade(m) if installed else None
        return {
            "has_manifest": True,
            "installed": installed,
            "graphics_api": m.graphics_api,
            "reshade_version": m.reshade_version or None,
            "variant": m.reshade_variant,
            "arch": m.reshade_arch,
            "check": (
                None
                if cr is None
                else {
                    "ok": cr.ok,
                    "missing_files": cr.missing_files,
                    "warnings": cr.warnings,
                }
            ),
            "arch_error": arch_error,
        }

    def reshade_install(self, game_dir: str, graphics_api: str, variant: str, version: str) -> dict:
        paths, cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd) or new_game_manifest(gd)
        arch_err = _refresh_arch(m, gd)
        if arch_err:
            raise RSMError(arch_err)
        ver = (version or "").strip() or cfg.default_reshade_version
        m.graphics_api = graphics_api
        m.reshade_variant = variant
        m = install_reshade(
            paths=paths,
            manifest=m,
            graphics_api=graphics_api,
            reshade_version=ver,
            variant=variant,
        )
        return {"manifest": m.to_json_dict(), "message": f"ReShade installed ({m.reshade_version})."}

    def reshade_update_reinstall(self, game_dir: str, graphics_api: str, variant: str) -> dict:
        return self.reshade_install(game_dir, graphics_api, variant, "latest")

    def reshade_uninstall(self, game_dir: str) -> dict:
        paths, _cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd)
        if not m:
            raise RSMError("No saved profile (manifest) for this directory.")
        warnings = remove_reshade_binaries(paths=paths, manifest=m)
        return {"warnings": warnings, "message": "ReShade binaries removed."}

    def reshade_check(self, game_dir: str) -> dict:
        paths, _cfg = _paths_cfg()
        gd = canonical_game_dir(game_dir)
        m = load_game_manifest(paths, gd)
        if not m:
            raise RSMError("No manifest for this directory.")
        cr = check_reshade(m)
        return {
            "ok": cr.ok,
            "missing_files": cr.missing_files,
            "warnings": cr.warnings,
        }
