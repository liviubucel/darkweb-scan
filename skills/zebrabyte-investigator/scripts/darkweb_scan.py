import argparse
import json
import socket
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from api_server import build_summary
from scrape import scrape_multiple
from search import get_search_results


def tor_is_available(host: str = "127.0.0.1", port: int = 9050, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def run_scan(query: str, threads: int, max_results: int) -> dict:
    refined_query = query.strip()
    search_results = get_search_results(refined_query.replace(" ", "+"), max_workers=threads)
    filtered_results = search_results[:max_results]
    scraped_results = scrape_multiple(filtered_results, max_workers=threads)

    formatted_results = []
    for url, content in scraped_results.items():
        original = next((result for result in filtered_results if result.get("link") == url), None)
        formatted_results.append(
            {
                "title": original.get("title", "Unknown") if original else "Unknown",
                "url": url,
                "snippet": content[:500] + "..." if len(content) > 500 else content,
            }
        )

    return {
        "query": query,
        "refined_query": refined_query,
        "results": formatted_results,
        "summary": build_summary(
            query,
            refined_query,
            len(search_results),
            len(filtered_results),
            scraped_results,
        ),
        "total_results": len(formatted_results),
        "metadata": {
            "tor_available": tor_is_available(),
            "raw_results": len(search_results),
            "filtered_results": len(filtered_results),
            "threads": threads,
            "max_results": max_results,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the ZebraByte dark web scan and print JSON.")
    parser.add_argument("--query", required=True, help="Dark web query to investigate.")
    parser.add_argument("--threads", type=int, default=4, help="Concurrent worker count.")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum results to scrape.")
    args = parser.parse_args()

    try:
        payload = run_scan(args.query, args.threads, args.max_results)
    except Exception as exc:
        print(json.dumps({"error": f"Dark web scan failed: {exc}"}, indent=2))
        return 1

    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
