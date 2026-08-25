import asyncio
import requests

from aggregator import aggregate

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode
)


SEARXNG_URL = "http://localhost:8080"


def search(query, limit=5):

    response = requests.get(
        f"{SEARXNG_URL}/search",
        params={
            "q": query,
            "format": "json"
        },
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    return [
        {
            "title": r.get("title"),
            "url": r.get("url"),
            "content": r.get("content")
        }
        for r in data.get("results", [])[:limit]
    ]


async def crawl_pages(results):

    browser_config = BrowserConfig(
        browser_type="chromium",
        headless=True
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS
    )

    crawled = []

    async with AsyncWebCrawler(
        config=browser_config
    ) as crawler:

        for item in results:

            try:

                result = await crawler.arun(
                    url=item["url"],
                    config=run_config
                )

                if result.success:

                    crawled.append({
                        "title": item["title"],
                        "url": item["url"],
                        "content": result.markdown
                    })

                    print(
                        f"[SUCCESS] {item['url']}"
                    )

                else:

                    print(
                        f"[FAILED] {item['url']}"
                    )

            except Exception as e:

                print(
                    f"[ERROR] {item['url']}: {e}"
                )

    return crawled


async def main():

    query = "advantages of renewable energy"

    print("Searching...")

    results = search(
        query,
        limit=5
    )

    print(
        f"Found {len(results)} results."
    )

    print("\nCrawling...")

    pages = await crawl_pages(results)

    print(
        f"\nSuccessfully crawled {len(pages)} pages."
    )

    for page in pages:

        print("\n" + "=" * 80)

        print(page["title"])

        print(page["url"])

        print("\n")

        print(page["content"][:2000])

answer = aggregate(
    query,
    pages
)

print("\n\n")
print("=" * 80)
print("FINAL ANSWER")
print("=" * 80)

print(answer)

if __name__ == "__main__":

    asyncio.run(main())