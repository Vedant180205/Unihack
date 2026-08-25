import asyncio
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

DOC_KEYWORDS = {
    "Specification Sheet": ["spec", "specification"],
    "SDS": ["sds", "safety-data"],
    "Instruction/Installation Manual": ["install", "instruction"],
    "Owners/User Manual": ["manual", "owner"],
    "Catalog": ["catalog"],
}

async def crawl_one(crawler, url, run_config):
    try:
        result = await crawler.arun(url=url, config=run_config)
    except Exception as e:
        return {"url": url, "success": False, "error": str(e)}
    if not result.success:
        return {"url": url, "success": False, "error": result.error_message}

    doc_links = {}
    for link in result.links.get("internal", []) + result.links.get("external", []):
        href = link.get("href", "").lower()
        if href.endswith(".pdf"):
            for field, keywords in DOC_KEYWORDS.items():
                if any(k in href for k in keywords):
                    doc_links.setdefault(field, href)

    images = [img["src"] for img in result.media.get("images", []) if img.get("src")]

    return {
        "url": url,
        "success": True,
        "markdown": result.markdown,
        "doc_links": doc_links,
        "images": images[:5],
    }

async def crawl_sources(urls: list[str]) -> list[dict]:
    browser_config = BrowserConfig(browser_type="chromium", headless=True)
    run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
    async with AsyncWebCrawler(config=browser_config) as crawler:
        return [await crawl_one(crawler, u, run_config) for u in urls]