import os
import requests
from dotenv import load_dotenv

load_dotenv()

SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")

def search(query: str, limit: int = 5) -> list[dict]:
    try:
        response = requests.get(
            f"{SEARXNG_URL}/search",
            params={"q": query, "format": "json"},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")
            }
            for r in data.get("results", [])[:limit]
        ]
    except Exception as e:
        print(f"  [WARN] SearXNG search failed ({SEARXNG_URL}): {e}")
        return []