from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderResponse:
    provider: str
    model: str
    content: str


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
    ) -> ProviderResponse:
        raise NotImplementedError

    @abstractmethod
    async def stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncIterator[str]:
        raise NotImplementedError
