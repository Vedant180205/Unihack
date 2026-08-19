import asyncio
from playwright.async_api import async_playwright, TimeoutError
from bs4 import BeautifulSoup

async def scrape_product_page(url: str) -> dict:
    if not url:
        return {"success": False, "markdown": "", "reason": "Empty URL"}
        
    print(f"[INFO] Scraping with Everything Bucket Playwright: {url} ...")
    
    markdown_chunks = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use an extended user agent and avoid bot detection headers if possible
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()
        
        try:
            # wait_until="domcontentloaded" ensures we don't timeout waiting for endless tracking scripts
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            # Wait an additional 3 seconds for SPA frameworks (React/Vue) to paint the data
            await page.wait_for_timeout(3000)
            
        except TimeoutError:
            print("[WARN] Page load timed out, but proceeding with whatever loaded.")
        except Exception as e:
            await browser.close()
            return {"success": False, "markdown": "", "reason": f"Navigation error: {e}"}
            
        html = await page.content()
        await browser.close()

    soup = BeautifulSoup(html, "html.parser")
    
    # Bucket 1: Meta Tags (Title & Description)
    title = soup.title.string if soup.title else ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    meta_desc_text = meta_desc["content"] if meta_desc and meta_desc.has_attr("content") else ""
    
    if title or meta_desc_text:
        markdown_chunks.append("### METADATA")
        if title: markdown_chunks.append(f"**Title**: {title}")
        if meta_desc_text: markdown_chunks.append(f"**Description**: {meta_desc_text}")
        markdown_chunks.append("\n")
        
    # Bucket 2: JSON-LD Schemas
    ld_jsons = soup.find_all("script", type="application/ld+json")
    if ld_jsons:
        markdown_chunks.append("### STRUCTURED DATA (JSON-LD)")
        for ld in ld_jsons:
            if ld.string:
                markdown_chunks.append(f"```json\n{ld.string.strip()}\n```")
        markdown_chunks.append("\n")
        
    # Bucket 3: React / Vue / Next.js Data Payloads
    for script in soup.find_all("script"):
        if script.string:
            if "__NEXT_DATA__" in script.string or "__INITIAL_STATE__" in script.string or "window.__PRELOADED_STATE__" in script.string:
                markdown_chunks.append("### SPA INITIAL STATE DATA")
                # Truncate if it's monstrously huge, but usually it's fine for our LLM to handle 
                markdown_chunks.append(f"```json\n{script.string[:50000].strip()}\n```")
                markdown_chunks.append("\n")
                
    # Bucket 4: Visible Body Text
    # Clean junk first to avoid massive token counts from tracking scripts
    for el in soup(["script", "style", "noscript", "svg", "img", "iframe", "meta", "nav", "footer"]):
        el.extract()
        
    body_text = soup.get_text(separator="\n", strip=True)
    if body_text:
        markdown_chunks.append("### VISIBLE PAGE TEXT")
        markdown_chunks.append(body_text)
        
    final_text = "\n".join(markdown_chunks)
    
    if len(final_text) > 50:
        print(f"[SUCCESS] Everything Bucket extracted {len(final_text)} characters.")
        return {"success": True, "markdown": final_text, "html": html, "url": url}
    else:
        return {"success": False, "markdown": "", "html": html, "reason": "No data extracted"}

if __name__ == "__main__":
    test_url = "https://diablotools.com/products/DCB518ASTS06G"
    result = asyncio.run(scrape_product_page(test_url))
    print(result.get("markdown", "")[:1000])
