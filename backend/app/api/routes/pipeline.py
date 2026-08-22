"""
routes/pipeline.py
POST /api/pipeline/run     — Launch a batch pipeline job (non-blocking)
GET  /api/pipeline/status/{job_id}  — Poll job progress
GET  /api/pipeline/jobs    — List all jobs
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
