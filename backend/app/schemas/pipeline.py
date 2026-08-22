from pydantic import BaseModel
from typing import Optional, Literal

class PipelineRunRequest(BaseModel):
    input_path: Optional[str] = None   # Path to uploaded CSV; uses default if None
    limit: int = 1
    skip: int = 0

class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "done", "failed"]
    processed: int = 0
    total: int = 0
    error: Optional[str] = None

class UploadResponse(BaseModel):
    filename: str
    saved_path: str
    row_count: int
