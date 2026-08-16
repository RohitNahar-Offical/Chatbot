import os
import asyncio
import httpx
from typing import List, Dict, Any

# Keywords that signal a query needs live/recent internet data
LIVE_DATA_KEYWORDS = [
    "latest", "recent", "today", "current", "news", "now", "update",
    "breaking", "live", "2024", "2025", "2026", "this year", "this week",
    "this month", "just happened", "new report", "new attack", "new vulnerability",
    "new cve", "happening", "announced", "released", "disclosed",
]


def query_needs_web_search(query: str) -> bool:
    """Heuristic: detect if a query requires live internet data."""
    q_lower = query.lower()
    return any(kw in q_lower for kw in LIVE_DATA_KEYWORDS)


class WebSearchEngine:
    """
    Live Web Search integration for STRA AI.
    Uses DuckDuckGo Instant Answer API (free, no key) by default.
    Falls back to Serper.dev (Google-backed) if SERPER_API_KEY is configured.
    All network calls run in a thread pool to avoid blocking the ASGI event loop.
    """

    def __init__(self):
        self.serper_key = os.getenv("SERPER_API_KEY", "")
        self.max_results = int(os.getenv("WEB_SEARCH_MAX_RESULTS", "5"))

    async def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Performs a web search and returns a list of result dicts with:
        title, url, snippet, source
        """
        if self.serper_key:
            return await self._search_serper(query)
        else:
            return await self._search_duckduckgo(query)

    async def _search_duckduckgo(self, query: str) -> List[Dict[str, Any]]:
        """
        Uses duckduckgo_search library — no API key required.
        Runs the blocking DDGS call in asyncio.to_thread to avoid blocking ASGI.
        """
        max_results = self.max_results

        def _blocking_ddg_search():
            try:
                from duckduckgo_search import DDGS
                results = []
                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=max_results):
                        results.append({
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", ""),
                            "source": "DuckDuckGo"
                        })
                return results
            except Exception as e:
                print(f"[WebSearch] DuckDuckGo search error: {e}")
                return []

        try:
            return await asyncio.to_thread(_blocking_ddg_search)
        except Exception as e:
            print(f"[WebSearch] Thread execution error: {e}")
            return []

    async def _search_serper(self, query: str) -> List[Dict[str, Any]]:
        """
        Uses Serper.dev (Google Search API) — requires SERPER_API_KEY.
        Uses async httpx client so it never blocks.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": self.serper_key,
                        "Content-Type": "application/json"
                    },
                    json={"q": query, "num": self.max_results}
                )
            data = response.json()
            results = []
            for item in data.get("organic", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source": "Google (via Serper)"
                })
            return results
        except Exception as e:
            print(f"[WebSearch] Serper search error: {e}, falling back to DuckDuckGo")
            return await self._search_duckduckgo(query)

    def format_web_context(self, results: List[Dict[str, Any]]) -> str:
        """Formats web search results into a clean prompt context block."""
        if not results:
            return ""
        blocks = []
        for i, r in enumerate(results, 1):
            blocks.append(
                f"--- WEB SOURCE [{i}]: {r['title']} ---\n"
                f"URL: {r['url']}\n"
                f"{r['snippet']}"
            )
        return "\n\n".join(blocks)
