from __future__ import annotations

from typing import Any

import httpx


class ProviderError(Exception):
    def __init__(
        self,
        message: str,
        *,
        provider: str | None = None,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
        self.provider = provider
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(message)


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        base_url: str,
        model: str,
        timeout: float = 120.0,
    ) -> None:
        self.name = name
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.model = model.strip()
        self.timeout = float(timeout)

        if not self.api_key:
            raise ProviderError(
                f"{self.name}: API credential is empty",
                provider=self.name,
            )

        if not self.base_url:
            raise ProviderError(
                f"{self.name}: base URL is empty",
                provider=self.name,
            )

        if not self.model:
            raise ProviderError(
                f"{self.name}: model is empty",
                provider=self.name,
            )

    @property
    def endpoint(self) -> str:
        return f"{self.base_url}/chat/completions"

    async def complete(
        self,
        prompt: str,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ProviderError(
                f"{self.name}: prompt must be a non-empty string",
                provider=self.name,
            )

        messages: list[dict[str, str]] = []

        if history:
            for item in history:
                if not isinstance(item, dict):
                    continue

                role = str(item.get("role", "")).strip().lower()
                content = str(item.get("content", ""))

                if role not in {"system", "user", "assistant"}:
                    continue

                if not content.strip():
                    continue

                messages.append(
                    {
                        "role": role,
                        "content": content,
                    }
                )

        messages.append(
            {
                "role": "user",
                "content": prompt,
            }
        )

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        timeout = httpx.Timeout(
            connect=20.0,
            read=self.timeout,
            write=30.0,
            pool=20.0,
        )

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
            ) as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise ProviderError(
                f"{self.name}: network error: {exc}",
                provider=self.name,
            ) from exc

        if response.status_code >= 400:
            body = response.text[:4000]

            raise ProviderError(
                f"{self.name}: HTTP {response.status_code}: {body}",
                provider=self.name,
                status_code=response.status_code,
                response_body=body,
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderError(
                f"{self.name}: provider returned invalid JSON",
                provider=self.name,
                status_code=response.status_code,
                response_body=response.text[:4000],
            ) from exc

        choices = data.get("choices")

        if not isinstance(choices, list) or not choices:
            raise ProviderError(
                f"{self.name}: provider response contains no choices",
                provider=self.name,
                status_code=response.status_code,
                response_body=response.text[:4000],
            )

        first = choices[0]

        if not isinstance(first, dict):
            raise ProviderError(
                f"{self.name}: invalid first choice",
                provider=self.name,
            )

        message = first.get("message")

        if not isinstance(message, dict):
            raise ProviderError(
                f"{self.name}: response contains no message",
                provider=self.name,
            )

        content = message.get("content")

        if content is None:
            content = message.get("reasoning_content")

        if not isinstance(content, str):
            raise ProviderError(
                f"{self.name}: response contains no textual content",
                provider=self.name,
                status_code=response.status_code,
                response_body=response.text[:4000],
            )

        return content

    async def run(
        self,
        prompt: str,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        return await self.complete(prompt, history)
