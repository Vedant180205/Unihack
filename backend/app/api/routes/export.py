"""
routes/export.py
GET /api/export/csv   — Download final output.csv
GET /api/export/xlsx  — Download final output.xlsx
GET /api/records      — List all extracted JSON records for the dashboard
"""
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import OUTPUT_CSV, OUTPUT_XLSX, OUTPUT_DIR

router = APIRouter()

@router.get("/export/csv")
async def export_csv():
    if not OUTPUT_CSV.exists():
        raise HTTPException(status_code=404, detail="No output CSV found. Run the pipeline first.")
    return FileResponse(str(OUTPUT_CSV), media_type="text/csv", filename="output.csv")

@router.get("/export/xlsx")
async def export_xlsx():
    if not OUTPUT_XLSX.exists():
        raise HTTPException(status_code=404, detail="No output XLSX found. Run the pipeline first.")
    return FileResponse(str(OUTPUT_XLSX), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="output.xlsx")

@router.get("/records")
async def get_records():
    """Returns all extracted_output_*.json files as a JSON array for the dashboard."""
    json_files = sorted(OUTPUT_DIR.glob("extracted_output_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    records = []
    for f in json_files:
        try:
            mpn = f.stem.replace("extracted_output_", "")
            data = json.loads(f.read_text(encoding="utf-8"))
            records.append({"mpn": mpn, "data": data, "last_modified": f.stat().st_mtime})
        except Exception:
            continue
    return JSONResponse({"success": True, "count": len(records), "records": records})
