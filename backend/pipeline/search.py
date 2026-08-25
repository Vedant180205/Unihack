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

from urllib.parse import urlparse

def find_manufacturer_domain(manufacturer_name: str) -> str:
    """Finds the official domain for a manufacturer, filtering out common encyclopedias/marketplaces."""
    if not manufacturer_name:
        return ""
    results = search(f"{manufacturer_name} official website", limit=5)
    ignore_domains = {"wikipedia.org", "amazon.com", "ebay.com", "walmart.com", "alibaba.com", "youtube.com", "facebook.com", "linkedin.com", "twitter.com", "instagram.com"}
    
    for r in results:
        url = r.get("url", "")
        if not url:
            continue
        domain = urlparse(url).netloc.replace("www.", "")
        if domain and not any(ign in domain for ign in ignore_domains):
            return domain
    return ""