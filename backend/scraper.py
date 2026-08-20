import asyncio
import io
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError
import pypdf
try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    cffi_requests = None

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts text lines from PDF bytes."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for i, page in enumerate(reader.pages[:5]):
            text = page.extract_text()
            if text:
                pages_text.append(f"--- PDF Page {i+1} ---\n{text}")
        return "\n\n".join(pages_text)
    except Exception:
        return ""

async def scrape_product_page(url: str) -> dict:
    """
    Ingests official product specification data from:
    1. Direct PDF Spec Sheet / Brochure
    2. TLS-Impersonated HTTP Engine (curl_cffi - bypasses Akamai/Cloudflare in 0.5s)
    3. Playwright Headless Browser fallback
    """
    if not url:
        return {"success": False, "markdown": "", "reason": "Empty URL"}
        
    print(f"[INFO] Ingesting source: {url} ...")
    
    # 1. Handle PDF Documents
    if url.lower().endswith(".pdf") or "multimedia." in url.lower() or "/pdf/" in url.lower():
        try:
            resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}, timeout=8)
            if resp.status_code == 200 and len(resp.content) > 500:
                pdf_text = extract_text_from_pdf_bytes(resp.content)
                if len(pdf_text) > 50:
                    markdown = f"### TECHNICAL PDF DOCUMENTATION\n**Source URL**: {url}\n\n{pdf_text}"
                    print(f"[SUCCESS] Extracted {len(markdown)} characters from PDF spec sheet.")
                    return {"success": True, "markdown": markdown, "html": "", "url": url}
        except Exception:
            pass
            
    # 2. Primary Web Engine: TLS-Impersonated HTTP Engine (bypasses 3M/Akamai)
    html = ""
    if cffi_requests:
        try:
            resp = cffi_requests.get(url, impersonate="chrome120", timeout=8)
            if resp.status_code == 200 and len(resp.text) > 300:
                html = resp.text
        except Exception as e:
            print(f"[WARN] curl_cffi fetch error: {e}")
            
    # 3. Fallback: Playwright Headless Browser
    if not html or len(html) < 300:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True, args=["--disable-http2", "--no-sandbox"])
                context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                page = await context.new_page()
                await page.goto(url, wait_until="domcontentloaded", timeout=10000)
                await page.wait_for_timeout(1500)
                html = await page.content()
                await browser.close()
        except Exception:
            pass
            
    if not html:
        return {"success": False, "markdown": "", "html": "", "reason": "No content retrieved"}
        
    soup = BeautifulSoup(html, "html.parser")
    markdown_chunks = []
    
    # Meta Tags
    title = soup.title.string if soup.title else ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    meta_desc_text = meta_desc["content"] if meta_desc and meta_desc.has_attr("content") else ""
    
    if title or meta_desc_text:
        markdown_chunks.append("### METADATA")
        if title: markdown_chunks.append(f"**Title**: {title.strip()}")
        if meta_desc_text: markdown_chunks.append(f"**Description**: {meta_desc_text.strip()}")
        markdown_chunks.append("\n")
        
    # Structured JSON-LD
    ld_jsons = soup.find_all("script", type="application/ld+json")
    for ld in ld_jsons:
        if ld.string:
            markdown_chunks.append(f"```json\n{ld.string.strip()}\n```\n")
            
    # Clean noise elements
    for el in soup(["script", "style", "noscript", "svg", "img", "iframe", "meta", "nav", "footer", "header"]):
        el.extract()
        
    body_text = soup.get_text(separator="\n", strip=True)
    if body_text:
        markdown_chunks.append("### VISIBLE PAGE TEXT")
        markdown_chunks.append(body_text[:10000])
        
    final_text = "\n".join(markdown_chunks)
    if len(final_text) > 40:
        print(f"[SUCCESS] Extracted {len(final_text)} characters.")
        return {"success": True, "markdown": final_text, "html": html, "url": url}
    else:
        return {"success": False, "markdown": "", "html": html, "reason": "Extracted text was too short"}

