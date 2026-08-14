from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import pandas as pd
import duckdb
import io

from models import InputRow, DeliveryFormatRow

app = FastAPI(title="UniHack Data Intelligence Pipeline")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DuckDB connection (in-memory for now)
db = duckdb.connect(':memory:')

@app.on_event("startup")
async def startup_event():
    # Placeholder for loading reference data into DuckDB
    # e.g., db.execute("CREATE TABLE brands AS SELECT * FROM read_csv_auto('path')")
    pass

@app.get("/")
def read_root():
    return {"message": "UniHack Pipeline API is running."}

@app.post("/api/process")
async def process_batch(file: UploadFile = File(...)):
    """
    Endpoint to ingest a CSV/Excel file, run the deterministic and AI pipeline,
    and return the processed results.
    """
    content = await file.read()
    # Basic reading for now
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content))
    
    # TODO: Pass dataframe through pipeline (Splink -> Outlines -> Confidence Check)
    
    return {"status": "success", "rows_received": len(df)}
