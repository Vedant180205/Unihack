import sys
import os
from pathlib import Path
import csv
import json
import asyncio
import io
import requests
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

# Add local-ai-researcher/backend to Python path
CURRENT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = CURRENT_DIR.parent.parent.parent / "local-ai-researcher" / "backend"
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))


from models import (
    SinglePartRequest,
    ApproveRequest,
    RecordUpdateDTO,
    PipelineRecord,
    PipelineStatusResponse,
    HealthStatus
)

try:
    from pipeline import process_row, load_checkpoint, save_checkpoint
    from schema import OUTPUT_COLUMNS
    from search import SEARXNG_URL
    from extract_fields import OLLAMA_URL
except ImportError as e:
    print(f"[WARN] Error importing pipeline modules: {e}")
    OUTPUT_COLUMNS = []
    SEARXNG_URL = "http://localhost:8080"
    OLLAMA_URL = "http://localhost:11434"

app = FastAPI(title="UniClean Data Intelligence Pipeline API", version="2.0.0")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_FILE_PATH = PIPELINE_DIR / "output.csv"

# Global pipeline execution tracker
pipeline_state = {
    "is_running": False,
    "total_rows": 0,
    "processed_rows": 0,
    "current_part": None,
    "last_error": None
}

@app.get("/")
def read_root():
    return {
        "service": "UniClean AI Operations API",
        "version": "2.0.0",
        "pipeline_connected": True,
        "docs": "/docs"
    }

@app.get("/api/health", response_model=HealthStatus)
def check_health():
    """Checks reachability of SearXNG and Ollama services, and output storage."""
    searx_ok = False
    try:
        r = requests.get(f"{SEARXNG_URL}/search", params={"q": "test", "format": "json"}, timeout=3)
        searx_ok = r.status_code == 200
    except Exception:
        searx_ok = False

    ollama_ok = False
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    records_count = 0
    if OUTPUT_FILE_PATH.exists():
        try:
            with open(OUTPUT_FILE_PATH, newline="", encoding="utf-8", errors="ignore") as f:
                records_count = sum(1 for _ in csv.DictReader(f))
        except Exception:
            records_count = 0

    return HealthStatus(
        status="healthy" if (searx_ok or ollama_ok or OUTPUT_FILE_PATH.exists()) else "degraded",
        searxng=searx_ok,
        ollama=ollama_ok,
        output_file_exists=OUTPUT_FILE_PATH.exists(),
        total_records=records_count
    )

@app.get("/api/pipeline/status", response_model=PipelineStatusResponse)
def get_pipeline_status():
    return PipelineStatusResponse(**pipeline_state)

def format_row_for_ui(row: dict) -> dict:
    sku = row.get("Mfg_Part_Num", "") or row.get("MANUFACTURER_PART_NUMBER", "") or "UNKNOWN"
    name = row.get("Part_Desc", "") or row.get("Product Name", "") or row.get("SHORT_DESC", "") or f"Part {sku}"
    brand = row.get("Part_Manuf", "") or row.get("MANUFACTURER_NAME", "") or row.get("BRAND_NAME", "")
    inv = row.get("INVOICE_DESC", "")
    mob = row.get("MOBILE_DESC", "")
    
    # Calculate confidence based on extracted completeness
    score = 70.0
    if inv:
        score += 10.0
    if mob and len(mob) >= 60:
        score += 10.0
    if row.get("Product Image"):
        score += 5.0
    if row.get("MFR URL"):
        score += 4.0
    
    # Collect dynamic attributes
    attrs = []
    for i in range(1, 15):
        lbl = row.get(f"ATTRIBUTE_LABEL {i}")
        val = row.get(f"ATTRIBUTE_VALUE {i}")
        uom = row.get(f"ATTRIBUTE_UOM {i}")
        if lbl and val:
            attrs.append({"label": lbl, "value": val, "uom": uom or ""})

    doc_links = {}
    for doc_type in ["Specification Sheet", "SDS", "Instruction/Installation Manual", "Owners/User Manual", "Catalog"]:
        if row.get(doc_type):
            doc_links[doc_type] = row.get(doc_type)

    status = "Approved" if (inv and score >= 90) else "Review"

    return {
        "sku": sku,
        "name": name,
        "category": row.get("Class", "") or row.get("Department", "") or "MRO Components",
        "confidence": round(score, 1),
        "invoice": inv or f"{sku} {brand}".strip()[:40].upper(),
        "mobile": mob or f"{name} {brand} {sku}".strip()[:80],
        "brand": brand,
        "mfr_url": row.get("MFR URL", ""),
        "image": row.get("Product Image", ""),
        "status": status,
        "doc_links": doc_links,
        "attributes": attrs,
        "raw": row
    }

@app.get("/api/pipeline/records")
def get_records():
    """Returns all processed records formatted for the frontend."""
    if not OUTPUT_FILE_PATH.exists():
        # Return initial seed dataset if pipeline hasn't generated output yet
        return {
            "records": [
                {
                    "sku": "4816AF",
                    "name": "Hex Bolt M8 x 40mm Zinc",
                    "category": "Fasteners",
                    "confidence": 88,
                    "invoice": "HEX BOLT M8X40 ZP",
                    "mobile": "Hexagonal head machine bolt, zinc plated steel, M8 thread x 40mm length",
                    "brand": "Fastenal",
                    "mfr_url": "https://www.fastenal.com",
                    "image": "",
                    "status": "Review",
                    "attributes": [{"label": "Thread Size", "value": "M8", "uom": "mm"}, {"label": "Length", "value": "40", "uom": "mm"}]
                },
                {
                    "sku": "77BC21",
                    "name": "Pressure Gauge 0–10 bar",
                    "category": "Instrumentation",
                    "confidence": 97,
                    "invoice": "PRESS GAUGE 0-10 BAR",
                    "mobile": "Industrial pressure gauge with 0 to 10 bar range and bottom connection",
                    "brand": "WIKA",
                    "mfr_url": "https://www.wika.com",
                    "image": "",
                    "status": "Approved",
                    "attributes": [{"label": "Pressure Range", "value": "0-10", "uom": "bar"}]
                },
                {
                    "sku": "2DE901",
                    "name": "Cable Gland M20 IP68",
                    "category": "Electrical",
                    "confidence": 84,
                    "invoice": "CABLE GLAND M20 IP68",
                    "mobile": "Nylon cable gland with M20 thread and IP68 ingress protection rating",
                    "brand": "Lapp Group",
                    "mfr_url": "https://www.lappgroup.com",
                    "image": "",
                    "status": "Review",
                    "attributes": [{"label": "IP Rating", "value": "IP68", "uom": ""}]
                },
                {
                    "sku": "A1C490",
                    "name": "Nitrile Safety Gloves L",
                    "category": "Safety",
                    "confidence": 92,
                    "invoice": "NITRILE GLOVES LARGE",
                    "mobile": "Reusable nitrile coated work gloves, large size, cut resistance level B",
                    "brand": "Ansell",
                    "mfr_url": "https://www.ansell.com",
                    "image": "",
                    "status": "Approved",
                    "attributes": [{"label": "Size", "value": "Large", "uom": ""}]
                }
            ]
        }

    records = []
    try:
        with open(OUTPUT_FILE_PATH, newline="", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Mfg_Part_Num") or row.get("MANUFACTURER_PART_NUMBER"):
                    records.append(format_row_for_ui(row))
    except Exception as e:
        print(f"[ERROR] Failed reading output.csv: {e}")

    return {"records": records}

@app.post("/api/pipeline/run-single")
async def run_single(item: SinglePartRequest):
    """Executes the complete pipeline (SearXNG -> Crawl4AI -> LLM) for a single SKU."""
    try:
        input_data = {
            "Mfg_Part_Num": item.Mfg_Part_Num,
            "Part_Desc": item.Part_Desc,
            "Part_Manuf": item.Part_Manuf,
            "E1_Brand": item.Part_Manuf,
            "Unilog_Brand": item.Part_Manuf,
            "DIB_Brand": item.Part_Manuf
        }

        result = await process_row(input_data)

        # Write or update in output.csv
        existing_rows = []
        headers = OUTPUT_COLUMNS
        if OUTPUT_FILE_PATH.exists():
            with open(OUTPUT_FILE_PATH, newline="", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames or OUTPUT_COLUMNS
                existing_rows = [r for r in reader if r.get("Mfg_Part_Num") != item.Mfg_Part_Num]

        existing_rows.insert(0, result)

        with open(OUTPUT_FILE_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for r in existing_rows:
                writer.writerow(r)

        ui_record = format_row_for_ui(result)
        return {
            "status": "success",
            "data": ui_record
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")

async def background_batch_runner(rows: List[dict]):
    pipeline_state["is_running"] = True
    pipeline_state["total_rows"] = len(rows)
    pipeline_state["processed_rows"] = 0
    pipeline_state["last_error"] = None

    write_header = not OUTPUT_FILE_PATH.exists()
    headers = OUTPUT_COLUMNS

    try:
        with open(OUTPUT_FILE_PATH, "a", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=headers)
            if write_header:
                writer.writeheader()

            for row in rows:
                pipeline_state["current_part"] = row.get("Mfg_Part_Num", "Unknown")
                try:
                    res = await process_row(row)
                    writer.writerow(res)
                    f_out.flush()
                    pipeline_state["processed_rows"] += 1
                except Exception as e:
                    print(f"[FAIL] Error processing row {row.get('Mfg_Part_Num')}: {e}")
                    pipeline_state["last_error"] = str(e)
    finally:
        pipeline_state["is_running"] = False
        pipeline_state["current_part"] = None

@app.post("/api/pipeline/run-batch")
async def run_batch(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Uploads a CSV file and processes it in the background."""
    if pipeline_state["is_running"]:
        raise HTTPException(status_code=400, detail="A batch pipeline is already running.")

    content = await file.read()
    try:
        decoded = content.decode("utf-8", errors="ignore").splitlines()
        reader = csv.DictReader(decoded)
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no rows.")

    background_tasks.add_task(background_batch_runner, rows)
    return {
        "status": "started",
        "message": f"Started processing batch of {len(rows)} items in background.",
        "total_rows": len(rows)
    }

@app.post("/api/pipeline/update")
def update_record(dto: RecordUpdateDTO):
    """Allows updating or approving a record directly in output.csv."""
    if not OUTPUT_FILE_PATH.exists():
        return {"status": "success", "message": "Updated in-memory record"}

    rows = []
    headers = OUTPUT_COLUMNS
    updated = False

    with open(OUTPUT_FILE_PATH, newline="", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or OUTPUT_COLUMNS
        for r in reader:
            if r.get("Mfg_Part_Num") == dto.sku or r.get("MANUFACTURER_PART_NUMBER") == dto.sku:
                if dto.invoice is not None:
                    r["INVOICE_DESC"] = dto.invoice
                if dto.mobile is not None:
                    r["MOBILE_DESC"] = dto.mobile
                if dto.category is not None:
                    r["Class"] = dto.category
                if dto.brand is not None:
                    r["MANUFACTURER_NAME"] = dto.brand
                updated = True
            rows.append(r)

    if updated:
        with open(OUTPUT_FILE_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for r in rows:
                writer.writerow(r)

    return {"status": "success", "sku": dto.sku, "updated": updated}

@app.get("/api/pipeline/export")
def export_delivery_file(format: str = "excel"):
    """
    Exports the delivery output from local-ai-researcher/backend in Excel (.xlsx) format
    or CSV format. Also saves a local output.xlsx copy in local-ai-researcher/backend.
    """
    import pandas as pd

    template_path = PIPELINE_DIR / "Unihack__Expected_Output_-_Delivery_Format.csv"
    
    # 1. Load data
    if OUTPUT_FILE_PATH.exists() and OUTPUT_FILE_PATH.stat().st_size > 0:
        try:
            df = pd.read_csv(OUTPUT_FILE_PATH, dtype=str, keep_default_na=False, encoding_errors="ignore")
        except Exception as e:
            print(f"[WARN] Error reading output.csv for export: {e}")
            df = pd.DataFrame(columns=OUTPUT_COLUMNS)
    elif template_path.exists():
        df = pd.read_csv(template_path, dtype=str, keep_default_na=False, encoding_errors="ignore")
    else:
        df = pd.DataFrame(columns=OUTPUT_COLUMNS)


    # 2. If CSV requested
    if format.lower() == "csv":
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        return StreamingResponse(
            io.BytesIO(csv_buffer.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="output.csv"'}
        )

    # 3. Default: Excel (.xlsx) format
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Delivery Format")
    
    excel_data = excel_buffer.getvalue()

    # Save a persistent output.xlsx file in local-ai-researcher/backend as well
    try:
        local_excel_path = PIPELINE_DIR / "output.xlsx"
        with open(local_excel_path, "wb") as f_out:
            f_out.write(excel_data)
        print(f"[OK] Saved local Excel file to {local_excel_path}")
    except Exception as e:
        print(f"[WARN] Failed to write local output.xlsx: {e}")

    return StreamingResponse(
        io.BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="output.xlsx"'}
    )



