import os
import re
import html
import asyncio
import httpx
from typing import List, Dict, Any
from urllib.parse import unquote

# Keywords that signal a query needs live/recent internet data or verification
LIVE_DATA_KEYWORDS = [
    "latest", "recent", "today", "current", "news", "now", "update",
    "breaking", "live", "2024", "2025", "2026", "2027", "this year", "this week",
    "this month", "just happened", "new report", "new attack", "new vulnerability",
    "new cve", "happening", "announced", "released", "disclosed", "verify",
    "verification", "check", "fact", "truth", "is it true", "status", "who is",
    "what is", "where is", "when did", "specification", "specs", "details",
    "capabilities", "weapon", "missile", "aircraft", "defense", "development"
]


def query_needs_web_search(query: str) -> bool:
    """Heuristic: detect if a query requires live internet data or verification."""
    q_lower = query.lower()
    return any(kw in q_lower for kw in LIVE_DATA_KEYWORDS)


def clean_html_entities(text: str) -> str:
    """Unescapes HTML entities and strips remaining HTML tags."""
    if not text:
        return ""
    text = html.unescape(text)
    return re.sub(r'<[^>]+>', '', text).strip()


class WebSearchEngine:
    """
    Multi-tier Live Web Search integration for STRA AI.
    Tier 1: Serper.dev (Google-backed, if SERPER_API_KEY is configured).
    Tier 2: duckduckgo_search library.
    Tier 3: Async HTTP DDG HTML Engine (direct endpoint fallback).
    Tier 4: Wikipedia Open Search API (for verified entity & facts verification).
    """

    def __init__(self):
        self.serper_key = os.getenv("SERPER_API_KEY", "")
        self.max_results = int(os.getenv("WEB_SEARCH_MAX_RESULTS", "5"))
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }

    async def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Performs multi-stage web search and returns a list of result dicts:
        title, url, snippet, source
        """
        # Tier 1: Serper API if key available
        if self.serper_key:
            results = await self._search_serper(query)
            if results:
                return results

        # Tier 2: DuckDuckGo Python SDK
        results = await self._search_duckduckgo_sdk(query)
        if results:
            return results

        # Tier 3: Async HTTP DDG HTML Endpoint
        results = await self._search_ddg_html(query)
        if results:
            return results

        # Tier 4: Wikipedia Open Search API (fallback for facts/verification)
        results = await self._search_wikipedia(query)
        return results

    async def _search_serper(self, query: str) -> List[Dict[str, Any]]:
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
                    "title": clean_html_entities(item.get("title", "")),
                    "url": item.get("link", ""),
                    "snippet": clean_html_entities(item.get("snippet", "")),
                    "source": "Google (via Serper)"
                })
            return results
        except Exception as e:
            print(f"[WebSearch] Serper search error: {e}")
            return []

    async def _search_duckduckgo_sdk(self, query: str) -> List[Dict[str, Any]]:
        max_results = self.max_results

        def _blocking_ddg_search():
            try:
                import importlib
                try:
                    ddg_module = importlib.import_module("ddgs")
                except ImportError:
                    ddg_module = importlib.import_module("duckduckgo_search")
                DDGS = getattr(ddg_module, "DDGS")
                results = []
                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=max_results):
                        results.append({
                            "title": clean_html_entities(r.get("title", "")),
                            "url": r.get("href", ""),
                            "snippet": clean_html_entities(r.get("body", "")),
                            "source": "DuckDuckGo Web"
                        })
                return results
            except Exception as e:
                print(f"[WebSearch] DDG SDK error: {e}")
                return []

        try:
            return await asyncio.to_thread(_blocking_ddg_search)
        except Exception as e:
            print(f"[WebSearch] Thread execution error: {e}")
            return []

    async def _search_ddg_html(self, query: str) -> List[Dict[str, Any]]:
        """Direct async HTTP scraper for DuckDuckGo HTML endpoint."""
        results = []
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query},
                    headers=self.headers
                )
                if resp.status_code == 200:
                    html_text = resp.text
                    matches = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)">([^<]+)</a>', html_text)
                    snippets = re.findall(r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', html_text, re.S)
                    for idx, (url, title) in enumerate(matches[:self.max_results]):
                        if '//duckduckgo.com/l/?uddg=' in url:
                            url = unquote(url.split('uddg=')[1].split('&')[0])
                        snip = ""
                        if idx < len(snippets):
                            snip = clean_html_entities(snippets[idx])
                        results.append({
                            "title": clean_html_entities(title),
                            "url": url,
                            "snippet": snip,
                            "source": "DuckDuckGo Live"
                        })
        except Exception as e:
            print(f"[WebSearch] DDG HTML Direct error: {e}")
        return results

    async def _search_wikipedia(self, query: str) -> List[Dict[str, Any]]:
        """Wikipedia Search API fallback for fact checking & entity verification."""
        results = []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={
                        "action": "query",
                        "list": "search",
                        "srsearch": query,
                        "format": "json",
                        "srlimit": self.max_results
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("query", {}).get("search", []):
                        title = clean_html_entities(item.get("title", ""))
                        snip = clean_html_entities(item.get("snippet", ""))
                        url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
                        results.append({
                            "title": title,
                            "url": url,
                            "snippet": snip,
                            "source": "Wikipedia Intel"
                        })
        except Exception as e:
            print(f"[WebSearch] Wikipedia API error: {e}")
        return results

    def format_web_context(self, results: List[Dict[str, Any]]) -> str:
        """Formats web search results into a clean prompt context block."""
        if not results:
            return ""
        blocks = []
        for i, r in enumerate(results, 1):
            blocks.append(
                f"--- WEB SOURCE [{i}]: {r['title']} ---\n"
                f"URL: {r['url']}\n"
                f"SOURCE: {r['source']}\n"
                f"SUMMARY: {r['snippet']}"
            )
        return "\n\n".join(blocks)
