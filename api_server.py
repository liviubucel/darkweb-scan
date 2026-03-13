"""
Dark Web Scan API Server - Python Backend
Provides dark web intelligence scanning via REST API.
"""

import os
import secrets
import logging
from datetime import datetime
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from llm import filter_results, generate_summary, get_llm, refine_query
from scrape import scrape_multiple
from search import get_search_results

logging.basicConfig(level=logging.INFO)


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
    model: str = "auto"


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


def configured_model_candidates(requested_model: str) -> List[str]:
    configured = []
    if os.getenv("GOOGLE_API_KEY"):
        configured.append("gemini-2.5-flash")
    if os.getenv("OPENAI_API_KEY"):
        configured.append("gpt-5-mini")
    if os.getenv("ANTHROPIC_API_KEY"):
        configured.append("claude-sonnet-4-5")
    if os.getenv("OLLAMA_BASE_URL"):
        configured.append("llama3.1")

    requested = (requested_model or "auto").strip()
    if requested.lower() == "auto":
        return configured

    ordered = [requested]
    for model in configured:
        if model not in ordered:
            ordered.append(model)
    return ordered


def build_llm_candidates(requested_model: str):
    candidates = []
    for model_name in configured_model_candidates(requested_model):
        try:
            candidates.append((model_name, get_llm(model_name)))
        except Exception:
            logging.exception("Failed to initialize model '%s'", model_name)
    return candidates


def try_refine_query(query: str, llm_candidates) -> str:
    for model_name, llm in llm_candidates:
        try:
            refined = refine_query(llm, query)
            if refined and refined.strip():
                return refined.strip()
        except Exception:
            logging.exception("Query refinement failed with model '%s'", model_name)
    return query


def try_filter_results(query: str, results: list, llm_candidates) -> list:
    if not results:
        return []
    if len(results) <= 10:
        return results[:10]

    for model_name, llm in llm_candidates:
        try:
            filtered = filter_results(llm, query, results)
            if filtered:
                return filtered
        except Exception:
            logging.exception("Result filtering failed with model '%s'", model_name)
    return results[:10]


def fallback_summary(query: str, refined_query: str, raw_count: int, filtered_count: int) -> str:
    return (
        f"Input Query: {query}\n\n"
        f"Refined Query: {refined_query}\n\n"
        "Source Links Referenced for Analysis:\n"
        "No source links were available for analysis.\n\n"
        "Investigation Artifacts:\n"
        "No artifacts could be extracted because the scan returned no usable dark web pages.\n\n"
        "Key Insights:\n"
        f"1. The query returned {raw_count} raw results and {filtered_count} filtered results.\n"
        "2. No scrapeable pages were available for summary generation.\n"
        "3. This can happen when onion indexes have no matches, pages are offline, or the query is too broad.\n\n"
        "Next Steps:\n"
        "- Try a more specific query with product, actor, breach, forum, or victim terms.\n"
        "- Retry later because onion indexes and hidden services are often unstable.\n"
        "- Use alternate keywords such as dump, leak, combo, breach, logs, market, or forum."
    )


def try_generate_summary(query: str, refined_query: str, scraped_results: dict, raw_count: int, filtered_count: int, llm_candidates) -> str:
    if not scraped_results:
        return fallback_summary(query, refined_query, raw_count, filtered_count)

    for model_name, llm in llm_candidates:
        try:
            return generate_summary(llm, query, scraped_results)
        except Exception:
            logging.exception("Summary generation failed with model '%s'", model_name)

    return fallback_summary(query, refined_query, raw_count, filtered_count)


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
        llm_candidates = build_llm_candidates(request.model)
        refined_query = try_refine_query(request.query, llm_candidates)
        search_results = get_search_results(
            refined_query.replace(" ", "+"),
            max_workers=request.threads,
        )
        filtered_results = try_filter_results(refined_query, search_results, llm_candidates)
        scraped_results = scrape_multiple(filtered_results, max_workers=request.threads)
        summary = try_generate_summary(
            request.query,
            refined_query,
            scraped_results,
            len(search_results),
            len(filtered_results),
            llm_candidates,
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
        logging.exception("Dark web scan failed")
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}") from exc


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
