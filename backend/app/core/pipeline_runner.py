"""
pipeline_runner.py
------------------
Core pipeline orchestration logic.
Wired to SearXNG and the Robust Web Crawler engine.
"""
import csv
import asyncio
import json
import uuid
import os
from pathlib import Path
from typing import Dict, Any, Optional

from app.services.search_engine import find_manufacturer_domain, search_exact_product
from app.core.config import DEFAULT_INPUT_CSV, OUTPUT_CSV, OUTPUT_DIR

# 1 In-memory job registry 1
# { job_id: { "status": str, "processed": int, "total": int, "error": str } }
JOBS: Dict[str, Dict] = {}


def new_job() -> str:
    job_id = str(uuid.uuid4())[:8]
    JOBS[job_id] = {"status": "queued", "processed": 0, "total": 0, "error": None}
    return job_id


def get_job(job_id: str) -> Optional[Dict]:
    return JOBS.get(job_id)


# 1 Row Processor 1
async def process_row(row: dict, output_dir: Path = OUTPUT_DIR) -> dict:
    print(f"--- Starting process_row ---")
    print(f"Row input: {row}")
    part_num = row.get("Mfg_Part_Num") or row.get("PART_NUMBER") or row.get("MANUFACTURER_PART_NUMBER")
    raw_mfg  = row.get("Part_Manuf")   or row.get("MANUFACTURER_NAME") or row.get("BRAND_NAME")
    manufacturer = raw_mfg.split("(")[0].strip() if raw_mfg else None
    
    print(f"Extracted basic info - part_num: {part_num}, manufacturer: {manufacturer}")

    if not part_num or not manufacturer:
        print(f"[ERROR] Missing Part Number or Manufacturer for row: {row}")
        return {}

    print(f"\n==========================================")
    print(f"Processing: {manufacturer} | {part_num}")
    print(f"==========================================")

    # 1. Domain Discovery
    domain = find_manufacturer_domain(manufacturer)
    if not domain:
        print("[FAIL] Could not discover domain.")
        return {}

    print(f"Discovered Official Domain: {domain}")

    # 2. Exact Product URL
    search_res = search_exact_product(part_num, manufacturer, domain)
    if not search_res.get("success"):
        print("[FAIL] Could not find exact product page.")
        return {}

    url = search_res.get("url")
    print(f"Exact Product URL Discovered: {url}")

    # 3. Direct AI Extraction and Mapping
    print(f"\n--- Running AI Extraction ---")
    try:
        from app.services.extractor import extract_with_groq, map_to_252_columns
        
        def _run_extraction(target_url):
            return extract_with_groq(target_url, pdf_text="")

        print(f"[*] Extracting raw data from: {url}")
        groq_json = await asyncio.to_thread(_run_extraction, url)
        
        print(f"[*] Mapping data to 252-column template")
        mapped_dict, conf_map = map_to_252_columns(groq_json, raw_txt=f"Manufacturer Name: {manufacturer}\nURL: {domain}", mpn=part_num)
        
        # Inject URLs
        mapped_dict["MFR URL"] = domain
        mapped_dict["Ref URL 1"] = url
        conf_map["MFR URL"] = 100 if domain else 0
        conf_map["Ref URL 1"] = 100 if url else 0
        
        safe_mpn = part_num.replace("/", "_")
        raw_json_path = output_dir / f"raw_output_{safe_mpn}.json"
        mapped_json_path = output_dir / f"extracted_output_{safe_mpn}.json"
        conf_json_path = output_dir / f"confidence_map_{safe_mpn}.json"
        
        # 1. Save the complete raw info (provenance)
        raw_json_path.write_text(json.dumps(groq_json, indent=2), encoding="utf-8")
        print(f"[+] Saved raw JSON info to {raw_json_path}")

        # 2. Save the mapped 252-column JSON (delivery)
        mapped_json_path.write_text(json.dumps(mapped_dict, indent=2), encoding="utf-8")
        print(f"[+] Saved 252-column template JSON to {mapped_json_path}")
        
        # 3. Save the confidence map
        conf_json_path.write_text(json.dumps(conf_map, indent=2), encoding="utf-8")
        print(f"[+] Saved confidence map JSON to {conf_json_path}")
        
        return mapped_dict
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Extraction failed: {e}")
        return {}


# 1 Batch Runner 1
import shutil

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
    
    # Clear previous output files
    try:
        if output_dir.exists():
            for item in output_dir.iterdir():
                if item.is_file():
                    item.unlink()
    except Exception as e:
        print(f"Error clearing output dir: {e}")

    try:
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))

        target_rows = rows[skip: skip + limit]
        JOBS[job_id]["total"] = len(target_rows)

        print(f"Starting to process {len(target_rows)} rows...")
        for i, row in enumerate(target_rows):
            print(f"Processing row {i+1}/{len(target_rows)}")
            try:
                await process_row(row, output_dir=output_dir)
            except Exception as e:
                import traceback
                print(f"FATAL ERROR processing row {i+1}: {e}")
                traceback.print_exc()
            JOBS[job_id]["processed"] += 1

        JOBS[job_id]["status"] = "done"
        print(f"Pipeline job {job_id} done.")

    except FileNotFoundError:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = f"Input file not found: {csv_path}"
        print(f"[ERROR] Input file not found: {csv_path}")
    except Exception as e:
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)
        import traceback
        traceback.print_exc()
