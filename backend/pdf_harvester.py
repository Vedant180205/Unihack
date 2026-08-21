import asyncio
import io
import os
import re
import requests
from typing import Dict, List, Any
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# PDF text extraction
try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
    HAS_PDFMINER = True
except ImportError:
    HAS_PDFMINER = False

# Image extraction from PDFs
try:
    import fitz  # PyMuPDF
    from PIL import Image
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

# Table extraction from PDFs (requires Java)
try:
    import tabula
    import pandas as pd
    HAS_TABULA = True
except ImportError:
    HAS_TABULA = False

PDF_KEYWORDS = [
    "spec", "specification", "datasheet", "data sheet",
    "data-sheet", "technical", "brochure", "manual",
    "tds", "sds", "msds", "product guide", "catalog"
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def harvest_pdf_links(html_content: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html_content, "html.parser")
    found = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        link_text = a_tag.get_text(strip=True).lower()
        absolute_url = urljoin(base_url, href)
        is_pdf_url = absolute_url.lower().endswith(".pdf")
        is_spec_link = any(kw in link_text for kw in PDF_KEYWORDS)
        url_path = urlparse(absolute_url).path.lower()
        is_spec_url = any(kw in url_path for kw in PDF_KEYWORDS)
        if is_pdf_url or (is_spec_link and is_spec_url):
            if absolute_url not in found:
                found.append(absolute_url)
    return found[:5]

def extract_pdf_text(pdf_bytes: bytes) -> str:
    if HAS_PDFMINER:
        try:
            return pdfminer_extract_text(io.BytesIO(pdf_bytes)) or ""
        except Exception as e:
            print(f"[WARN] pdfminer extraction failed: {e}")
    try:
        raw = pdf_bytes.decode("latin-1", errors="ignore")
        lines = [l.strip() for l in raw.split("\n") if l.strip() and len(l.strip()) > 3]
        return "\n".join(lines[:200])
    except Exception:
        return ""

def extract_pdf_tables(pdf_bytes: bytes) -> List[str]:
    if not HAS_TABULA:
        return []
    try:
        tmp_path = os.path.join(os.path.dirname(__file__), "_tmp_pdf_table.pdf")
        with open(tmp_path, "wb") as f:
            f.write(pdf_bytes)
        dfs = tabula.read_pdf(tmp_path, pages="all", multiple_tables=True, silent=True)
        os.remove(tmp_path)
        tables_md = []
        for df in dfs:
            if df.empty:
                continue
            df = df.fillna("")
            try:
                tables_md.append(df.to_markdown(index=False))
            except Exception:
                tables_md.append(df.to_string(index=False))
        return tables_md
    except Exception as e:
        print(f"[WARN] tabula table extraction failed (Java missing?): {e}")
        return []

def extract_pdf_images(pdf_bytes: bytes, mpn: str, pdf_index: int) -> int:
    if not HAS_PYMUPDF:
        return 0
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        save_dir = os.path.join(os.path.dirname(__file__), "pdf_images", mpn)
        os.makedirs(save_dir, exist_ok=True)
        image_count = 0
        for page_num in range(len(doc)):
            for img in doc.get_page_images(page_num):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                if len(image_bytes) < 1024:
                    continue
                try:
                    pil_img = Image.open(io.BytesIO(image_bytes))
                    ext = base_image.get("ext", "png")
                    filename = f"pdf{pdf_index}_page{page_num + 1}_img{xref}.{ext}"
                    pil_img.save(os.path.join(save_dir, filename))
                    image_count += 1
                except Exception:
                    continue
        return image_count
    except Exception as e:
        print(f"[WARN] PyMuPDF image extraction failed: {e}")
        return 0

def _download_pdf(url: str) -> bytes:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 500:
            return resp.content
    except Exception as e:
        print(f"[WARN] PDF download failed for {url}: {e}")
    return b""

async def harvest_pdfs_from_page(
    html_content: str,
    base_url: str,
    mpn: str = ""
) -> Dict[str, Any]:
    result = {
        "pdf_links_found": [],
        "pdf_count": 0,
        "combined_text": "",
        "tables": [],
        "image_count": 0
    }

    pdf_links = harvest_pdf_links(html_content, base_url)
    if not pdf_links:
        return result

    result["pdf_links_found"] = pdf_links
    print(f"[INFO] PDF Harvester found {len(pdf_links)} linked PDF(s): {pdf_links}")

    all_texts = []
    all_tables = []
    total_images = 0

    for i, pdf_url in enumerate(pdf_links):
        print(f"[INFO] Downloading PDF {i+1}/{len(pdf_links)}: {pdf_url}")
        pdf_bytes = await asyncio.to_thread(_download_pdf, pdf_url)
        if not pdf_bytes:
            continue

        pdf_filename = pdf_url.split("/")[-1]

        text = await asyncio.to_thread(extract_pdf_text, pdf_bytes)
        if text.strip():
            all_texts.append(f"--- PDF {i+1}: {pdf_filename} ---\n{text.strip()}")
            print(f"[SUCCESS] Extracted {len(text)} chars from {pdf_filename}")

        tables = await asyncio.to_thread(extract_pdf_tables, pdf_bytes)
        if tables:
            all_tables.extend(tables)
            print(f"[INFO] Extracted {len(tables)} table(s) from {pdf_filename}")

        img_count = await asyncio.to_thread(extract_pdf_images, pdf_bytes, mpn, i + 1)
        total_images += img_count
        if img_count:
            print(f"[INFO] Extracted {img_count} image(s) from {pdf_filename}")

    result["pdf_count"] = len(pdf_links)
    result["combined_text"] = "\n\n".join(all_texts)
    result["tables"] = all_tables
    result["image_count"] = total_images

    return result
