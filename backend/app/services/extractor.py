import os
import re
import json
import csv
from typing import Dict, Any, List, Tuple
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------
# Groq Client
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
# JSON Sanitizer
# ---------------------------------------------------------
def sanitize_and_parse_json(raw_str: str) -> Dict[str, Any]:
    match = re.search(r'\{[\s\S]*\}', raw_str)
    if not match:
        return {}
    json_text = match.group(0)
    try:
        return json.loads(json_text)
    except Exception:
        json_text = re.sub(r',\s*([}\]])', r'\1', json_text)
        try:
            return json.loads(json_text)
        except Exception as e:
            print(f"[WARN] JSON parse failed: {e}")
            return {}

# ---------------------------------------------------------
# Groq Prompt — Open-Schema with Noise Filter
# ---------------------------------------------------------
GROQ_SYSTEM_PROMPT = """You are a precise industrial product data extractor.
Your job is to visit a product page and extract ONLY factual technical specifications about the specific product listed.

NOISE FILTER — DO NOT EXTRACT ANY OF THE FOLLOWING:
- Navigation menus, headers, footers, breadcrumbs, site links
- Prices, discounts, shipping info, availability, stock counts, cart info
- Customer reviews, star ratings, Q&A sections, testimonials
- Related/similar product recommendations or cross-sells
- Promotional text, marketing slogans, sales banners, newsletter signups
- Social media stats, share buttons, follower counts
- Store info, contact details, company history, about us content
- "Customers also bought" or "Frequently bought together" sections
- Website statistics, traffic data, or analytics

ONLY EXTRACT information that is a factual technical specification or physical attribute
of THIS specific product — dimensions, materials, electrical ratings, standards, certifications,
compatible equipment, application types, included accessories, physical properties, etc."""

GROQ_OUTPUT_INSTRUCTIONS = """
Return a single JSON object with EXACTLY these 7 top-level keys:

1. "raw_attributes" — ALL product technical specifications you find. COMPLETELY OPEN-ENDED.
   Use the exact attribute names as shown on the page.
   Each entry: "Attribute Name": {"value": "...", "source": "webpage|pdf|both"}
   Include EVERYTHING: grit, backing, material, motor size, blade diameter, arbor size, etc.
   DO NOT limit to a predefined list.

2. "identifiers" — with keys: "UPC", "EAN", "GTIN", "UNSPSC"
   Each: {"value": "...", "source": "webpage|pdf|both|""}

3. "dimensions" — physical package/product dimensions with keys:
   "length", "width", "height", "weight", "diameter", "volume"
   Each: {"value": "...", "uom": "in/mm/lbs/kg/etc", "source": "..."}

4. "documents" — URLs to any downloadable documents found on the page, with keys:
   "SDS", "Specification Sheet", "Installation Manual", "Service Manual",
   "Owners Manual", "Catalog", "Technical Bulletin", "Line Drawing"
   Each: {"value": "https://...", "source": "webpage|pdf|""}

5. "images" — product image URLs with keys:
   "Product Image", "Alternate Image 1", "Alternate Image 2", "Alternate Image 3", "Alternate Image 4"
   Each: {"value": "https://...", "source": "webpage|""}

6. "descriptions" — with keys:
   "product_name", "short_desc", "long_desc", "key_features" (list), "application",
   "includes", "standards", "country_of_origin", "warranty", "brand", "series", "product_type"
   Each: {"value": "..." or [...], "source": "webpage|pdf|both|""}

7. "pricing" — with keys: "list_price", "currency", "selling_qty", "selling_uom"
   Each: {"value": "...", "source": "webpage|""}

STRICT RULES:
- raw_attributes is COMPLETELY OPEN-ENDED. Add as many keys as you find on the page.
- Empty string "" for value AND source if not found. NEVER invent data.
- Source must be one of: "webpage", "pdf", "both", or "" (not found).
- Return the JSON directly as pure text. DO NOT use any tool calls or function calls (like "json") to return your answer. 
- Output MUST be valid JSON wrapped in ```json ... ``` and nothing else."""

def extract_with_groq(product_url: str, pdf_text: str = "") -> Dict[str, Any]:
    source_a = f"SOURCE A — PRODUCT WEBPAGE (use browser_search to visit):\n{product_url}"
    source_b = ""
    if pdf_text.strip():
        source_b = f"\n\nSOURCE B — PDF SPEC SHEET (pre-extracted text, read directly, do NOT browse):\n{pdf_text[:6000]}"
        sources_desc = "SOURCE A (webpage) AND SOURCE B (PDF spec sheet)"
    else:
        sources_desc = "SOURCE A (webpage) only"

    user_prompt = f"""Extract all product data from {sources_desc}.

{source_a}{source_b}

{GROQ_OUTPUT_INSTRUCTIONS}"""

    print(f"[*] Sending to Groq Agent (openai/gpt-oss-120b)...")
    if pdf_text.strip():
        print(f"[*] Sources: URL + {len(pdf_text)} chars of PDF spec text")
    else:
        print(f"[*] Sources: URL only")

    completion = get_groq_client().chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": GROQ_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        temperature=1,
        max_completion_tokens=4096,
        top_p=1,
        reasoning_effort="low",
        stream=False,
        tools=[{"type": "browser_search"}]
    )

    raw_output = completion.choices[0].message.content.strip()
    print("[*] Groq responded!")
    parsed = sanitize_and_parse_json(raw_output)
    return parsed

# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def _v(section: Dict, key: str) -> str:
    """Get value only if source is non-empty (no citation = no value)."""
    entry = section.get(key, {})
    if not isinstance(entry, dict):
        return str(entry) if entry else ""
    if not entry.get("source", ""):
        return ""
    val = entry.get("value", "")
    return str(val).strip() if val else ""

def _vlist(section: Dict, key: str) -> List[str]:
    """Get list value only if source is non-empty."""
    entry = section.get(key, {})
    if not isinstance(entry, dict):
        return []
    if not entry.get("source", ""):
        return []
    val = entry.get("value", [])
    if isinstance(val, list):
        return [str(v).strip() for v in val if v]
    return [str(val).strip()] if val else []

def _dim(section: Dict, key: str) -> Tuple[str, str]:
    """Get dimension value and UOM only if source is non-empty."""
    entry = section.get(key, {})
    if not isinstance(entry, dict):
        return "", ""
    if not entry.get("source", ""):
        return "", ""
    return str(entry.get("value", "")).strip(), str(entry.get("uom", "")).strip()

def split_value_uom(val_str: str) -> Tuple[str, str]:
    """Parse '12000 rpm' -> ('12000', 'rpm')"""
    if not val_str:
        return "", ""
    match = re.match(r'^([\d\.\-\/\s]+)\s*([A-Za-z%"\']+.*)$', str(val_str).strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return str(val_str).strip(), ""

# ---------------------------------------------------------
# 5 Descriptions Generator
# ---------------------------------------------------------
def generate_5_descriptions(groq_json: Dict, mpn: str, manufacturer: str) -> Dict[str, str]:
    desc = groq_json.get("descriptions", {})
    attrs = groq_json.get("raw_attributes", {})
    pricing = groq_json.get("pricing", {})

    brand = _v(desc, "brand") or manufacturer
    prod_type = _v(desc, "product_type") or ""
    series = _v(desc, "series") or ""
    product_name = _v(desc, "product_name") or ""

    # Try to find dimensional values for invoice desc
    dim = groq_json.get("dimensions", {})
    diameter_v, diameter_u = _dim(dim, "diameter")
    width_v, width_u = _dim(dim, "width")
    length_v, length_u = _dim(dim, "length")
    qty = _v(pricing, "selling_qty")
    uom = _v(pricing, "selling_uom")

    size_str = ""
    if diameter_v: size_str = f"{diameter_v}{diameter_u}"
    elif width_v and length_v: size_str = f"{width_v}X{length_v}{width_u}"

    # 1. INVOICE DESC: <=40 chars, ALL CAPS, cited values only
    parts = [p for p in [brand, size_str, prod_type] if p]
    invoice_raw = " ".join(parts).upper()
    if qty: invoice_raw += f" {qty}{uom}".upper()
    invoice_desc = re.sub(r'\s+', ' ', invoice_raw).strip()[:40]

    # 2. MOBILE DESC: 60-80 chars
    mobile_parts = [p for p in [manufacturer, brand, prod_type, series, mpn] if p]
    mobile_desc = ", ".join(mobile_parts)
    if len(mobile_desc) < 60 and size_str: mobile_desc += f", {size_str}"
    if len(mobile_desc) > 80: mobile_desc = mobile_desc[:80].rstrip(", ")

    # 3. SHORT DESC
    size_disp = f"({size_str})" if size_str else ""
    short_title = re.sub(r'\s+', ' ', f"{brand} {series} {mpn} {prod_type} {size_disp}".strip())

    # 4. LONG DESC: build from raw_attributes
    spec_parts = []
    if prod_type: spec_parts.append(f"Product Type: {prod_type}")
    if size_str: spec_parts.append(f"Size: {size_str}")
    for attr_key in list(attrs.keys())[:8]:
        av = _v(attrs, attr_key)
        if av: spec_parts.append(f"{attr_key}: {av}")
    features = _vlist(desc, "key_features")
    if features: spec_parts.append(f"Features: {'; '.join(features[:3])}")
    long_desc = ", ".join(spec_parts) + "." if spec_parts else ""

    # 5. RETAIL DESC
    long_text = _v(desc, "long_desc")
    retail_desc = long_text[:300] if long_text else (
        f"{brand} {prod_type} {series}".strip() if (brand and prod_type) else ""
    )

    return {
        "INVOICE_DESC": invoice_desc,
        "MOBILE_DESC": mobile_desc,
        "SHORT_DESC": short_title,
        "LONG_DESC1": long_desc,
        "RETAIL_DESC": retail_desc
    }

# ---------------------------------------------------------
# 252-Column Mapper
# ---------------------------------------------------------
def map_to_252_columns(groq_json: Dict, raw_txt: str, mpn: str) -> Dict[str, Any]:
    mfr_match = re.search(r'Manufacturer Name:\s*(.+)', raw_txt)
    manufacturer = mfr_match.group(1).strip() if mfr_match else ""

    url_match = re.search(r'URL:\s*(https?://[^\s]+)', raw_txt)
    mfr_url = url_match.group(1).strip() if url_match else ""

    desc = groq_json.get("descriptions", {})
    ids  = groq_json.get("identifiers", {})
    dim  = groq_json.get("dimensions", {})
    docs = groq_json.get("documents", {})
    imgs = groq_json.get("images", {})
    attrs = groq_json.get("raw_attributes", {})
    pricing = groq_json.get("pricing", {})

    brand = _v(desc, "brand") or manufacturer
    prod_type = _v(desc, "product_type") or ""
    descriptions = generate_5_descriptions(groq_json, mpn, manufacturer)
    features = _vlist(desc, "key_features")

    # Dimensions
    len_v, len_u   = _dim(dim, "length")
    hgt_v, hgt_u   = _dim(dim, "height")
    wid_v, wid_u   = _dim(dim, "width")
    wgt_v, wgt_u   = _dim(dim, "weight")
    vol_v, vol_u   = _dim(dim, "volume")

    # 1. Load the exact headers from expected output CSV
    template_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "template.csv")
    row = {}
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)
            # 2. Create an empty dictionary with exact keys
            row = {h: "" for h in headers}
    else:
        print("[WARN] template.csv not found!")

    updates = {
        # === Provenance (Col 1-6) ===
        "MFR URL": mfr_url,

        # === Identifiers (Col 7-22) ===
        "PART_NUMBER": mpn,
        "SKU - MY_PART_NUMBER": mpn,
        "Mfg_Part_Num": mpn,
        "Part_Desc": f"{brand} {mpn} {prod_type}".strip(),
        "E1_Brand": brand,
        "Unilog_Brand": brand,
        "DIB_Brand": brand,
        "Part_Manuf": manufacturer,
        "MANUFACTURER_NAME": manufacturer,
        "BRAND_NAME": brand,
        "TRADE_NAME": brand,
        "MANUFACTURER_PART_NUMBER": mpn,

        # === Classpath & Descriptions (Col 23-29) ===
        "Classpath": f"Hardware & Tools > {prod_type}s" if prod_type else "",
        "MOBILE_DESC": descriptions["MOBILE_DESC"],
        "INVOICE_DESC": descriptions["INVOICE_DESC"],
        "SHORT_DESC": descriptions["SHORT_DESC"],
        "LONG_DESC1": descriptions["LONG_DESC1"],
        "RETAIL_DESC": descriptions["RETAIL_DESC"],
        "MARKETING_DESCRIPTION": _v(desc, "long_desc")[:500] if _v(desc, "long_desc") else "",

        # === Fixed spec columns (Col 50-55) ===
        "Standard/Approvals": _v(desc, "standards"),
        "Application": _v(desc, "application"),
        "Includes": _v(desc, "includes"),
        "Product Name": _v(desc, "product_name"),
    }
    
    if row:
        row.update(updates)
    else:
        row = updates

    # === Item Features (Col 30-49) — 20 slots ===
    for i in range(1, 21):
        row[f"ITEM_FEATURES_{i}"] = features[i-1] if i-1 < len(features) else ""

    # === Dynamic Attribute Triplets (Col 56-205) — 50 slots ===
    attr_items = []
    for attr_label, attr_entry in attrs.items():
        if not isinstance(attr_entry, dict):
            continue
        src = attr_entry.get("source", "")
        val = attr_entry.get("value", "")
        if src and val:
            v, u = split_value_uom(str(val))
            attr_items.append((attr_label, v, u, src))
        elif val:
            v, u = split_value_uom(str(val))
            attr_items.append((attr_label, v, u, ""))

    for i in range(1, 51):
        if i - 1 < len(attr_items):
            label, val, uom, _ = attr_items[i - 1]
            row[f"ATTRIBUTE_LABEL {i}"]  = label
            row[f"ATTRIBUTE_VALUE {i}"] = val
            row[f"ATTRIBUTE_UOM {i}"]   = uom
        else:
            row[f"ATTRIBUTE_LABEL {i}"]  = ""
            row[f"ATTRIBUTE_VALUE {i}"] = ""
            row[f"ATTRIBUTE_UOM {i}"]   = ""

    # === Identifiers (Col 206-209) ===
    row["UPC"]     = _v(ids, "UPC")
    row["EAN"]     = _v(ids, "EAN")
    row["GTIN"]    = _v(ids, "GTIN")
    row["UNSPSC"]  = _v(ids, "UNSPSC")

    # === Pricing & Packaging (Col 210-214) ===
    row["Warranty"]                   = _v(desc, "warranty")
    row["List Price"]                 = _v(pricing, "list_price")
    row["Selling Qty"]                = _v(pricing, "selling_qty")
    row["Selling UOM"]                = _v(pricing, "selling_uom")
    row["Standard Packaging Information"] = ""

    # === Dimensions (Col 215-224) ===
    row["LENGTH"]       = len_v
    row["LENGTH_UOM"]   = len_u
    row["HEIGHT"]       = hgt_v
    row["HEIGHT_UOM"]   = hgt_u
    row["WIDTH"]        = wid_v
    row["WIDTH_UOM"]    = wid_u
    row["WEIGHT"]       = wgt_v
    row["WEIGHT_UOM"]   = wgt_u
    row["VOLUME"]       = vol_v
    row["VOLUME_UOM"]   = vol_u

    # === Images (Col 225-229) ===
    row["Product Image"]    = _v(imgs, "Product Image")
    row["Alternate Image 1"] = _v(imgs, "Alternate Image 1")
    row["Alternate Image 2"] = _v(imgs, "Alternate Image 2")
    row["Alternate Image 3"] = _v(imgs, "Alternate Image 3")
    row["Alternate Image 4"] = _v(imgs, "Alternate Image 4")

    # === Documents (Col 230-247) ===
    row["SDS"]                         = _v(docs, "SDS")
    row["SDS_1"]                       = ""
    row["Warranty Information"]        = _v(desc, "warranty")
    row["Catalog"]                     = _v(docs, "Catalog")
    row["Specification Sheet"]         = _v(docs, "Specification Sheet")
    row["Instruction/Installation Manual"] = _v(docs, "Installation Manual")
    row["Service Manual"]              = _v(docs, "Service Manual")
    row["Owners/User Manual"]          = _v(docs, "Owners Manual")
    row["Line Drawing"]                = _v(docs, "Line Drawing")
    row["MTR"]                         = ""
    row["RoHS"]                        = ""
    row["Full Engineering Drawing"]    = ""
    row["Energy Star Guide"]           = ""
    row["Technical Bulletin"]          = _v(docs, "Technical Bulletin")
    row["Submittal"]                   = ""
    row["Compatibility Chart"]         = ""
    row["Size Chart"]                  = ""
    row["Product Label/Insert"]        = ""

    # === Video & Other (Col 248-252) ===
    row["Video Link"]          = ""
    row["Video Link 1"]        = ""
    row["Country Of Origin"]   = _v(desc, "country_of_origin")
    row["Discontinued"]        = ""
    row["Actual Image (Yes/No)"] = "Yes" if _v(imgs, "Product Image") else "No"

    # === Overall Confidence Score ===
    cited_attrs = sum(1 for v in attrs.values() if isinstance(v, dict) and v.get("source"))
    total_attrs = len(attrs) if attrs else 1
    has_dims = sum(1 for k in ["length","width","height","weight"] if _dim(dim, k)[0])
    has_docs = sum(1 for k in docs if _v(docs, k))
    total_signals = total_attrs + 4 + 4
    cited_signals = cited_attrs + has_dims + has_docs
    row["confidence_score"] = round((cited_signals / total_signals) * 100, 2)

    # === Build Per-Field Confidence Map ===
    confidence_map = {}
    
    def calculate_grounded_score(value: str, raw_txt: str, cited_source: str) -> int:
        if not value:
            return 0
        if not cited_source:
            base_score = 40
        else:
            base_score = 100

        val_lower = str(value).lower()
        txt_lower = raw_txt.lower()

        if val_lower in txt_lower:
            return base_score
            
        numbers = re.findall(r'\d+\.?\d*', val_lower)
        if numbers:
            found_nums = sum(1 for n in numbers if n in txt_lower)
            num_ratio = found_nums / len(numbers)
            return int(base_score * (num_ratio * 0.8))

        words = set(re.findall(r'\w+', val_lower))
        if not words:
            return base_score
        
        found_words = sum(1 for w in words if w in txt_lower)
        word_ratio = found_words / len(words)
        return int(base_score * (word_ratio * 0.9))

    def _score(section_dict: Dict, key: str) -> int:
        entry = section_dict.get(key, {})
        if not isinstance(entry, dict) or not entry.get("value"):
            return 0
        return calculate_grounded_score(str(entry.get("value", "")), raw_txt, entry.get("source", ""))
        
    for k, v in row.items():
        if not v:
            confidence_map[k] = 0
        else:
            confidence_map[k] = 100 # default high for strings/names
            
    # Overrides based on source checking
    confidence_map["UPC"] = _score(ids, "UPC")
    confidence_map["EAN"] = _score(ids, "EAN")
    confidence_map["LENGTH"] = _score(dim, "length")
    confidence_map["WIDTH"] = _score(dim, "width")
    confidence_map["HEIGHT"] = _score(dim, "height")
    confidence_map["WEIGHT"] = _score(dim, "weight")
    confidence_map["VOLUME"] = _score(dim, "volume")
    confidence_map["Product Image"] = _score(imgs, "Product Image")
    confidence_map["Specification Sheet"] = _score(docs, "Specification Sheet")
    confidence_map["Catalog"] = _score(docs, "Catalog")
    
    # Check attributes
    for i in range(1, 51):
        if i - 1 < len(attr_items):
            _, val, uom, src = attr_items[i - 1]
            s = calculate_grounded_score(f"{val} {uom}".strip(), raw_txt, src)
            confidence_map[f"ATTRIBUTE_LABEL {i}"] = s
            confidence_map[f"ATTRIBUTE_VALUE {i}"] = s
            confidence_map[f"ATTRIBUTE_UOM {i}"] = s

    # Return tuple of data and confidence
    return row, confidence_map


# ---------------------------------------------------------
# Save clean CSV
# ---------------------------------------------------------
def save_clean_csv(delivery_dict: Dict, out_path: str):
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(delivery_dict.keys()))
        writer.writeheader()
        writer.writerow(delivery_dict)
    print(f"[+] Saved clean delivery CSV to {out_path}")

# ---------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------
def process_scraped_file(filepath: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    mpn_match = re.search(r'scraped_output_(.+)\.txt', os.path.basename(filepath))
    mpn = mpn_match.group(1) if mpn_match else ""

    url_match = re.search(r'URL:\s*(https?://[^\s]+)', content)
    product_url = url_match.group(1).strip() if url_match else ""

    # Load PDF text if harvested
    pdf_txt_path = os.path.join(os.path.dirname(filepath), f"extracted_pdf_{mpn}.txt")
    pdf_text = ""
    if os.path.exists(pdf_txt_path):
        with open(pdf_txt_path, "r", encoding="utf-8") as f:
            pdf_text = f.read()
        print(f"[*] Found PDF spec text ({len(pdf_text)} chars) — sending as SOURCE B")

    if not product_url:
        print("[ERROR] No product URL found in text file.")
        return {}

    print(f"[*] Running Open-Schema Groq Extraction on {mpn}...")
    groq_json = extract_with_groq(product_url, pdf_text)
    print(f"[+] Raw Groq Output:\n{json.dumps(groq_json, indent=2)}")

    delivery_dict, confidence_map = map_to_252_columns(groq_json, content, mpn)
    return {
        "provenance": groq_json,
        "delivery": delivery_dict,
        "confidence_map": confidence_map
    }


