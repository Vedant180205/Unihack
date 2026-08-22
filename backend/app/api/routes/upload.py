"""
routes/upload.py
POST /api/upload  — Accept a CSV file from the frontend
"""
import csv
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from app.core.config import UPLOADS_DIR
from app.schemas.pipeline import UploadResponse

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    timestamp = int(time.time())
    dest = UPLOADS_DIR / f"input_{timestamp}_{file.filename}"

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    # Count rows
    with dest.open(encoding="utf-8-sig") as f:
        row_count = sum(1 for _ in csv.DictReader(f))

    return UploadResponse(
        filename=file.filename,
        saved_path=str(dest),
        row_count=row_count
    )

@router.get("/csv/preview")
async def csv_preview(path: str = None, page: int = 1, limit: int = 50):
    if not path or not Path(path).exists():
        # Fallback to default input
        from app.core.config import DEFAULT_INPUT_CSV
        path = str(DEFAULT_INPUT_CSV)
        if not Path(path).exists():
            raise HTTPException(status_code=404, detail="No CSV found to preview")

    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            # We can't jump directly in a CSV stream easily, so we iterate
            rows = []
            total_rows = 0
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            
            for i, row in enumerate(reader):
                total_rows += 1
                if start_idx <= i < end_idx:
                    rows.append(row)
                    
        return {
            "success": True,
            "page": page,
            "limit": limit,
            "total_rows": total_rows,
            "total_pages": (total_rows + limit - 1) // limit,
            "rows": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
