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
