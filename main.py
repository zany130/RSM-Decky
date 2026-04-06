import asyncio
import os

import decky

from rsm_decky.service import RsmDeckyService


class Plugin:
    def __init__(self) -> None:
        self._service: RsmDeckyService | None = None

    def _svc(self) -> RsmDeckyService:
        if self._service is None:
            self._service = RsmDeckyService()
        return self._service

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
        """Stub only — real VDF resolution comes later."""
        await asyncio.sleep(0)
        decky.logger.info("steam_resolve_game_dir stub (app_id=%s)", app_id)
        return {"game_dir": "NOT_IMPLEMENTED"}

    async def game_resolve_manifest(self, game_dir: str) -> dict:
        return await asyncio.to_thread(self._svc().game_resolve_manifest, game_dir)

    async def catalog_refresh(self, force_refresh: bool) -> dict:
        return await asyncio.to_thread(self._svc().catalog_refresh, force_refresh)

    async def catalog_update_clones(self) -> dict:
        return await asyncio.to_thread(self._svc().catalog_update_clones)

    async def repositories_add(
        self, repo_id: str, display_name: str, git_url: str, author: str, description: str
    ) -> dict:
        return await asyncio.to_thread(
            self._svc().repositories_add, repo_id, display_name, git_url, author, description
        )

    async def shaders_preflight(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        return await asyncio.to_thread(self._svc().shaders_preflight, game_dir, desired_repo_ids)

    async def shaders_apply(self, game_dir: str, desired_repo_ids: list[str]) -> dict:
        return await asyncio.to_thread(self._svc().shaders_apply, game_dir, desired_repo_ids)

    async def addons_preflight(self, game_dir: str, desired_ids: list[str]) -> dict:
        return await asyncio.to_thread(self._svc().addons_preflight, game_dir, desired_ids)

    async def addons_apply(self, game_dir: str, desired_ids: list[str]) -> dict:
        return await asyncio.to_thread(self._svc().addons_apply, game_dir, desired_ids)

    async def reshade_get_status(self, game_dir: str) -> dict:
        return await asyncio.to_thread(self._svc().reshade_get_status, game_dir)

    async def reshade_install(self, game_dir: str, graphics_api: str, variant: str, version: str) -> dict:
        return await asyncio.to_thread(self._svc().reshade_install, game_dir, graphics_api, variant, version)

    async def reshade_update_reinstall(self, game_dir: str, graphics_api: str, variant: str) -> dict:
        return await asyncio.to_thread(self._svc().reshade_update_reinstall, game_dir, graphics_api, variant)

    async def reshade_uninstall(self, game_dir: str) -> dict:
        return await asyncio.to_thread(self._svc().reshade_uninstall, game_dir)

    async def reshade_check(self, game_dir: str) -> dict:
        return await asyncio.to_thread(self._svc().reshade_check, game_dir)
