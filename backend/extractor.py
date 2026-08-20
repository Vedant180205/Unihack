import os
import re
import json
from fractions import Fraction
from typing import Dict, Any, List, Optional, Tuple
import jellyfish
from llama_cpp import Llama

# ---------------------------------------------------------
# Load Local GGUF NuExtract-tiny Model via llama.cpp
# ---------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "NuExtract-1.5-tiny.Q4_K_M.gguf")

_llm_instance = None

def get_llm_instance() -> Llama:
    global _llm_instance
    if _llm_instance is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"GGUF model not found at {MODEL_PATH}")
        print(f"[*] Initializing local Llama.cpp engine with GGUF: {os.path.basename(MODEL_PATH)}")
        _llm_instance = Llama(
            model_path=MODEL_PATH,
            n_ctx=2048,
            n_threads=4,
            verbose=False
        )
    return _llm_instance

# ---------------------------------------------------------
# UOM & Trade Fraction Normalization Utilities
# ---------------------------------------------------------
UOM_CANONICAL_MAP = {
    "inch": "in", "inches": "in", "in.": "in", "\"": "in",
    "foot": "ft", "feet": "ft", "ft.": "ft", "'": "ft",
    "millimeter": "mm", "millimeters": "mm", "mm.": "mm",
    "centimeter": "cm", "centimeters": "cm", "cm.": "cm",
    "volt": "V", "volts": "V", "v": "V", "vac": "VAC", "vdc": "VDC",
    "amp": "A", "amps": "A", "ampere": "A", "a": "A",
    "watt": "W", "watts": "W", "w": "W",
    "decibel": "dBA", "decibels": "dBA", "dba": "dBA",
    "piece": "pc", "pieces": "pc", "pc": "pc", "pkg": "pkg", "box": "box"
}

def normalize_uom(unit_str: str) -> str:
    if not unit_str:
        return ""
    clean = unit_str.strip().lower()
    return UOM_CANONICAL_MAP.get(clean, unit_str.strip())

def decimal_to_trade_fraction(val: Any) -> str:
    """Converts decimals/floats to standard trade fractions (1/64 max denominator)."""
    if val is None or val == "":
        return ""
    try:
        num = float(str(val).strip().replace('"', '').replace("'", ""))
    except ValueError:
        return str(val)
        
    whole = int(num)
    decimal_part = num - whole
    if decimal_part < 0.001:
        return str(whole)
        
    frac = Fraction(decimal_part).limit_denominator(64)
    frac_str = f"{frac.numerator}/{frac.denominator}"
    return f"{whole}-{frac_str}" if whole > 0 else frac_str

def split_value_and_uom(raw_attr_str: str) -> Tuple[str, str]:
    """Separates strings like '1/2 in' or '18\"' into ('1/2', 'in') or ('18', 'in')."""
    if not raw_attr_str:
        return "", ""
    raw = str(raw_attr_str).strip()
    
    match = re.match(r'^([\d\.\-\/\s]+)\s*([a-zA-Z%\"\']+)?$', raw)
    if match:
        val = match.group(1).strip()
        unit = match.group(2) or ""
        return val, normalize_uom(unit)
    return raw, ""

# ---------------------------------------------------------
# NuExtract GGUF Schema Extraction Engine
# ---------------------------------------------------------
EXTRACTION_SCHEMA_TEMPLATE = {
    "brand": "",
    "product_type": "",
    "series": "",
    "width": "",
    "length": "",
    "diameter": "",
    "material": "",
    "grit": "",
    "voltage": "",
    "amperage": "",
    "package_quantity": "",
    "key_features": []
}

def sanitize_and_parse_json(raw_str: str) -> Dict[str, Any]:
    """Sanitizes unescaped quotes inside JSON strings and parses safely."""
    # Find JSON block
    match = re.search(r'\{[\s\S]*\}', raw_str)
    if not match:
        return {}
    json_text = match.group(0)
    
    # 1. Try standard json.loads
    try:
        return json.loads(json_text)
    except Exception:
        pass
        
    # 2. Fix unescaped double quotes inside key values (e.g. "series": "1/2" x 18"")
    cleaned_lines = []
    for line in json_text.splitlines():
        # Match key-value line e.g. "key": "val"
        kv_match = re.match(r'^(\s*"[^"]+"\s*:\s*)"(.*)"(\s*,?\s*)$', line)
        if kv_match:
            prefix, inner_val, suffix = kv_match.groups()
            # Escape internal unescaped quotes
            safe_val = inner_val.replace('\\"', '"').replace('"', '\\"')
            cleaned_lines.append(f"{prefix}\"{safe_val}\"{suffix}")
        else:
            cleaned_lines.append(line)
            
    fixed_json_text = "\n".join(cleaned_lines)
    try:
        return json.loads(fixed_json_text)
    except Exception as e:
        print(f"[WARN] JSON repair fallback error: {e}")
        return {}

def extract_with_nuextract_gguf(text_content: str) -> Dict[str, Any]:
    """
    Executes NuExtract-1.5-tiny GGUF via llama.cpp to extract structured product data.
    """
    llm = get_llm_instance()
    
    # Extract clean spec and description lines from text
    lines = [l.strip() for l in text_content.splitlines() if l.strip() and not l.startswith("```") and not l.startswith("<")]
    clean_text = "\n".join(lines[:40])
    
    prompt = f"""<|input|>
### Template:
{json.dumps(EXTRACTION_SCHEMA_TEMPLATE, indent=2)}

### Text:
{clean_text}
<|output|>
"""
    output = llm(
        prompt,
        max_tokens=450,
        temperature=0.0,
        stop=["<|input|>", "<|endoftext|>"]
    )
    
    raw_response = output["choices"][0]["text"].strip()
    extracted_json = sanitize_and_parse_json(raw_response)
    
    merged = dict(EXTRACTION_SCHEMA_TEMPLATE)
    if isinstance(extracted_json, dict):
        merged.update(extracted_json)
    return merged

# ---------------------------------------------------------
# 5 Description Synthesizer & 252-Column Exporter
# ---------------------------------------------------------
def generate_5_descriptions(attrs: Dict[str, Any], mpn: str, mfr: str, meta_desc: str) -> Dict[str, str]:
    brand = attrs.get("brand") or mfr or "Generic"
    prod_type = attrs.get("product_type") or "Tool Accessory"
    series = attrs.get("series") or ""
    
    width = str(attrs.get("width") or "")
    length = str(attrs.get("length") or "")
    material = str(attrs.get("material") or "")
    pkg_qty = str(attrs.get("package_quantity") or "")
    
    # 1. INVOICE DESCRIPTION: <= 40 chars, ALL CAPS
    w_clean = width.replace(" in", "").replace('"', '').strip()
    l_clean = length.replace(" in", "").replace('"', '').strip()
    qty_clean = pkg_qty.replace(" ", "").upper()
    dim_str = f"{w_clean}X{l_clean}" if (w_clean and l_clean) else width
    
    invoice_candidate = f"{brand} {dim_str} {prod_type} {qty_clean}".upper()
    invoice_desc = re.sub(r'\s+', ' ', invoice_candidate).strip()[:40]
    
    # 2. MOBILE DESCRIPTION: 60 - 80 chars
    mobile_parts = [p for p in [mfr, brand, prod_type, series, mpn] if p]
    mobile_desc = ", ".join(mobile_parts)
    if len(mobile_desc) < 60:
        if dim_str: mobile_desc += f", {dim_str}"
        if material: mobile_desc += f", {material}"
    if len(mobile_desc) > 80:
        mobile_desc = mobile_desc[:80].rstrip(', ')
        
    # 3. SHORT DESCRIPTION / Title
    size_disp = f"({dim_str})" if dim_str else ""
    short_title = f"{brand}® {series} {mpn} {prod_type} {size_disp}".strip()
    short_title = re.sub(r'\s+', ' ', short_title)
    
    # 4. LONG DESCRIPTION 1 (Technical specifications)
    specs = []
    if prod_type: specs.append(f"Product Type: {prod_type}")
    if dim_str: specs.append(f"Dimensions: {dim_str}")
    if material: specs.append(f"Material: {material}")
    if pkg_qty: specs.append(f"Package Quantity: {pkg_qty}")
    key_features = attrs.get("key_features") or []
    if key_features:
        if isinstance(key_features, list):
            specs.append(f"Key Features: {', '.join([str(f) for f in key_features if f])}")
        else:
            specs.append(f"Key Features: {key_features}")
    long_desc = ", ".join(specs) + "."
    
    # 5. RETAIL DESCRIPTION (Customer marketing summary)
    retail_desc = meta_desc or f"High performance {brand} {prod_type} designed for professional reliability and long service life."
    
    return {
        "invoice_description": invoice_desc,
        "mobile_description": mobile_desc,
        "short_title": short_title,
        "long_description": long_desc,
        "retail_description": retail_desc
    }

def format_252_column_delivery_dict(extracted_attrs: Dict[str, Any], raw_text: str, mpn: str) -> Dict[str, Any]:
    # Extract metadata headers from raw_text
    mfr_match = re.search(r'Manufacturer Name:\s*(.+)', raw_text)
    manufacturer = mfr_match.group(1).strip() if mfr_match else extracted_attrs.get("brand", "Manufacturer")
    
    url_match = re.search(r'URL:\s*(https?://[^\s]+)', raw_text)
    mfr_url = url_match.group(1).strip() if url_match else ""
    
    desc_match = re.search(r'\*\*Description\*\*:\s*(.+)', raw_text)
    meta_desc = desc_match.group(1).strip() if desc_match else ""
    
    descriptions = generate_5_descriptions(extracted_attrs, mpn, manufacturer, meta_desc)
    brand = extracted_attrs.get("brand") or manufacturer
    prod_type = extracted_attrs.get("product_type") or "Tool Accessory"
    
    delivery_dict = {
        # Provenance Columns 1-6
        "MFR URL": mfr_url,
        "Ref URL 1": "", "Ref URL 2": "", "Ref URL 3": "", "Ref URL 4": "", "Ref URL 5": "",
        
        # Identifiers Columns 7-18
        "PART_NUMBER": mpn,
        "SKU - MY_PART_NUMBER": mpn,
        "Mfg_Part_Num": mpn,
        "Part_Desc": f"{brand} {mpn} {prod_type}".strip(),
        "MANUFACTURER_NAME": manufacturer,
        "BRAND_NAME": f"{brand}®",
        "TRADE_NAME": brand,
        
        # Classpath & 5 Descriptions
        "Classpath": f"Hardware & Tools > Industrial Supplies > {prod_type}s",
        "INVOICE_DESCRIPTION": descriptions["invoice_description"],
        "MOBILE_DESCRIPTION": descriptions["mobile_description"],
        "SHORT_DESCRIPTION": descriptions["short_title"],
        "LONG_DESCRIPTION 1": descriptions["long_description"],
        "RETAIL_DESCRIPTION": descriptions["retail_description"],
    }
    
    # Item Features 1..15
    features_list = extracted_attrs.get("key_features") or []
    if isinstance(features_list, str):
        features_list = [features_list]
    for i in range(1, 16):
        feat = features_list[i-1] if i-1 < len(features_list) else ""
        delivery_dict[f"ITEM_FEATURES {i}"] = str(feat)
        
    # 60 Structured Attribute Triplets (ATTRIBUTE_LABEL n, ATTRIBUTE_VALUE n, ATTRIBUTE_UOM n)
    attribute_items = []
    if extracted_attrs.get("width"):
        v, u = split_value_and_uom(extracted_attrs["width"])
        attribute_items.append(("Width", v, u))
    if extracted_attrs.get("length"):
        v, u = split_value_and_uom(extracted_attrs["length"])
        attribute_items.append(("Length", v, u))
    if extracted_attrs.get("material"):
        attribute_items.append(("Material", extracted_attrs["material"], ""))
    if extracted_attrs.get("package_quantity"):
        v, u = split_value_and_uom(extracted_attrs["package_quantity"])
        attribute_items.append(("Package Quantity", v, u))
    if extracted_attrs.get("grit"):
        attribute_items.append(("Grit", extracted_attrs["grit"], ""))
    if extracted_attrs.get("voltage"):
        v, u = split_value_and_uom(extracted_attrs["voltage"])
        attribute_items.append(("Voltage", v, u))
    if extracted_attrs.get("amperage"):
        v, u = split_value_and_uom(extracted_attrs["amperage"])
        attribute_items.append(("Amperage", v, u))
    if extracted_attrs.get("series"):
        attribute_items.append(("Series", extracted_attrs["series"], ""))
    if extracted_attrs.get("product_type"):
        attribute_items.append(("Product Type", extracted_attrs["product_type"], ""))
        
    for i in range(1, 61):
        if i-1 < len(attribute_items):
            label, val, uom = attribute_items[i-1]
            delivery_dict[f"ATTRIBUTE_LABEL {i}"] = label
            delivery_dict[f"ATTRIBUTE_VALUE {i}"] = str(val)
            delivery_dict[f"ATTRIBUTE_UOM {i}"] = str(uom)
        else:
            delivery_dict[f"ATTRIBUTE_LABEL {i}"] = ""
            delivery_dict[f"ATTRIBUTE_VALUE {i}"] = ""
            delivery_dict[f"ATTRIBUTE_UOM {i}"] = ""
            
    # Mathematical Confidence Calculation
    jw_score = jellyfish.jaro_winkler_similarity(brand.lower(), manufacturer.lower())
    found_count = len(attribute_items)
    completeness = min(1.0, found_count / 6.0)
    delivery_dict["confidence_score"] = round(((jw_score * 0.4) + (completeness * 0.6)) * 100, 2)
    
    return delivery_dict

# ---------------------------------------------------------
# Main Execution Handler
# ---------------------------------------------------------
def process_scraped_file(filepath: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    mpn_match = re.search(r'scraped_output_(.+)\.txt', os.path.basename(filepath))
    mpn = mpn_match.group(1) if mpn_match else ""
    
    print(f"[*] Running Neural NuExtract Extraction via llama.cpp on {os.path.basename(filepath)}...")
    extracted_attrs = extract_with_nuextract_gguf(content)
    print(f"[+] Neural Extraction Output:\n{json.dumps(extracted_attrs, indent=2)}")
    
    delivery_json = format_252_column_delivery_dict(extracted_attrs, content, mpn)
    return delivery_json

if __name__ == "__main__":
    sample_file = os.path.join(os.path.dirname(__file__), "scraped_output_DCB518ASTS06G.txt")
    if os.path.exists(sample_file):
        res = process_scraped_file(sample_file)
        print("\n==========================================")
        print("=== 252-COLUMN DELIVERY OUTPUT ===")
        print("==========================================")
        print(f"1. INVOICE DESC ({len(res['INVOICE_DESCRIPTION'])} chars): {res['INVOICE_DESCRIPTION']}")
        print(f"2. MOBILE DESC  ({len(res['MOBILE_DESCRIPTION'])} chars): {res['MOBILE_DESCRIPTION']}")
        print(f"3. SHORT TITLE  : {res['SHORT_DESCRIPTION']}")
        print(f"4. LONG DESC    : {res['LONG_DESCRIPTION 1']}")
        print(f"5. Confidence   : {res['confidence_score']}%")
