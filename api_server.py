"""
Dark Web Scan API Server - Python Backend
Provides dark web intelligence scanning via REST API.
"""

import os
import secrets
import socket
from datetime import datetime
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from scrape import scrape_multiple
from search import get_search_results


allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
backend_shared_secret = os.getenv("BACKEND_SHARED_SECRET")

app = FastAPI(title="ZebraByte Dark Web Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or [],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["content-type", "authorization", "x-backend-secret"],
)


class DarkWebScanRequest(BaseModel):
    query: str
    threads: int = 4
    model: str = "disabled"


class DarkWebResult(BaseModel):
    title: str
    url: str
    snippet: str


class DarkWebScanResponse(BaseModel):
    query: str
    refined_query: str
    timestamp: str
    results: List[DarkWebResult]
    summary: Optional[str] = None
    total_results: int


def verify_backend_secret(header_value: Optional[str]) -> None:
    if not backend_shared_secret:
        raise HTTPException(status_code=500, detail="Backend secret is not configured.")
    if not header_value or not secrets.compare_digest(header_value, backend_shared_secret):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def build_summary(query: str, refined_query: str, raw_count: int, filtered_count: int, scraped_results: dict) -> str:
    if not scraped_results:
        return (
            f"Input Query: {query}\n\n"
            f"Refined Query: {refined_query}\n\n"
            "Source Links Referenced for Analysis:\n"
            "No source links were available for analysis.\n\n"
            "What This Means:\n"
            f"1. The query returned {raw_count} raw results and {filtered_count} filtered results.\n"
            "2. No usable page content was collected from the selected results.\n"
            "3. This usually happens when onion indexes have no matches, pages are offline, or the term is too narrow.\n\n"
            "Next Steps:\n"
            "- Try broader or adjacent terms such as breach, dump, combo, forum, market, or logs.\n"
            "- Retry later because hidden services and onion indexes are unstable.\n"
            "- Add a company, threat actor, breach, or product name for a more precise search."
        )

    source_lines = []
    snippet_lines = []
    for index, (url, content) in enumerate(scraped_results.items(), start=1):
        source_lines.append(f"{index}. {url}")
        cleaned = " ".join(content.split())
        snippet_lines.append(f"{index}. {cleaned[:280]}")

    return (
        f"Input Query: {query}\n\n"
        f"Refined Query: {refined_query}\n\n"
        "Source Links Referenced for Analysis:\n"
        f"{chr(10).join(source_lines)}\n\n"
        "What Was Found:\n"
        f"1. The search returned {raw_count} raw results.\n"
        f"2. The API kept {filtered_count} candidate results for scraping.\n"
        f"3. {len(scraped_results)} pages returned usable text.\n\n"
        "Collected Snippets:\n"
        f"{chr(10).join(snippet_lines)}\n\n"
        "Next Steps:\n"
        "- Review the source links with the strongest match to your query.\n"
        "- Re-run the search with a more specific actor, company, breach, or artifact name.\n"
        "- Use the snippets to decide which links justify deeper manual investigation."
    )


def tor_is_available() -> bool:
    host = os.getenv("TOR_SOCKS_HOST", "127.0.0.1")
    port = int(os.getenv("TOR_SOCKS_PORT", "9050"))
    timeout = float(os.getenv("TOR_HEALTHCHECK_TIMEOUT", "1.5"))
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


@app.get("/")
async def root():
    return {
        "service": "ZebraByte Dark Web Intelligence API",
        "status": "online",
        "version": "1.0.0",
        "endpoints": {
            "/api/darkweb-scan": "POST - Dark web scanning",
            "/health": "GET - Health check",
        },
    }


@app.post("/api/darkweb-scan", response_model=DarkWebScanResponse)
async def scan_darkweb(
    request: DarkWebScanRequest,
    x_backend_secret: Optional[str] = Header(default=None),
):
    verify_backend_secret(x_backend_secret)

    try:
        start_time = datetime.now()
        refined_query = request.query.strip()
        search_results = get_search_results(
            refined_query.replace(" ", "+"),
            max_workers=request.threads,
        )
        filtered_results = search_results[:10]
        scraped_results = scrape_multiple(filtered_results, max_workers=request.threads)
        summary = build_summary(
            request.query,
            refined_query,
            len(search_results),
            len(filtered_results),
            scraped_results,
        )

        formatted_results = []
        for url, content in scraped_results.items():
            original = next((r for r in filtered_results if r.get("link") == url), None)
            formatted_results.append(
                {
                    "title": original.get("title", "Unknown") if original else "Unknown",
                    "url": url,
                    "snippet": content[:500] + "..." if len(content) > 500 else content,
                }
            )

        return DarkWebScanResponse(
            query=request.query,
            refined_query=refined_query,
            timestamp=start_time.isoformat(),
            results=formatted_results,
            summary=summary,
            total_results=len(formatted_results),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}") from exc


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "tor_available": tor_is_available(),
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
