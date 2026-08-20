from __future__ import annotations

import asyncio
import re
from urllib.parse import quote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

ANDROID_BASE = "https://developer.android.com/"
ANDROID_SEARCH = "https://developer.android.com/s/results"

TIMEOUT = httpx.Timeout(
    connect=15.0,
    read=45.0,
    write=15.0,
    pool=15.0,
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 "
        "(X11; Linux x86_64) "
        "AppleWebKit/537.36 "
        "(KHTML, like Gecko) "
        "Chrome/140.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def normalize_topic(topic: str) -> str:
    value = topic.strip()

    if not value:
        raise ValueError("topic is required")

    value = value.lstrip("/")

    if value.startswith("https://") or value.startswith("http://"):
        parsed = urlparse(value)

        if parsed.scheme != "https" or parsed.netloc != "developer.android.com":
            raise ValueError(
                "Only https://developer.android.com URLs are supported"
            )

        return value

    if value.startswith("developer.android.com/"):
        value = value.split("developer.android.com/", 1)[1]

    return urljoin(ANDROID_BASE, value)


def clean_text(value: str) -> str:
    soup = BeautifulSoup(value, "html.parser")

    for element in soup(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "nav",
            "footer",
            "header",
        ]
    ):
        element.decompose()

    text = soup.get_text(" ", strip=True)

    return re.sub(r"\s+", " ", text).strip()


def extract_document(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title = ""

    if soup.title:
        title = soup.title.get_text(" ", strip=True)

    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.body
        or soup
    )

    for element in main(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "nav",
            "footer",
            "header",
        ]
    ):
        element.decompose()

    text = main.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return {
        "title": title,
        "url": url,
        "source": "developer.android.com",
        "content": text[:100_000],
    }


async def _request(url: str, params: dict | None = None) -> httpx.Response:
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(
                timeout=TIMEOUT,
                headers=HEADERS,
                follow_redirects=True,
                http2=True,
            ) as client:
                response = await client.get(url, params=params)

                if response.status_code == 200:
                    return response

                if response.status_code in {429, 500, 502, 503, 504}:
                    last_error = RuntimeError(
                        f"Android Developer returned HTTP {response.status_code}"
                    )

                    if attempt < 2:
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue

                response.raise_for_status()

        except (
            httpx.ConnectError,
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.RemoteProtocolError,
        ) as exc:
            last_error = exc

            if attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue

    raise RuntimeError(
        f"Unable to retrieve Android Developer documentation: {last_error}"
    )


async def fetch_android_docs(topic: str) -> dict:
    url = normalize_topic(topic)

    response = await _request(url)

    if not response.text.strip():
        raise RuntimeError("Android Developer returned an empty document")

    return extract_document(response.text, str(response.url))


async def search_android_docs(query: str, limit: int = 10) -> dict:
    query = query.strip()

    if not query:
        raise ValueError("q is required")

    limit = max(1, min(int(limit), 20))

    response = await _request(
        ANDROID_SEARCH,
        params={
            "q": query,
        },
    )

    soup = BeautifulSoup(response.text, "html.parser")

    results: list[dict] = []
    seen: set[str] = set()

    selectors = [
        "a[href]",
    ]

    for selector in selectors:
        for anchor in soup.select(selector):
            href = anchor.get("href")

            if not href:
                continue

            absolute = urljoin(ANDROID_BASE, href)
            parsed = urlparse(absolute)

            if parsed.netloc != "developer.android.com":
                continue

            if not parsed.path or parsed.path == "/s/results":
                continue

            text = anchor.get_text(" ", strip=True)

            if len(text) < 3:
                continue

            key = absolute.split("#", 1)[0]

            if key in seen:
                continue

            seen.add(key)

            results.append(
                {
                    "title": text[:300],
                    "url": key,
                    "source": "developer.android.com",
                }
            )

            if len(results) >= limit:
                break

        if len(results) >= limit:
            break

    return {
        "query": query,
        "count": len(results),
        "results": results,
        "source": "developer.android.com",
    }
