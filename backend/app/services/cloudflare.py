from __future__ import annotations

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

    async def verify(self) -> dict:
        self._require_credentials()

        url = (
            f"{self.settings.cloudflare_api_base_url}"
            f"/accounts/{self.settings.cloudflare_account_id}"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url,
                headers=self._headers(),
            )

        if response.status_code >= 400:
            raise CloudflareDeploymentError(
                f"Cloudflare credential verification failed "
                f"with HTTP {response.status_code}: {response.text[:2000]}"
            )

        data = response.json()

        if data.get("success") is not True:
            raise CloudflareDeploymentError(
                f"Cloudflare rejected credentials: {data}"
            )

        return data
