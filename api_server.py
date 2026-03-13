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
    model: str = "gemini-2.5-flash"


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
        llm = get_llm(request.model)
        refined_query = refine_query(llm, request.query)
        search_results = get_search_results(
            refined_query.replace(" ", "+"),
            max_workers=request.threads,
        )
        filtered_results = filter_results(llm, refined_query, search_results)
        scraped_results = scrape_multiple(filtered_results, max_workers=request.threads)
        summary = generate_summary(llm, request.query, scraped_results)

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
