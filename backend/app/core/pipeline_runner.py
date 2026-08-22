"""
pipeline_runner.py
------------------
Core pipeline orchestration logic — identical to pipeline_ved.py.
Zero logic changes. Only imports updated to point at app.services.*.
"""
import csv
import asyncio
import json
import uuid
import os
from pathlib import Path
from typing import Dict, Any, Optional

from app.services.search_engine import find_manufacturer_domain, search_exact_product
from app.services.scraper import scrape_product_page
from app.services.extractor import process_scraped_file, save_clean_csv
from app.services.preprocessor import preprocess_catalog_row
from app.services.exporter import (
    build_252_column_row,
    append_row_to_output_csv,
    sync_csv_to_excel,
)
from app.core.config import DEFAULT_INPUT_CSV, OUTPUT_CSV, OUTPUT_DIR

# ─── In-memory job registry ───────────────────────────────────────────────────
# { job_id: { "status": str, "processed": int, "total": int, "error": str } }
JOBS: Dict[str, Dict] = {}


def new_job() -> str:
    job_id = str(uuid.uuid4())[:8]
    JOBS[job_id] = {"status": "queued", "processed": 0, "total": 0, "error": None}
    return job_id


def get_job(job_id: str) -> Optional[Dict]:
    return JOBS.get(job_id)


# ─── Row Processor (exact copy from pipeline_ved.py) ──────────────────────────
async def process_row(row: dict, output_dir: Path = OUTPUT_DIR) -> dict:
    part_num = row.get("Mfg_Part_Num") or row.get("PART_NUMBER") or row.get("MANUFACTURER_PART_NUMBER")
    raw_mfg  = row.get("Part_Manuf")   or row.get("MANUFACTURER_NAME") or row.get("BRAND_NAME")
    manufacturer = raw_mfg.split("(")[0].strip() if raw_mfg else None

    if not part_num or not manufacturer:
        print(f"[ERROR] Missing Part Number or Manufacturer for row: {row}")
        return {}

    print(f"\n==========================================")
    print(f"Processing: {manufacturer} | {part_num}")
    print(f"==========================================")

    output_text  = f"--- INPUTS TAKEN FROM CSV ---\n"
    output_text += f"Manufacturer Name: {manufacturer}\n"
    output_text += f"Part Number / MPN: {part_num}\n"
    output_text += f"Raw Manufacturer String: {raw_mfg}\n\n"

    # 1. Domain Discovery
    domain = find_manufacturer_domain(manufacturer)
    if not domain:
        print("[FAIL] Could not discover domain.")
        return {}

    output_text += f"--- DOMAIN DISCOVERY ---\n"
    output_text += f"Discovered Official Domain: {domain}\n\n"

    # 2. Exact Product URL
    search_res = search_exact_product(part_num, manufacturer, domain)
    if not search_res.get("success"):
        print("[FAIL] Could not find exact product page.")
        return {}

    url = search_res.get("url")
    output_text += f"--- EXACT PRODUCT URL DISCOVERED ---\nURL: {url}\n\n"

    # 3. Scrape
    scrape_res = await scrape_product_page(url)
    if not scrape_res.get("success"):
        print("[FAIL] Could not scrape product page.")
        return {}

    markdown     = scrape_res.get("markdown", "")
    html_content = scrape_res.get("html", "")

    output_text += f"--- SCRAPED PAGE MARKDOWN ---\n{markdown}"

    safe_mpn         = part_num.replace("/", "_")
    out_txt          = output_dir / f"scraped_output_{safe_mpn}.txt"
    out_html         = output_dir / f"scraped_output_{safe_mpn}.html"
    out_provenance   = output_dir / f"extracted_output_{safe_mpn}.json"
    out_csv          = output_dir / f"extracted_output_{safe_mpn}_clean.csv"

    out_txt.write_text(output_text, encoding="utf-8")
    out_html.write_text(html_content, encoding="utf-8")

    print(f"\n--- Scrape Success! ---")
    print(f"Saved text report to {out_txt}")

    # 4. Groq Provenance Extraction
    print(f"\n--- Running Groq Provenance Extraction ---")
    try:
        result = process_scraped_file(str(out_txt))

        provenance_json = result.get("provenance", {})
        delivery_dict   = result.get("delivery", {})

        out_provenance.write_text(json.dumps(provenance_json, indent=2), encoding="utf-8")
        print(f"[+] Saved provenance JSON to {out_provenance}")

        save_clean_csv(delivery_dict, str(out_csv))

        print(f"[+] INVOICE_DESC : {delivery_dict.get('INVOICE_DESC')}")
        print(f"[+] MOBILE_DESC  : {delivery_dict.get('MOBILE_DESC')}")
        print(f"[+] Confidence   : {delivery_dict.get('confidence_score')}%")

        # Citation summary
        total_cited = 0
        for section_name, section_data in provenance_json.items():
            if not isinstance(section_data, dict):
                continue
            section_cited = {k: v for k, v in section_data.items() if isinstance(v, dict) and v.get("source")}
            if section_cited:
                print(f"  [{section_name.upper()}]")
                for field, entry in section_cited.items():
                    val_str = str(entry.get("value", ""))[:60]
                    safe_val = val_str.encode("ascii", "replace").decode("ascii")
                    print(f"    {field}: '{safe_val}' <- {entry.get('source','').upper()}")
                total_cited += len(section_cited)
        print(f"  Total verified fields: {total_cited}")

        return delivery_dict

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Extraction failed: {e}")
        return {}


# ─── Batch Runner ─────────────────────────────────────────────────────────────
async def run_pipeline(
    job_id: str,
    input_csv: str = None,
    limit: int = 1,
    skip: int = 0,
    output_dir: Path = OUTPUT_DIR,
):
    """Async batch runner. Updates JOBS registry as it processes rows."""
    csv_path = input_csv or str(DEFAULT_INPUT_CSV)
    JOBS[job_id]["status"] = "running"

    try:
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))

        target_rows = rows[skip: skip + limit]
        JOBS[job_id]["total"] = len(target_rows)

        for row in target_rows:
            await process_row(row, output_dir=output_dir)
            JOBS[job_id]["processed"] += 1

        JOBS[job_id]["status"] = "done"

    except FileNotFoundError:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = f"Input file not found: {csv_path}"
        print(f"[ERROR] Input file not found: {csv_path}")
    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)
        import traceback
        traceback.print_exc()
