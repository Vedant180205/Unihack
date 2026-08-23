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

import csv
from io import StringIO
from fastapi.responses import StreamingResponse

@router.get("/export/csv")
async def export_csv():
    # Dynamically build CSV from all extracted_output_*.json files
    json_files = sorted(OUTPUT_DIR.glob("extracted_output_*.json"))
    if not json_files:
        raise HTTPException(status_code=404, detail="No extracted JSON records found.")
        
    try:
        with open(json_files[0], "r", encoding="utf-8") as f:
            first_data = json.load(f)
            fieldnames = list(first_data.keys())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed reading records: {e}")

    def iter_csv():
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        for file_path in json_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    row_data = json.load(f)
                clean_row = {k: row_data.get(k, "") for k in fieldnames}
                writer.writerow(clean_row)
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
            except Exception:
                pass
                
    response = StreamingResponse(iter_csv(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=output.csv"
    return response

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
