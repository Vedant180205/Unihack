"""
routes/pipeline.py
POST /api/pipeline/run     - Launch a batch pipeline job (non-blocking)
GET  /api/pipeline/status/{job_id}  - Poll job progress
GET  /api/pipeline/jobs    - List all jobs
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.schemas.pipeline import PipelineRunRequest, JobStatusResponse
from app.core.pipeline_runner import run_pipeline, new_job, get_job, JOBS

router = APIRouter()

@router.post("/pipeline/run", response_model=JobStatusResponse)
async def start_pipeline(req: PipelineRunRequest, background_tasks: BackgroundTasks):
    job_id = new_job()
    background_tasks.add_task(
        run_pipeline,
        job_id=job_id,
        input_csv=req.input_path,
        limit=req.limit,
        skip=req.skip,
    )
    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        processed=0,
        total=req.limit,
    )

@router.get("/pipeline/status/{job_id}", response_model=JobStatusResponse)
async def pipeline_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return JobStatusResponse(job_id=job_id, **job)

@router.get("/pipeline/jobs")
async def list_jobs():
    return {"jobs": [{"job_id": k, **v} for k, v in JOBS.items()]}

import json
from pathlib import Path
from app.core.config import OUTPUT_DIR

@router.get("/pipeline/results")
async def pipeline_results():
    results = []
    if not OUTPUT_DIR.exists():
        return {"results": results}
        
    for file_path in OUTPUT_DIR.glob("extracted_output_*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            mpn = data.get("SKU - MY_PART_NUMBER") or data.get("PART_NUMBER") or file_path.stem.replace("extracted_output_", "")
            
            results.append({
                "mpn": mpn,
                "domain": data.get("MFR URL", ""),
                "domain_link": data.get("MFR URL", ""),
                "product_link": data.get("Ref URL 1") or data.get("MFR URL", ""),
                "product_name": data.get("SHORT_DESC") or data.get("Product Name") or "Unknown",
                "manufacturer": data.get("BRAND_NAME") or data.get("MANUFACTURER_NAME") or "Unknown"
            })
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            
    return {"results": results}

@router.get("/pipeline/results/{mpn}")
async def pipeline_result_detail(mpn: str):
    safe_mpn = mpn.replace("/", "_")
    file_path = OUTPUT_DIR / f"extracted_output_{safe_mpn}.json"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Details for {mpn} not found")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pipeline/confidence/{mpn}")
async def pipeline_confidence(mpn: str):
    safe_mpn = mpn.replace("/", "_")
    file_path = OUTPUT_DIR / f"confidence_map_{safe_mpn}.json"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Confidence map for {mpn} not found")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"confidence": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class UpdateFieldRequest(BaseModel):
    field: str
    value: str

@router.post("/pipeline/update/{mpn}")
async def pipeline_update_field(mpn: str, req: UpdateFieldRequest):
    safe_mpn = mpn.replace("/", "_")
    data_path = OUTPUT_DIR / f"extracted_output_{safe_mpn}.json"
    conf_path = OUTPUT_DIR / f"confidence_map_{safe_mpn}.json"
    
    if not data_path.exists():
        raise HTTPException(status_code=404, detail=f"Details for {mpn} not found")
        
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        data[req.field] = req.value
        
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
        # Update confidence map if exists
        if conf_path.exists():
            with open(conf_path, "r", encoding="utf-8") as f:
                conf_data = json.load(f)
            conf_data[req.field] = 99
            with open(conf_path, "w", encoding="utf-8") as f:
                json.dump(conf_data, f, indent=2)
                
        return {"success": True, "message": f"Updated {req.field} to {req.value}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
