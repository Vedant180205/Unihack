import csv
import io
import os
from typing import List, Dict, Any

TEMPLATE_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), 
    "docs", "resources", "Unihack_ Expected Output - Delivery Format.csv"
)

def get_delivery_headers() -> List[str]:
    """Reads the exact 252 headers from the official template."""
    if os.path.exists(TEMPLATE_CSV):
        with open(TEMPLATE_CSV, mode='r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            return next(reader)
    # Fallback header generation if file is missing
    headers = ["MFR URL", "Ref URL 1", "Ref URL 2", "Ref URL 3", "Ref URL 4", "Ref URL 5", "PART_NUMBER", "Dept", "Class", "Fine", "SKU - MY_PART_NUMBER", "Mfg_Part_Num", "Part_Desc", "E1_Brand", "Unilog_Brand", "DIB_Brand", "Part_Manuf", "MANUFACTURER_NAME", "BRAND_NAME", "TRADE_NAME", "MANUFACTURER_PART_NUMBER", "ALTERNATE_PART_NUMBER", "Classpath", "MOBILE_DESC", "INVOICE_DESC", "SHORT_DESC", "LONG_DESC1", "RETAIL_DESC", "MARKETING_DESCRIPTION"]
    for i in range(1, 51):
        headers.extend([f"ATTRIBUTE_LABEL {i}", f"ATTRIBUTE_VALUE {i}", f"ATTRIBUTE_UOM {i}"])
    return headers

def map_enriched_item_to_row(item: Dict[str, Any], headers: List[str]) -> Dict[str, str]:
    """
    Maps an enriched catalog item dict into a dictionary keyed by the 252 CSV headers.
    """
    raw_input = item.get("raw_input", {})
    enriched = item.get("raw_json", {})
    mfr_url = item.get("mfr_url", "")
    
    mpn = raw_input.get("mfg_part_num") or enriched.get("mfg_part_num", "")
    brand = enriched.get("canonical_brand") or raw_input.get("clean_brand", "")
    mfr = enriched.get("canonical_manufacturer") or raw_input.get("clean_manufacturer", brand)
    
    row_dict = {h: "" for h in headers}
    
    # 1. URLs
    row_dict["MFR URL"] = mfr_url
    
    # 2. Identifiers
    row_dict["PART_NUMBER"] = raw_input.get("sku", mpn)
    row_dict["SKU - MY_PART_NUMBER"] = raw_input.get("sku", mpn)
    row_dict["Mfg_Part_Num"] = mpn
    row_dict["MANUFACTURER_PART_NUMBER"] = mpn
    row_dict["Part_Desc"] = raw_input.get("part_desc", "")
    row_dict["Part_Manuf"] = raw_input.get("raw_manufacturer", "")
    row_dict["MANUFACTURER_NAME"] = mfr
    row_dict["BRAND_NAME"] = f"{brand}®" if brand and "®" not in brand else brand
    row_dict["Classpath"] = raw_input.get("classpath", "")
    
    # 3. 5 Descriptions
    row_dict["INVOICE_DESC"] = enriched.get("invoice_description", "")
    row_dict["MOBILE_DESC"] = enriched.get("mobile_description", "")
    row_dict["SHORT_DESC"] = enriched.get("short_title", "")
    row_dict["LONG_DESC1"] = enriched.get("long_description", "")
    row_dict["RETAIL_DESC"] = enriched.get("retail_description", "")
    
    # 4. Flatten Attribute Matrix (ATTRIBUTE_LABEL 1..50, ATTRIBUTE_VALUE 1..50, ATTRIBUTE_UOM 1..50)
    attrs = enriched.get("attribute_matrix", {})
    idx = 1
    for attr_key, attr_obj in attrs.items():
        if idx > 50:
            break
        if isinstance(attr_obj, dict):
            val = attr_obj.get("value")
            uom = attr_obj.get("uom") or ""
            if val:
                # Format key to human readable title case
                label = attr_key.replace("_", " ").title()
                row_dict[f"ATTRIBUTE_LABEL {idx}"] = label
                row_dict[f"ATTRIBUTE_VALUE {idx}"] = str(val)
                row_dict[f"ATTRIBUTE_UOM {idx}"] = str(uom)
                idx += 1
                
    # 5. Digital Assets
    brand_slug = brand.upper().replace(" ", "_")
    mpn_slug = mpn.upper().replace(" ", "_")
    row_dict["Product Image"] = f"{brand_slug}_{mpn_slug}.jpg"
    row_dict["Specification Sheet"] = f"{brand_slug}_{mpn_slug}_Specification_Sheet.pdf"
    row_dict["Actual Image (Yes/No)"] = "Yes"
    
    return row_dict

def export_items_to_csv_string(items: List[Dict[str, Any]]) -> str:
    """Exports a list of enriched items to a 252-column CSV string."""
    headers = get_delivery_headers()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    
    for item in items:
        row = map_enriched_item_to_row(item, headers)
        writer.writerow(row)
        
    return output.getvalue()
