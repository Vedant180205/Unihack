import re
import csv
from typing import Dict, Any, List, Optional

PLACEHOLDERS = {
    "-- unbranded --",
    "-- no unilog brand --",
    "-- no dib brand --",
    "unbranded",
    "none",
    "null",
    ""
}

KNOWN_BRANDS = [
    "3M", "Diablo", "Freud", "Milwaukee", "Mirka", "Frigidaire", "Whirlpool",
    "GE", "General Electric", "DeWalt", "Bosch", "Makita", "Delta", "Moen", 
    "Kohler", "Rheem", "Klein Tools", "Fluke", "Square D", "Schneider Electric"
]

def clean_brand_field(raw_val: Optional[str]) -> Optional[str]:
    """Cleans brand strings by stripping whitespace and removing placeholders."""
    if not raw_val:
        return None
    val = raw_val.strip()
    if val.lower() in PLACEHOLDERS:
        return None
    return val

def clean_manufacturer_name(raw_mfr: Optional[str]) -> Optional[str]:
    """
    Cleans distributor and manufacturer strings by removing ERP/account codes 
    e.g. 'Freud Inc (2435)' -> 'Freud Inc', 'Jam Industrial Supply LLC (JAMIN)' -> 'Jam Industrial Supply LLC'
    """
    if not raw_mfr:
        return None
    cleaned = clean_brand_field(raw_mfr)
    if not cleaned:
        return None
    cleaned = re.sub(r'\s*\([A-Z0-9_-]+\)\s*$', '', cleaned).strip()
    return cleaned

def clean_mfg_part_num(raw_mpn: str) -> str:
    """
    Strips vendor/distributor prefixes from raw MPNs.
    e.g. '3MABR-7100075678' -> '7100075678'
    """
    if not raw_mpn:
        return ""
    mpn = raw_mpn.strip()
    if "-" in mpn and not mpn.startswith("49-") and not mpn.startswith("9A-") and not mpn.startswith("5B-"):
        parts = mpn.split("-", 1)
        if len(parts) == 2 and len(parts[0]) <= 6:
            mpn = parts[1]
    return mpn or raw_mpn.strip()

def extract_brand_from_desc(part_desc: str) -> Optional[str]:
    """Extracts known brand names embedded in the part description."""
    if not part_desc:
        return None
    for brand in KNOWN_BRANDS:
        pattern = rf'\b{re.escape(brand)}\b'
        if re.search(pattern, part_desc, re.IGNORECASE):
            return brand
    return None

def infer_category_classpath(part_desc: str, mfg_part_num: str) -> str:
    """Dynamically infers taxonomy classpath based on description keywords."""
    if not part_desc:
        return "Industrial MRO > Tools & Hardware > General Catalog"
    desc_lower = part_desc.lower()
    
    if any(w in desc_lower for w in ["sanding belt", "sanding disc", "cut-off", "cut off", "disc", "film", "cubitron", "abranet", "hiolit", "abrasive", "grinding", "wheel"]):
        return "Hardware & Tools > Abrasives & Cutting Tools > Sanding Discs & Belts"
    elif any(w in desc_lower for w in ["dishwasher", "dish washer"]):
        return "Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers"
    elif any(w in desc_lower for w in ["refrigerator", "fridge", "freezer"]):
        return "Appliances & Consumer Electronics > Kitchen Appliances > Refrigerators"
    elif any(w in desc_lower for w in ["bolt", "screw", "nut", "washer", "anchor", "fastener"]):
        return "Fasteners & Hardware > Industrial Fasteners > Bolts & Screws"
    elif any(w in desc_lower for w in ["gauge", "pressure gauge", "sensor", "meter"]):
        return "Instrumentation & Measurement > Pressure & Flow > Pressure Gauges"
    elif any(w in desc_lower for w in ["gland", "cable", "wire", "connector", "stripper"]):
        return "Electrical > Cable Management > Cable Glands"
    elif any(w in desc_lower for w in ["glove", "goggles", "safety", "respirator", "ppe"]):
        return "Safety & Personal Protection > Hand Protection > Work Gloves"
        
    return "Industrial MRO > Tools & Hardware > General Catalog"

def preprocess_catalog_row(row: Dict[str, str]) -> Dict[str, Any]:
    """
    Takes a raw row from Input.csv and produces a clean, enriched search query structure.
    """
    raw_mpn = row.get("Mfg_Part_Num", "").strip()
    part_desc = row.get("Part_Desc", "").strip()
    
    # 1. Clean brand - check description FIRST for primary brand cues
    desc_brand = extract_brand_from_desc(part_desc)
    e1_brand = clean_brand_field(row.get("E1_Brand"))
    unilog_brand = clean_brand_field(row.get("Unilog_Brand"))
    dib_brand = clean_brand_field(row.get("DIB_Brand"))
    raw_mfr = row.get("Part_Manuf", "")
    mfr = clean_manufacturer_name(raw_mfr)
    
    brand = desc_brand or e1_brand or unilog_brand or dib_brand or mfr or "Generic"
    clean_mpn = clean_mfg_part_num(raw_mpn)
    classpath = row.get("Classpath") or infer_category_classpath(part_desc, clean_mpn)
    
    return {
        "mfg_part_num": clean_mpn,
        "raw_mfg_part_num": raw_mpn,
        "part_desc": part_desc,
        "clean_brand": brand,
        "clean_manufacturer": mfr or brand,
        "raw_manufacturer": raw_mfr,
        "classpath": classpath,
        "sku": row.get("SKU - MY_PART_NUMBER") or row.get("PART_NUMBER") or raw_mpn
    }

def load_sample_input_rows(csv_path: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Loads and preprocesses sample input rows from Input.csv."""
    items = []
    with open(csv_path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            items.append(preprocess_catalog_row(row))
    return items
