from __future__ import annotations

import hashlib
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

MAX_PAGE_BYTES = 1_500_000
MAX_TEXT_CHARS = 60_000
MAX_SCRAPE_RESPONSE_BYTES = 700_000
MAX_RESULTS = 60
MAX_SCRAPE_URLS = 12
REQUEST_TIMEOUT = (8, 25)
ALLOWED_PORTS = {None, 80, 443}
ONION_V3 = re.compile(r"^[a-z2-7]{56}\.onion$", re.IGNORECASE)

app = FastAPI(title="ZebraByte Tor Collector", docs_url=None, redoc_url=None, openapi_url=None)


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    limit: int = Field(default=40, ge=1, le=MAX_RESULTS)


class ScrapeRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=MAX_SCRAPE_URLS)


def _session() -> requests.Session:
    session = requests.Session()
    # Never inherit HTTP(S)_PROXY/NO_PROXY from the container runtime. All collector
    # application traffic must go through Tor's SOCKS resolver.
    session.trust_env = False
    retry = Retry(
        total=2,
        connect=2,
        read=1,
        backoff_factor=0.4,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    session.mount("http://", HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=8))
    session.mount("https://", HTTPAdapter(max_retries=retry, pool_connections=8, pool_maxsize=8))
    session.proxies = {"http": "socks5h://127.0.0.1:9050", "https": "socks5h://127.0.0.1:9050"}
    session.headers.update(
        {
            "User-Agent": "ZebraByte-Defensive-Collector/1.0",
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        }
    )
    return session


def _validated_onion_url(raw: str) -> str:
    if not isinstance(raw, str) or len(raw) > 2048:
        raise ValueError("invalid url")
    parsed = urlparse(raw.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("unsupported scheme")
    if parsed.username or parsed.password or not parsed.hostname:
        raise ValueError("invalid authority")
    host = parsed.hostname.lower()
    if not ONION_V3.fullmatch(host):
        raise ValueError("only v3 onion hosts are allowed")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("invalid port") from exc
    if port not in ALLOWED_PORTS:
        raise ValueError("unsupported port")
    return parsed.geturl()


def _safe_get(url: str) -> tuple[bytes, str, str]:
    current = _validated_onion_url(url)
    with _session() as session:
        for _ in range(3):
            response = session.get(current, timeout=REQUEST_TIMEOUT, stream=True, allow_redirects=False)
            try:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("redirect without location")
                    current = _validated_onion_url(urljoin(current, location))
                    continue
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if content_type not in {"text/html", "application/xhtml+xml", "text/plain", ""}:
                    raise ValueError("unsupported content type")
                content = bytearray()
                for chunk in response.iter_content(16_384):
                    if not chunk:
                        continue
                    content.extend(chunk)
                    if len(content) > MAX_PAGE_BYTES:
                        raise ValueError("response too large")
                return bytes(content), content_type or "text/html", current
            finally:
                response.close()
    raise ValueError("too many redirects")


def _html_to_text(content: bytes, content_type: str) -> tuple[str, str]:
    decoded = content.decode("utf-8", errors="replace")
    if content_type == "text/plain":
        text, title = decoded, ""
    else:
        soup = BeautifulSoup(decoded, "html.parser")
        for node in soup(["script", "style", "noscript", "svg", "iframe"]):
            node.decompose()
        title = soup.title.get_text(" ", strip=True)[:300] if soup.title else ""
        text = soup.get_text("\n", strip=True)
    lines: list[str] = []
    previous = None
    total = 0
    for line in text.splitlines():
        normalized = " ".join(line.split())
        if not normalized or normalized == previous:
            continue
        previous = normalized
        lines.append(normalized)
        total += len(normalized)
        if total >= MAX_TEXT_CHARS:
            break
    return title, "\n".join(lines)[:MAX_TEXT_CHARS]


def _engines() -> list[dict[str, str]]:
    raw = os.getenv("ONION_SEARCH_ENGINES_JSON", "[]")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("invalid collector configuration") from exc
    output: list[dict[str, str]] = []
    if not isinstance(parsed, list):
        return output
    for item in parsed[:20]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", ""))[:80]
        template = str(item.get("url_template", ""))
        if "{query}" not in template:
            continue
        try:
            _validated_onion_url(template.replace("{query}", "test"))
        except ValueError:
            continue
        output.append({"name": name or "onion-index", "url_template": template})
    return output


def _parse_search_html(html: bytes, base_url: str, engine: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html.decode("utf-8", errors="replace"), "html.parser")
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href", "")).strip()
        if not href:
            continue
        candidate = urljoin(base_url, href)
        try:
            candidate = _validated_onion_url(candidate)
        except ValueError:
            continue
        if candidate in seen:
            continue
        title = " ".join(anchor.get_text(" ", strip=True).split())[:300]
        if len(title) < 2:
            continue
        parent = anchor.parent.get_text(" ", strip=True) if anchor.parent else ""
        seen.add(candidate)
        results.append({"title": title, "url": candidate, "snippet": " ".join(parent.split())[:800], "engine": engine})
        if len(results) >= 20:
            break
    return results


def _search_engine(engine: dict[str, str], query: str) -> list[dict[str, str]]:
    url = engine["url_template"].replace("{query}", quote_plus(query))
    content, content_type, final_url = _safe_get(url)
    if content_type == "text/plain":
        return []
    return _parse_search_html(content, final_url, engine["name"])


def _bounded_sources(urls: list[str], completed: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    used = len(b'{"sources":[]}')
    for requested_url in urls:
        source = completed.get(requested_url)
        if not source:
            continue
        candidate = dict(source)
        without_text = dict(candidate)
        without_text["text"] = ""
        overhead = len(json.dumps(without_text, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) + 2
        remaining = MAX_SCRAPE_RESPONSE_BYTES - used - overhead
        if remaining <= 0:
            break
        text_bytes = candidate.get("text", "").encode("utf-8")
        if len(text_bytes) > remaining:
            candidate["text"] = text_bytes[:remaining].decode("utf-8", errors="ignore")
        encoded_size = len(json.dumps(candidate, ensure_ascii=False, separators=(",", ":")).encode("utf-8")) + 1
        if used + encoded_size > MAX_SCRAPE_RESPONSE_BYTES:
            break
        sources.append(candidate)
        used += encoded_size
    return sources


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "collector": "tor", "mode": "defensive"}


@app.post("/search")
def search(request: SearchRequest) -> dict[str, Any]:
    query = " ".join(request.query.split())
    engines = _engines()
    if not engines:
        raise HTTPException(status_code=503, detail="No onion search engines configured")
    combined: list[dict[str, str]] = []
    seen: set[str] = set()
    with ThreadPoolExecutor(max_workers=min(4, len(engines))) as executor:
        futures = [executor.submit(_search_engine, engine, query) for engine in engines]
        for future in as_completed(futures):
            try:
                rows = future.result()
            except Exception:
                continue
            for row in rows:
                if row["url"] in seen:
                    continue
                seen.add(row["url"])
                combined.append(row)
                if len(combined) >= request.limit:
                    break
            if len(combined) >= request.limit:
                break
    return {"results": combined[: request.limit]}


def _scrape_one(url: str) -> dict[str, str]:
    validated = _validated_onion_url(url)
    content, content_type, final_url = _safe_get(validated)
    title, text = _html_to_text(content, content_type)
    return {
        "url": final_url,
        "title": title,
        "text": text,
        "contentType": content_type,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


@app.post("/scrape")
def scrape(request: ScrapeRequest) -> dict[str, Any]:
    urls: list[str] = []
    for raw in request.urls:
        try:
            validated = _validated_onion_url(raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if validated not in urls:
            urls.append(validated)

    completed: dict[str, dict[str, str]] = {}
    with ThreadPoolExecutor(max_workers=min(4, len(urls))) as executor:
        futures = {executor.submit(_scrape_one, url): url for url in urls}
        for future in as_completed(futures):
            requested_url = futures[future]
            try:
                completed[requested_url] = future.result()
            except Exception:
                continue

    return {"sources": _bounded_sources(urls, completed)}
