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
        retry_after: float | None = None,
    ) -> None:
        self.provider = provider
        self.status_code = status_code
        self.response_body = response_body
        self.retry_after = retry_after
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
        connect_timeout: float = 20.0,
        write_timeout: float = 30.0,
        pool_timeout: float = 20.0,
    ) -> None:
        self.name = name.strip().lower()
        self.api_key = api_key.strip()
        self.base_url = base_url.strip().rstrip("/")
        self.model = model.strip()

        self.timeout = float(timeout)
        self.connect_timeout = float(connect_timeout)
        self.write_timeout = float(write_timeout)
        self.pool_timeout = float(pool_timeout)

        if not self.name:
            raise ProviderError("provider name is empty")

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

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if self.name == "openrouter":
            site_url = __import__("os").getenv(
                "OPENROUTER_SITE_URL",
                "",
            ).strip()

            app_name = __import__("os").getenv(
                "OPENROUTER_APP_NAME",
                "Traveler Dev",
            ).strip()

            if site_url:
                headers["HTTP-Referer"] = site_url

            if app_name:
                headers["X-Title"] = app_name

        return headers

    @staticmethod
    def _normalise_messages(
        prompt: str,
        history: list[dict[str, str]] | None,
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []

        if history:
            for item in history:
                if not isinstance(item, dict):
                    continue

                role = str(item.get("role", "")).strip().lower()
                content = item.get("content", "")

                if role not in {"system", "user", "assistant"}:
                    continue

                if not isinstance(content, str):
                    content = str(content)

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

        return messages

    @staticmethod
    def _retry_after(response: httpx.Response) -> float | None:
        value = response.headers.get("retry-after")

        if value:
            try:
                return max(0.0, float(value))
            except ValueError:
                return None

        return None

    @staticmethod
    def _extract_content(
        data: Any,
    ) -> str:
        if not isinstance(data, dict):
            raise ValueError("provider response is not an object")

        choices = data.get("choices")

        if not isinstance(choices, list) or not choices:
            raise ValueError("provider response contains no choices")

        choice = choices[0]

        if not isinstance(choice, dict):
            raise ValueError("provider returned an invalid choice")

        message = choice.get("message")

        if not isinstance(message, dict):
            raise ValueError("provider returned no message")

        content = message.get("content")

        if content is None:
            content = message.get("reasoning_content")

        if content is None:
            content = message.get("refusal")

        if content is None:
            raise ValueError("provider returned no textual content")

        if not isinstance(content, str):
            content = str(content)

        content = content.strip()

        if not content:
            raise ValueError("provider returned empty textual content")

        return content

    async def complete(
        self,
        prompt: str,
        history: list[dict[str, str]] | None = None,
        *,
        temperature: float = 0.0,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> str:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ProviderError(
                f"{self.name}: prompt must be a non-empty string",
                provider=self.name,
            )

        selected_model = (model or self.model).strip()

        if not selected_model:
            raise ProviderError(
                f"{self.name}: model is empty",
                provider=self.name,
            )

        payload: dict[str, Any] = {
            "model": selected_model,
            "messages": self._normalise_messages(prompt, history),
            "temperature": float(temperature),
        }

        if max_tokens is not None:
            payload["max_tokens"] = int(max_tokens)

        timeout = httpx.Timeout(
            connect=self.connect_timeout,
            read=self.timeout,
            write=self.write_timeout,
            pool=self.pool_timeout,
        )

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
            ) as client:
                response = await client.post(
                    self.endpoint,
                    headers=self._headers(),
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise ProviderError(
                f"{self.name}: request timed out",
                provider=self.name,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderError(
                f"{self.name}: network error: {exc}",
                provider=self.name,
            ) from exc

        retry_after = self._retry_after(response)

        if response.status_code >= 400:
            body = response.text[:4000]

            raise ProviderError(
                f"{self.name}: HTTP {response.status_code}: {body}",
                provider=self.name,
                status_code=response.status_code,
                response_body=body,
                retry_after=retry_after,
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

        try:
            return self._extract_content(data)
        except ValueError as exc:
            raise ProviderError(
                f"{self.name}: {exc}",
                provider=self.name,
                status_code=response.status_code,
                response_body=response.text[:4000],
            ) from exc

    async def run(
        self,
        prompt: str,
        history: list[dict[str, str]] | None = None,
    ) -> str:
        return await self.complete(prompt, history)
