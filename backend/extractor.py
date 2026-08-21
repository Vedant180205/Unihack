import os
import re
import json
from fractions import Fraction
from typing import Dict, Any, List, Optional, Tuple
import jellyfish
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------
# Groq API Extraction Engine (Agentic Web Search)
# ---------------------------------------------------------
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not found in .env")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

# ---------------------------------------------------------
# Attribute Schema
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
    cleaned_lines = []
    
    # Very basic quote sanitization
    for line in json_text.split('\n'):
        # match a value like: "key": "value with "quotes" inside",
        kv_match = re.match(r'^(\s*"[^"]+"\s*:\s*)"(.*)"(,?)\s*$', line)
        if kv_match:
            prefix, inner_val, suffix = kv_match.groups()
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

def extract_with_groq(product_url: str) -> Dict[str, Any]:
    """
    Executes Groq Agent to search the URL and extract structured product data.
    """
    client = get_groq_client()
    
    schema_str = json.dumps(EXTRACTION_SCHEMA_TEMPLATE, indent=2)
    
    prompt = f"""You are a precise JSON data extractor. I have a product at this URL: {product_url}
    
    1. Use your browser_search tool to visit this URL and read the product specifications.
    2. Extract the exact product specifications based on the text on that page.
    3. Output ONLY raw JSON matching this exact schema:
    {schema_str}
    
    4. If a field is not found on the page, output an empty string "". DO NOT hallucinate.
    """
    
    print(f"[*] Sending URL to Groq Agent (openai/gpt-oss-120b)...")
    
    # Do not use stream=True so we can just grab the final output easily
    completion = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
          {
            "role": "user",
            "content": prompt
          }
        ],
        temperature=1,
        max_completion_tokens=2048,
        top_p=1,
        reasoning_effort="low",
        stream=False,
        tools=[{"type":"browser_search"},{"type":"code_interpreter"}]
    )
    
    raw_output = completion.choices[0].message.content.strip()
    print("[*] Received response from Groq API!")
    print(raw_output)
    
    parsed_json = sanitize_and_parse_json(raw_output)
    return parsed_json

# ---------------------------------------------------------
# Formatting logic
# ---------------------------------------------------------
def split_value_and_uom(val_str: str) -> Tuple[str, str]:
    if not val_str:
        return "", ""
    match = re.match(r'^([\d\.\-\/]+)\s*([A-Za-z]+.*)$', str(val_str).strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return str(val_str).strip(), ""

def generate_5_descriptions(attrs: Dict[str, Any], mpn: str, manufacturer: str, meta_desc: str = "") -> Dict[str, str]:
    brand = attrs.get("brand") or manufacturer
    mfr = manufacturer
    prod_type = attrs.get("product_type") or "Tool Accessory"
    series = attrs.get("series") or ""
    
    width = str(attrs.get("width") or "")
    length = str(attrs.get("length") or "")
    material = str(attrs.get("material") or "")
    pkg_qty = str(attrs.get("package_quantity") or "")
    
    w_clean = width.replace(" in", "").replace('"', '').strip()
    l_clean = length.replace(" in", "").replace('"', '').strip()
    qty_clean = pkg_qty.replace(" ", "").upper()
    dim_str = f"{w_clean}X{l_clean}" if (w_clean and l_clean) else width
    
    invoice_candidate = f"{brand} {dim_str} {prod_type} {qty_clean}".upper()
    invoice_desc = re.sub(r'\s+', ' ', invoice_candidate).strip()[:40]
    
    mobile_parts = [p for p in [mfr, brand, prod_type, series, mpn] if p]
    mobile_desc = ", ".join(mobile_parts)
    if len(mobile_desc) < 60:
        if dim_str: mobile_desc += f", {dim_str}"
        if material: mobile_desc += f", {material}"
    if len(mobile_desc) > 80:
        mobile_desc = mobile_desc[:80].rstrip(', ')
        
    size_disp = f"({dim_str})" if dim_str else ""
    brand_with_r = f"{brand}®" if brand and "®" not in brand else brand
    short_title = f"{brand_with_r} {series} {mpn} {prod_type} {size_disp}".strip()
    short_title = re.sub(r'\s+', ' ', short_title)
    
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
    
    retail_desc = meta_desc or f"High performance {brand} {prod_type} designed for professional reliability and long service life."
    
    return {
        "invoice_description": invoice_desc,
        "mobile_description": mobile_desc,
        "short_title": short_title,
        "long_description": long_desc,
        "retail_description": retail_desc
    }

def format_252_column_delivery_dict(extracted_attrs: Dict[str, Any], raw_text: str, mpn: str) -> Dict[str, Any]:
    mfr_match = re.search(r'Manufacturer Name:\s*(.+)', raw_text)
    manufacturer = mfr_match.group(1).strip() if mfr_match else extracted_attrs.get("brand", "Manufacturer")
    if "(" in manufacturer:
        manufacturer = manufacturer.split("(")[0].strip()
        
    url_match = re.search(r'URL:\s*(https?://[^\s]+)', raw_text)
    mfr_url = url_match.group(1).strip() if url_match else ""
    
    desc_match = re.search(r'\*\*Description\*\*:\s*(.+)', raw_text)
    meta_desc = desc_match.group(1).strip() if desc_match else ""
    
    descriptions = generate_5_descriptions(extracted_attrs, mpn, manufacturer, meta_desc)
    brand = extracted_attrs.get("brand") or manufacturer
    prod_type = extracted_attrs.get("product_type") or "Tool Accessory"
    brand_slug = re.sub(r'[^A-Za-z0-9_]', '', (brand or manufacturer).upper().replace(" ", "_"))
    mpn_slug = re.sub(r'[^A-Za-z0-9_]', '', mpn.upper().replace(" ", "_").replace("-", "_"))
    prefix = f"{brand_slug}_{mpn_slug}" if brand_slug else mpn_slug
    
    delivery_dict = {
        "MFR URL": mfr_url,
        "Ref URL 1": "", "Ref URL 2": "", "Ref URL 3": "", "Ref URL 4": "", "Ref URL 5": "",
        "PART_NUMBER": mpn,
        "SKU - MY_PART_NUMBER": mpn,
        "Mfg_Part_Num": mpn,
        "Part_Desc": f"{brand} {mpn} {prod_type}".strip(),
        "MANUFACTURER_NAME": manufacturer,
        "BRAND_NAME": f"{brand}®" if brand else "",
        "TRADE_NAME": brand,
        "MANUFACTURER_PART_NUMBER": mpn,
        "Classpath": f"Hardware & Tools > Industrial Supplies > {prod_type}s",
        "INVOICE_DESC": descriptions["invoice_description"],
        "MOBILE_DESC": descriptions["mobile_description"],
        "SHORT_DESC": descriptions["short_title"],
        "LONG_DESC1": descriptions["long_description"],
        "RETAIL_DESC": descriptions["retail_description"],
        # Backward compatibility keys
        "INVOICE_DESCRIPTION": descriptions["invoice_description"],
        "MOBILE_DESCRIPTION": descriptions["mobile_description"],
        "SHORT_DESCRIPTION": descriptions["short_title"],
        "LONG_DESCRIPTION 1": descriptions["long_description"],
        "RETAIL_DESCRIPTION": descriptions["retail_description"],
        "Product Name": prod_type,
        "Product Image": f"{prefix}.jpg",
        "Alternate Image 1": f"{prefix}_1.jpg",
        "Alternate Image 2": f"{prefix}_2.jpg",
        "Alternate Image 3": f"{prefix}_3.jpg",
        "Alternate Image 4": f"{prefix}_4.jpg",
        "Specification Sheet": f"{prefix}_Specification_Sheet.pdf",
        "Actual Image (Yes/No)": "Yes"
    }
    
    features_list = extracted_attrs.get("key_features") or []
    if isinstance(features_list, str):
        features_list = [features_list]
    for i in range(1, 21):
        feat = features_list[i-1] if i-1 < len(features_list) else ""
        delivery_dict[f"ITEM_FEATURES_{i}"] = str(feat)
        delivery_dict[f"ITEM_FEATURES {i}"] = str(feat)
        
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
        
    for i in range(1, 51):
        if i-1 < len(attribute_items):
            label, val, uom = attribute_items[i-1]
            delivery_dict[f"ATTRIBUTE_LABEL {i}"] = label
            delivery_dict[f"ATTRIBUTE_VALUE {i}"] = str(val)
            delivery_dict[f"ATTRIBUTE_UOM {i}"] = str(uom)
        else:
            delivery_dict[f"ATTRIBUTE_LABEL {i}"] = ""
            delivery_dict[f"ATTRIBUTE_VALUE {i}"] = ""
            delivery_dict[f"ATTRIBUTE_UOM {i}"] = ""
            
    jw_score = jellyfish.jaro_winkler_similarity(brand.lower(), manufacturer.lower())
    found_count = len(attribute_items)
    completeness = min(1.0, found_count / 6.0)
    delivery_dict["confidence_score"] = round(((jw_score * 0.4) + (completeness * 0.6)) * 100, 2)
    
    return delivery_dict

def process_scraped_file(filepath: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Extract MPN from filename
    mpn_match = re.search(r'scraped_output_(.+)\.txt', os.path.basename(filepath))
    mpn = mpn_match.group(1) if mpn_match else ""
    
    # Extract URL from the text dump
    url_match = re.search(r'URL:\s*(https?://[^\s]+)', content)
    product_url = url_match.group(1).strip() if url_match else ""
    
    if not product_url:
        print("[ERROR] Could not find URL in text file to pass to Groq!")
        return {}
        
    print(f"[*] Running Neural Groq Agent Extraction on {product_url}...")
    extracted_attrs = extract_with_groq(product_url)
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
