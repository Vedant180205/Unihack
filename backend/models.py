from pydantic import BaseModel, Field
from typing import Optional

class InputRow(BaseModel):
    Mfg_Part_Num: Optional[str] = Field(None, description="Manufacturer Part Number")
    Part_Desc: Optional[str] = Field(None, description="Raw Part Description")
    E1_Brand: Optional[str] = Field(None, description="E1 Brand string")
    Unilog_Brand: Optional[str] = Field(None, description="Unilog Brand string")
    DIB_Brand: Optional[str] = Field(None, description="DIB Brand string")
    Part_Manuf: Optional[str] = Field(None, description="Part Manufacturer string")

class DeliveryFormatRow(BaseModel):
    # This will be expanded later to include all 252 columns, 
    # but we'll start with the core fields.
    Department: Optional[str] = None
    Class: Optional[str] = None
    Fine: Optional[str] = None
    SKU: Optional[str] = None
    Manufacturer_Name: Optional[str] = None
    Brand_Name: Optional[str] = None
    Invoice_Desc: Optional[str] = Field(None, max_length=40)
    Mobile_Desc: Optional[str] = Field(None, max_length=80)
    Product_Title: Optional[str] = None
    Long_Description: Optional[str] = None
    Confidence_Score: float = Field(0.0, description="Overall confidence of the AI extraction")
