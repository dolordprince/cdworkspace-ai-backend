from __future__ import annotations

import hashlib
import json
import mimetypes
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings


class CloudflareDeploymentError(RuntimeError):
    pass


class CloudflarePagesService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.cloudflare_api_token}",
            "Content-Type": "application/json",
        }

    def _require_credentials(self) -> None:
        if not self.settings.cloudflare_account_id:
            raise CloudflareDeploymentError(
                "CLOUDFLARE_ACCOUNT_ID is not configured"
            )

        if not self.settings.cloudflare_api_token:
            raise CloudflareDeploymentError(
                "CLOUDFLARE_API_TOKEN is not configured"
            )

    def _project_name(self, project_name: str | None = None) -> str:
        name = (
            project_name
            or self.settings.cloudflare_default_project
            or "traveler-dev"
        ).strip()

        if not name:
            raise CloudflareDeploymentError(
                "Cloudflare Pages project name is required"
            )

        if len(name) > 58:
            raise CloudflareDeploymentError(
                "Cloudflare Pages project name is too long"
            )

        return name

    def _api_url(self, path: str) -> str:
        base = self.settings.cloudflare_api_base_url.rstrip("/")
        account = self.settings.cloudflare_account_id

        return f"{base}/accounts/{account}{path}"

    async def verify(self) -> dict[str, Any]:
        self._require_credentials()

        url = self._api_url("")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url,
                headers=self._headers(),
            )

        if response.status_code >= 400:
            raise CloudflareDeploymentError(
                "Cloudflare credential verification failed "
                f"with HTTP {response.status_code}: "
                f"{response.text[:2000]}"
            )

        data = response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare rejected credentials: {data}"
            )

        return data

    async def ensure_project(
        self,
        project_name: str | None = None,
    ) -> dict[str, Any]:
        self._require_credentials()

        project = self._project_name(project_name)

        get_url = self._api_url(
            f"/pages/projects/{project}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                get_url,
                headers=self._headers(),
            )

            if response.status_code == 200:
                data = response.json()

                if data.get("success") is True:
                    return data

            if response.status_code != 404:
                raise CloudflareDeploymentError(
                    "Cloudflare Pages project lookup failed "
                    f"with HTTP {response.status_code}: "
                    f"{response.text[:2000]}"
                )

            create_url = self._api_url("/pages/projects")

            create_response = await client.post(
                create_url,
                headers=self._headers(),
                json={
                    "name": project,
                    "production_branch": "main",
                },
            )

        if create_response.status_code >= 400:
            raise CloudflareDeploymentError(
                "Cloudflare Pages project creation failed "
                f"with HTTP {create_response.status_code}: "
                f"{create_response.text[:4000]}"
            )

        data = create_response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare Pages project creation failed: {data}"
            )

        return data

    @staticmethod
    def _build_manifest(directory: Path) -> tuple[dict[str, str], list[Path]]:
        if not directory.exists():
            raise CloudflareDeploymentError(
                f"Deployment directory does not exist: {directory}"
            )

        if not directory.is_dir():
            raise CloudflareDeploymentError(
                f"Deployment path is not a directory: {directory}"
            )

        files: list[Path] = []

        for path in directory.rglob("*"):
            if not path.is_file():
                continue

            relative = path.relative_to(directory)

            if any(part in {".git", "__pycache__", ".venv"} for part in relative.parts):
                continue

            files.append(path)

        if not files:
            raise CloudflareDeploymentError(
                "Deployment directory contains no files"
            )

        if len(files) > 20_000:
            raise CloudflareDeploymentError(
                "Cloudflare Pages deployment exceeds the 20,000-file limit"
            )

        manifest: dict[str, str] = {}

        for path in files:
            relative = path.relative_to(directory).as_posix()
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            manifest[relative] = digest

        return manifest, files

    async def deploy_directory(
        self,
        directory: str | Path,
        project_name: str | None = None,
    ) -> dict[str, Any]:
        self._require_credentials()

        project = self._project_name(project_name)
        root = Path(directory).expanduser().resolve()

        await self.ensure_project(project)

        manifest, files = self._build_manifest(root)

        url = self._api_url(
            f"/pages/projects/{project}/deployments"
        )

        multipart: list[tuple[str, tuple[str, bytes, str]]] = []

        for path in files:
            relative = path.relative_to(root).as_posix()

            content_type = (
                mimetypes.guess_type(relative)[0]
                or "application/octet-stream"
            )

            multipart.append(
                (
                    relative,
                    (
                        relative,
                        path.read_bytes(),
                        content_type,
                    ),
                )
            )

        form_data = {
            "manifest": json.dumps(
                manifest,
                separators=(",", ":"),
            ),
        }

        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": (
                        f"Bearer {self.settings.cloudflare_api_token}"
                    )
                },
                data=form_data,
                files=multipart,
            )

        if response.status_code >= 400:
            raise CloudflareDeploymentError(
                "Cloudflare Pages deployment failed "
                f"with HTTP {response.status_code}: "
                f"{response.text[:5000]}"
            )

        data = response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare Pages deployment failed: {data}"
            )

        result = data.get("result") or {}

        aliases = result.get("aliases") or []

        deployment_url = (
            aliases[0]
            if aliases
            else result.get("url")
            or (
                f"https://{project}.pages.dev"
            )
        )

        return {
            "status": "deployed",
            "provider": "cloudflare_pages",
            "project": project,
            "deployment_id": result.get("id"),
            "url": deployment_url,
            "aliases": aliases,
            "files": len(files),
            "manifest_files": len(manifest),
            "result": result,
        }
