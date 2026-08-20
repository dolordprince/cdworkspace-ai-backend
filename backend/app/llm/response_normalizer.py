from __future__ import annotations

from typing import Any


def normalize_provider_response(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        return {
            "content": payload,
            "raw": payload,
        }

    if not isinstance(payload, dict):
        return {
            "content": str(payload),
            "raw": payload,
        }

    choices = payload.get("choices")

    if isinstance(choices, list) and choices:
        first = choices[0]

        if isinstance(first, dict):
            message = first.get("message")

            if isinstance(message, dict):
                content = message.get("content")

                if isinstance(content, str):
                    return {
                        "content": content,
                        "raw": payload,
                    }

            text = first.get("text")

            if isinstance(text, str):
                return {
                    "content": text,
                    "raw": payload,
                }

    content = payload.get("content")

    if isinstance(content, str):
        return {
            "content": content,
            "raw": payload,
        }

    output = payload.get("output")

    if isinstance(output, str):
        return {
            "content": output,
            "raw": payload,
        }

    return {
        "content": "",
        "raw": payload,
    }
