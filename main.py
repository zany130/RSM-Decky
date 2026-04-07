import asyncio
import os
from collections.abc import Callable

import decky

from reshade_shader_manager.core.error_format import format_exception_for_ui
from reshade_shader_manager.core.exceptions import RSMError
from rsm_decky.service import RsmDeckyService


class Plugin:
    def __init__(self) -> None:
        self._service: RsmDeckyService | None = None

    def _svc(self) -> RsmDeckyService:
        if self._service is None:
            self._service = RsmDeckyService()
        return self._service

    async def _run_rpc(self, rpc_name: str, fn: Callable[..., dict], *args) -> dict:
        try:
            return await asyncio.to_thread(fn, *args)
        except RSMError as e:
            msg = str(e) or "Operation failed."
            decky.logger.warning("RPC %s failed: %s", rpc_name, msg)
            raise RuntimeError(msg) from e
        except Exception as e:  # noqa: BLE001
            msg = format_exception_for_ui(e)
            decky.logger.error("RPC %s unexpected error: %s", rpc_name, msg, exc_info=True)
            raise RuntimeError(msg) from e

    @staticmethod
    def _coerce_str_list(value: object, *, arg_name: str) -> list[str]:
        if not isinstance(value, list):
            raise RuntimeError(f"Invalid argument '{arg_name}': expected a list of strings.")
        return [str(item).strip() for item in value]

    async def _main(self):
        decky.logger.info("RSM-Decky backend loaded")

    async def _unload(self):
        decky.logger.info("RSM-Decky backend unloading")

    async def validate_game_dir(self, game_dir: str) -> dict:
        await asyncio.sleep(0)
        cleaned = game_dir.strip() if isinstance(game_dir, str) else ""
        if not cleaned:
            return {"valid": False, "reason": "Missing or empty install folder."}
        if not os.path.exists(cleaned):
            return {"valid": False, "reason": f"Path does not exist: {cleaned}"}
        if not os.path.isdir(cleaned):
            return {"valid": False, "reason": f"Path is not a directory: {cleaned}"}
        return {"valid": True}

    async def steam_resolve_game_dir(self, app_id: int) -> dict:
        """Legacy fallback stub kept for API compatibility; v0.2+ uses frontend-resolved game_dir."""
        await asyncio.sleep(0)
        decky.logger.info("steam_resolve_game_dir stub (app_id=%s)", app_id)
        return {"game_dir": "NOT_IMPLEMENTED"}

    async def game_resolve_manifest(self, game_dir: str) -> dict:
        return await self._run_rpc("game_resolve_manifest", self._svc().game_resolve_manifest, game_dir)

    async def catalog_refresh(self, force_refresh: bool) -> dict:
        return await self._run_rpc("catalog_refresh", self._svc().catalog_refresh, force_refresh)

    async def catalog_update_clones(self) -> dict:
        return await self._run_rpc("catalog_update_clones", self._svc().catalog_update_clones)

    async def repositories_add(
        self, repo_id: str, display_name: str, git_url: str, author: str, description: str
    ) -> dict:
        return await self._run_rpc(
            "repositories_add",
            self._svc().repositories_add,
            repo_id,
            display_name,
            git_url,
            author,
            description,
        )

    async def shaders_preflight(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        normalized_ids = self._coerce_str_list(desired_repo_ids, arg_name="desired_repo_ids")
        return await self._run_rpc("shaders_preflight", self._svc().shaders_preflight, game_dir, normalized_ids)

    async def shaders_apply(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        normalized_ids = self._coerce_str_list(desired_repo_ids, arg_name="desired_repo_ids")
        return await self._run_rpc("shaders_apply", self._svc().shaders_apply, game_dir, normalized_ids)

    async def addons_preflight(self, game_dir: str, desired_ids: list[str]) -> dict:
        normalized_ids = self._coerce_str_list(desired_ids, arg_name="desired_ids")
        return await self._run_rpc("addons_preflight", self._svc().addons_preflight, game_dir, normalized_ids)

    async def addons_apply(self, game_dir: str, desired_ids: list[str]) -> dict:
        normalized_ids = self._coerce_str_list(desired_ids, arg_name="desired_ids")
        return await self._run_rpc("addons_apply", self._svc().addons_apply, game_dir, normalized_ids)

    async def reshade_get_status(self, game_dir: str) -> dict:
        return await self._run_rpc("reshade_get_status", self._svc().reshade_get_status, game_dir)

    async def reshade_install(self, game_dir: str, graphics_api: str, variant: str, version: str) -> dict:
        return await self._run_rpc(
            "reshade_install",
            self._svc().reshade_install,
            game_dir,
            graphics_api,
            variant,
            version,
        )

    async def reshade_update_reinstall(self, game_dir: str, graphics_api: str, variant: str) -> dict:
        return await self._run_rpc(
            "reshade_update_reinstall", self._svc().reshade_update_reinstall, game_dir, graphics_api, variant
        )

    async def reshade_uninstall(self, game_dir: str) -> dict:
        return await self._run_rpc("reshade_uninstall", self._svc().reshade_uninstall, game_dir)

    async def reshade_check(self, game_dir: str) -> dict:
        return await self._run_rpc("reshade_check", self._svc().reshade_check, game_dir)
