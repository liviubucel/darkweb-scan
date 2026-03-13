"""
Dark Web Scan API Server - Python Backend
Provides dark web intelligence scanning via REST API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime

# Import funcțiile existente
from scrape import scrape_multiple
from search import get_search_results
from llm import get_llm, refine_query, filter_results, generate_summary

app = FastAPI(title="ZebraByte Dark Web Intelligence API")

# CORS pentru Cloudflare Worker
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DarkWebScanRequest(BaseModel):
    query: str
    threads: int = 4
    model: str = "gpt-5-mini"

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

@app.get("/")
async def root():
    return {
        "service": "ZebraByte Dark Web Intelligence API",
        "status": "online",
        "version": "1.0.0",
        "endpoints": {
            "/api/darkweb-scan": "POST - Dark web scanning",
            "/health": "GET - Health check"
        }
    }

@app.post("/api/darkweb-scan", response_model=DarkWebScanResponse)
async def scan_darkweb(request: DarkWebScanRequest):
    """
    Dark web intelligence scanning endpoint
    """
    try:
        start_time = datetime.now()
        
        # Initialize LLM
        llm = get_llm(request.model)
        
        # Refine query
        refined_query = refine_query(llm, request.query)
        
        # Search dark web
        search_results = get_search_results(
            refined_query.replace(" ", "+"), 
            max_workers=request.threads
        )
        
        # Filter results
        filtered_results = filter_results(llm, refined_query, search_results)
        
        # Scrape content
        scraped_results = scrape_multiple(filtered_results, max_workers=request.threads)
        
        # Generate summary
        summary = generate_summary(llm, request.query, scraped_results)
        
        # Format results pentru frontend
        formatted_results = []
        for url, content in scraped_results.items():
            # Găsește rezultatul original pentru titlu
            original = next((r for r in filtered_results if r.get('link') == url), None)
            formatted_results.append({
                "title": original.get('title', 'Unknown') if original else 'Unknown',
                "url": url,
                "snippet": content[:500] + "..." if len(content) > 500 else content
            })
        
        return DarkWebScanResponse(
            query=request.query,
            refined_query=refined_query,
            timestamp=start_time.isoformat(),
            results=formatted_results,
            summary=summary,
            total_results=len(formatted_results)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )