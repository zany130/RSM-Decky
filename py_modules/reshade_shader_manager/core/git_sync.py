"""Git clone/pull with in-process serialization (v0.1)."""

from __future__ import annotations

import logging
import os
import subprocess
import threading
import time
from pathlib import Path

from reshade_shader_manager.core.paths import RsmPaths

log = logging.getLogger(__name__)

_git_lock = threading.Lock()


def _sanitized_git_env() -> tuple[dict[str, str], list[str]]:
    """
    Return an env mapping safe for system ``git`` subprocesses.

    Decky/PyInstaller runtime can inject ``LD_LIBRARY_PATH`` pointing at a bundled
    runtime directory (e.g. ``/tmp/_MEI...``), which can break git-remote-https by
    forcing incompatible libssl/libcurl resolution.
    """
    env = dict(os.environ)
    removed: list[str] = []

    # Prefer the pre-bundle value if present; otherwise drop LD_LIBRARY_PATH.
    if "LD_LIBRARY_PATH_ORIG" in env:
        env["LD_LIBRARY_PATH"] = env.get("LD_LIBRARY_PATH_ORIG", "")
    elif "LD_LIBRARY_PATH" in env:
        env.pop("LD_LIBRARY_PATH", None)
        removed.append("LD_LIBRARY_PATH")

    # Avoid inherited preload/runtime overrides from the host process.
    for key in ("LD_PRELOAD", "DYLD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES"):
        if key in env:
            env.pop(key, None)
            removed.append(key)

    return env, removed


def clone_or_pull(repo_dir: Path, git_url: str, *, timeout: float = 300.0, pull: bool = True) -> bool | None:
    """
    If ``repo_dir`` is missing or not a git working tree, ``git clone`` into ``repo_dir``.

    If it is already a clone and ``pull`` is True, run ``git pull --rebase=false``.
    If ``pull`` is False, an existing clone is left as-is (no fetch/pull).

    Returns:
    - ``True`` when clone/pull changed content.
    - ``False`` when pull succeeds but reports already up to date.
    - ``None`` when existing clone is skipped because ``pull=False``.
    """
    repo_dir = repo_dir.resolve()
    with _git_lock:
        git_env, removed_env = _sanitized_git_env()
        if removed_env:
            log.debug("git subprocess env sanitized repo_dir=%s removed=%s", repo_dir, removed_env)
        git_dir = repo_dir / ".git"
        if git_dir.exists():
            if pull:
                started = time.monotonic()
                log.info("git pull start repo_dir=%s git_url=%s timeout=%ss", repo_dir, git_url, timeout)
                try:
                    proc = subprocess.run(
                        ["git", "-C", str(repo_dir), "pull", "--rebase=false"],
                        check=True,
                        timeout=timeout,
                        capture_output=True,
                        text=True,
                        env=git_env,
                    )
                    elapsed = time.monotonic() - started
                    log.info(
                        "git pull success repo_dir=%s elapsed=%.2fs",
                        repo_dir,
                        elapsed,
                    )
                    pull_output = f"{proc.stdout}\n{proc.stderr}".lower()
                    return "already up to date" not in pull_output and "already up-to-date" not in pull_output
                except subprocess.TimeoutExpired as e:
                    elapsed = time.monotonic() - started
                    log.error(
                        "git pull timeout repo_dir=%s elapsed=%.2fs timeout=%ss stdout=%r stderr=%r",
                        repo_dir,
                        elapsed,
                        timeout,
                        ((e.stdout or "") if isinstance(e.stdout, str) else str(e.stdout or "")).strip()[:1200],
                        ((e.stderr or "") if isinstance(e.stderr, str) else str(e.stderr or "")).strip()[:1200],
                    )
                    raise
                except subprocess.CalledProcessError as e:
                    elapsed = time.monotonic() - started
                    log.error(
                        "git pull failed repo_dir=%s elapsed=%.2fs rc=%s stdout=%r stderr=%r",
                        repo_dir,
                        elapsed,
                        e.returncode,
                        (e.stdout or "").strip()[:1200],
                        (e.stderr or "").strip()[:1200],
                    )
                    raise
            else:
                log.debug("Skipping git pull for existing repo %s", repo_dir)
                return None
        else:
            repo_dir.parent.mkdir(parents=True, exist_ok=True)
            started = time.monotonic()
            log.info("git clone start git_url=%s repo_dir=%s timeout=%ss", git_url, repo_dir, timeout)
            try:
                subprocess.run(
                    ["git", "clone", git_url, str(repo_dir)],
                    check=True,
                    timeout=timeout,
                    capture_output=True,
                    text=True,
                    env=git_env,
                )
                elapsed = time.monotonic() - started
                log.info(
                    "git clone success git_url=%s repo_dir=%s elapsed=%.2fs",
                    git_url,
                    repo_dir,
                    elapsed,
                )
                return True
            except subprocess.TimeoutExpired as e:
                elapsed = time.monotonic() - started
                log.error(
                    "git clone timeout git_url=%s repo_dir=%s elapsed=%.2fs timeout=%ss stdout=%r stderr=%r",
                    git_url,
                    repo_dir,
                    elapsed,
                    timeout,
                    ((e.stdout or "") if isinstance(e.stdout, str) else str(e.stdout or "")).strip()[:1200],
                    ((e.stderr or "") if isinstance(e.stderr, str) else str(e.stderr or "")).strip()[:1200],
                )
                raise
            except subprocess.CalledProcessError as e:
                elapsed = time.monotonic() - started
                log.error(
                    "git clone failed git_url=%s repo_dir=%s elapsed=%.2fs rc=%s stdout=%r stderr=%r",
                    git_url,
                    repo_dir,
                    elapsed,
                    e.returncode,
                    (e.stdout or "").strip()[:1200],
                    (e.stderr or "").strip()[:1200],
                )
                raise


def pull_existing_clones_for_catalog(
    paths: RsmPaths,
    catalog: list[dict[str, str]],
    *,
    timeout: float = 300.0,
) -> dict[str, object]:
    """
    For each entry in ``catalog``, if ``paths.repo_clone_dir(id)`` already has
    ``.git``, run ``git pull``. Missing clones are skipped (no clone).

    Returns pull stats:
    - ``attempted_count``
    - ``updated_count`` (clones where pull reported actual changes)
    - ``failures`` (list of ``\"<repo_id>: <message>\"``)
    """
    failures: list[str] = []
    attempted = 0
    changed = 0
    for r in catalog:
        rid = str(r.get("id", "")).strip()
        url = (r.get("git_url") or "").strip()
        if not rid or not url:
            continue
        d = paths.repo_clone_dir(rid)
        if not (d / ".git").exists():
            continue
        attempted += 1
        try:
            did_change = clone_or_pull(d, url, pull=True, timeout=timeout)
            if did_change is True:
                changed += 1
        except Exception as e:  # noqa: BLE001
            failures.append(f"{rid}: {e}")
    return {
        "attempted_count": attempted,
        "updated_count": changed,
        "failures": failures,
    }
