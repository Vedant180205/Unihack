import asyncio
import io
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError
import pypdf
from app.services.pdf_harvester import harvest_pdfs_from_page

try:
    from curl_cffi import requests as cffi_requests
    print("[INFO] curl_cffi imported successfully in scraper.py")
except ImportError as e:
    cffi_requests = None
    print(f"[ERROR] Failed to import curl_cffi: {e}")

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

async def scrape_product_page(url: str, mpn: str = '') -> dict:
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
        except NotImplementedError:
            print("[WARN] Playwright NotImplementedError caught.")
        except Exception as e:
            print(f"[WARN] Playwright error: {e}")
            
    # 2. Primary Web Engine: TLS-Impersonated HTTP Engine (bypasses 3M/Akamai)
    html = ""
    if cffi_requests:
        try:
            resp = cffi_requests.get(url, impersonate="chrome120", timeout=8)
            print(f"[INFO] curl_cffi response: {resp.status_code}, length: {len(resp.text)}")
            if resp.status_code == 200 and len(resp.text) > 300:
                html = resp.text
        except Exception as e:
            print(f"[WARN] curl_cffi fetch error: {e}")
    else:
        print("[WARN] cffi_requests is None (not imported)!")
            
    # 3. Fallback: Standard Requests
    if not html or len(html) < 300:
        print("[INFO] Attempting Standard Requests fallback...")
        try:
            resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}, timeout=10)
            if resp.status_code == 200 and len(resp.text) > 300:
                html = resp.text
            else:
                print(f"[WARN] Standard Requests failed. Status: {resp.status_code}")
        except Exception as e:
            print(f"[WARN] Standard Requests error: {e}")
            
    if not html:
        return {"success": False, "markdown": "", "html": "", "reason": "No content retrieved"}
        
    soup = BeautifulSoup(html, "html.parser")
    markdown_chunks = []
    
    # NEW: Run advanced PDF harvester
    pdf_results = await harvest_pdfs_from_page(html, url, mpn)
    if pdf_results.get("combined_text"):
        markdown_chunks.append("### SUPPLEMENTAL PDF SPECIFICATIONS")
        markdown_chunks.append(pdf_results["combined_text"])
        markdown_chunks.append("\n")
    if pdf_results.get("tables"):
        markdown_chunks.append("### EXTRACTED PDF TABLES")
        for table in pdf_results["tables"]:
            markdown_chunks.append(table)
            markdown_chunks.append("\n")

    
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




