from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SinglePartRequest(BaseModel):
    Mfg_Part_Num: str = Field(..., description="Manufacturer Part Number (SKU)")
    Part_Desc: str = Field(..., description="Part description or raw specification string")
    Part_Manuf: Optional[str] = Field("", description="Part Manufacturer / Brand name")

class ApproveRequest(BaseModel):
    sku: str
    invoice_desc: Optional[str] = None
    mobile_desc: Optional[str] = None
    category: Optional[str] = None
    status: str = "Approved"

class RecordUpdateDTO(BaseModel):
    sku: str
    name: Optional[str] = None
    category: Optional[str] = None
    invoice: Optional[str] = None
    mobile: Optional[str] = None
    brand: Optional[str] = None
    status: Optional[str] = None
    confidence: Optional[float] = None

class PipelineRecord(BaseModel):
    sku: str
    name: str
    category: str
    confidence: float
    invoice: str
    mobile: str
    brand: Optional[str] = ""
    mfr_url: Optional[str] = ""
    image: Optional[str] = ""
    status: str
    doc_links: Optional[Dict[str, str]] = {}
    attributes: Optional[List[Dict[str, str]]] = []
    raw: Optional[Dict[str, Any]] = None

class PipelineStatusResponse(BaseModel):
    is_running: bool
    total_rows: int
    processed_rows: int
    current_part: Optional[str] = None
    last_error: Optional[str] = None

class HealthStatus(BaseModel):
    status: str
    searxng: bool
    ollama: bool
    output_file_exists: bool
    total_records: int

