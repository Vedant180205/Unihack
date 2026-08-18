import asyncio

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode
)


async def main():

    browser_config = BrowserConfig(
        browser_type="chromium",
        headless=True
    )

    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS
        
    )

    async with AsyncWebCrawler(
        config=browser_config
    ) as crawler:

        result = await crawler.arun(
            url="https://www.wikipedia.org/",
            config=run_config
        )

        if result.success:
            print("Crawl successful!\n")
            print(result.markdown[:3000])
        else:
            print("Crawl failed:")
            print(result.error_message)


if __name__ == "__main__":
    asyncio.run(main())