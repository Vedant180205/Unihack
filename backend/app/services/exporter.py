import csv
import io
import os
import re
from typing import List, Dict, Any, Optional

TEMPLATE_CSV = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    "docs", "resources", "Unihack_ Expected Output - Delivery Format.csv"
)

# Canonical 252-column headers as defined in the official delivery format specification
OFFICIAL_252_HEADERS = [
    "MFR URL", "Ref URL 1", "Ref URL 2", "Ref URL 3", "Ref URL 4", "Ref URL 5",
    "PART_NUMBER", "Dept", "Class", "Fine", "SKU - MY_PART_NUMBER", "Mfg_Part_Num",
    "Part_Desc", "E1_Brand", "Unilog_Brand", "DIB_Brand", "Part_Manuf",
    "MANUFACTURER_NAME", "BRAND_NAME", "TRADE_NAME", "MANUFACTURER_PART_NUMBER",
    "ALTERNATE_PART_NUMBER", "Classpath",
    "MOBILE_DESC", "INVOICE_DESC", "SHORT_DESC", "LONG_DESC1", "RETAIL_DESC", "MARKETING_DESCRIPTION",
    "ITEM_FEATURES_1", "ITEM_FEATURES_2", "ITEM_FEATURES_3", "ITEM_FEATURES_4", "ITEM_FEATURES_5",
    "ITEM_FEATURES_6", "ITEM_FEATURES_7", "ITEM_FEATURES_8", "ITEM_FEATURES_9", "ITEM_FEATURES_10",
    "ITEM_FEATURES_11", "ITEM_FEATURES_12", "ITEM_FEATURES_13", "ITEM_FEATURES_14", "ITEM_FEATURES_15",
    "ITEM_FEATURES_16", "ITEM_FEATURES_17", "ITEM_FEATURES_18", "ITEM_FEATURES_19", "ITEM_FEATURES_20",
    "With", "Standard/Approvals", "Prop 65", "Application", "Includes", "Product Name"
]

for _i in range(1, 51):
    OFFICIAL_252_HEADERS.extend([f"ATTRIBUTE_LABEL {_i}", f"ATTRIBUTE_VALUE {_i}", f"ATTRIBUTE_UOM {_i}"])

OFFICIAL_252_HEADERS.extend([
    "UPC", "EAN", "GTIN", "UNSPSC", "Warranty", "List Price", "Selling Qty", "Selling UOM",
    "Standard Packaging Information", "LENGTH", "LENGTH_UOM", "HEIGHT", "HEIGHT_UOM",
    "WIDTH", "WIDTH_UOM", "WEIGHT", "WEIGHT_UOM", "VOLUME", "VOLUME_UOM",
    "Product Image", "Alternate Image 1", "Alternate Image 2", "Alternate Image 3", "Alternate Image 4",
    "SDS", "SDS_1", "Warranty Information", "Catalog", "Specification Sheet",
    "Instruction/Installation Manual", "Service Manual", "Owners/User Manual", "Line Drawing",
    "MTR", "RoHS", "Full Engineering Drawing", "Energy Star Guide", "Technical Bulletin",
    "Submittal", "Compatibility Chart", "Size Chart", "Product Label/Insert",
    "Video Link", "Video Link 1", "Country Of Origin", "Discontinued", "Actual Image (Yes/No)"
])

def get_delivery_headers() -> List[str]:
    """Reads the exact 252 headers from the official template file or returns official list."""
    if os.path.exists(TEMPLATE_CSV):
        try:
            with open(TEMPLATE_CSV, mode='r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                headers = next(reader)
                if len(headers) == 252:
                    return headers
        except Exception:
            pass
    return OFFICIAL_252_HEADERS.copy()

def build_252_column_row(
    input_row: Dict[str, Any], 
    extracted_data: Dict[str, Any], 
    mfr_url: str = "", 
    ref_urls: Optional[List[str]] = None
) -> Dict[str, str]:
    """
    Builds a single dictionary keyed by the official 252 headers, combining 
    the raw catalog input row and the enriched/extracted data.
    """
    headers = get_delivery_headers()
    row_dict = {h: "" for h in headers}
    ref_urls = ref_urls or []
    
    # Extract identifiers
    raw_mpn = input_row.get("Mfg_Part_Num") or input_row.get("PART_NUMBER") or input_row.get("MANUFACTURER_PART_NUMBER") or ""
    mpn = extracted_data.get("Mfg_Part_Num") or extracted_data.get("MANUFACTURER_PART_NUMBER") or raw_mpn
    
    brand = (
        extracted_data.get("BRAND_NAME") or 
        extracted_data.get("canonical_brand") or 
        extracted_data.get("brand") or 
        input_row.get("BRAND_NAME") or 
        ""
    ).replace("Ar", "Â®").replace("Â®", "").strip()
    
    mfr = (
        extracted_data.get("MANUFACTURER_NAME") or 
        extracted_data.get("canonical_manufacturer") or 
        input_row.get("MANUFACTURER_NAME") or 
        input_row.get("Part_Manuf") or 
        brand
    )
    if "(" in str(mfr):
        mfr = mfr.split("(")[0].strip()
        
    prod_type = extracted_data.get("Product Name") or extracted_data.get("product_type") or "Tool Accessory"
    
    # 1. URLs
    row_dict["MFR URL"] = mfr_url or extracted_data.get("MFR URL", "")
    for idx, ref_url in enumerate(ref_urls[:5], start=1):
        row_dict[f"Ref URL {idx}"] = ref_url
    for idx in range(1, 6):
        if not row_dict.get(f"Ref URL {idx}"):
            row_dict[f"Ref URL {idx}"] = extracted_data.get(f"Ref URL {idx}", "")
            
    # 2. Identifiers & Input Taxonomy
    row_dict["PART_NUMBER"] = input_row.get("PART_NUMBER") or mpn
    row_dict["Dept"] = input_row.get("Dept", "")
    row_dict["Class"] = input_row.get("Class", "")
    row_dict["Fine"] = input_row.get("Fine", "")
    row_dict["SKU - MY_PART_NUMBER"] = input_row.get("SKU - MY_PART_NUMBER") or input_row.get("PART_NUMBER") or mpn
    row_dict["Mfg_Part_Num"] = input_row.get("Mfg_Part_Num") or mpn
    row_dict["Part_Desc"] = input_row.get("Part_Desc") or extracted_data.get("Part_Desc", "") or f"{brand} {mpn} {prod_type}".strip()
    row_dict["E1_Brand"] = input_row.get("E1_Brand", "")
    row_dict["Unilog_Brand"] = input_row.get("Unilog_Brand", "")
    row_dict["DIB_Brand"] = input_row.get("DIB_Brand", "")
    row_dict["Part_Manuf"] = input_row.get("Part_Manuf", "")
    row_dict["MANUFACTURER_NAME"] = mfr
    row_dict["BRAND_NAME"] = f"{brand}Â®" if brand else ""
    row_dict["TRADE_NAME"] = extracted_data.get("TRADE_NAME") or extracted_data.get("trade_name") or brand
    row_dict["MANUFACTURER_PART_NUMBER"] = mpn
    row_dict["ALTERNATE_PART_NUMBER"] = extracted_data.get("ALTERNATE_PART_NUMBER") or input_row.get("ALTERNATE_PART_NUMBER", "")
    row_dict["Classpath"] = extracted_data.get("Classpath") or input_row.get("Classpath") or f"Hardware & Tools > Industrial Supplies > {prod_type}s"
    
    # 3. 5 Synthesized Descriptions
    row_dict["MOBILE_DESC"] = (
        extracted_data.get("MOBILE_DESC") or 
        extracted_data.get("MOBILE_DESCRIPTION") or 
        extracted_data.get("mobile_description", "")
    )
    row_dict["INVOICE_DESC"] = (
        extracted_data.get("INVOICE_DESC") or 
        extracted_data.get("INVOICE_DESCRIPTION") or 
        extracted_data.get("invoice_description", "")
    )
    row_dict["SHORT_DESC"] = (
        extracted_data.get("SHORT_DESC") or 
        extracted_data.get("SHORT_DESCRIPTION") or 
        extracted_data.get("short_title", "")
    )
    row_dict["LONG_DESC1"] = (
        extracted_data.get("LONG_DESC1") or 
        extracted_data.get("LONG_DESCRIPTION 1") or 
        extracted_data.get("long_description", "")
    )
    row_dict["RETAIL_DESC"] = (
        extracted_data.get("RETAIL_DESC") or 
        extracted_data.get("RETAIL_DESCRIPTION") or 
        extracted_data.get("retail_description", "")
    )
    row_dict["MARKETING_DESCRIPTION"] = (
        extracted_data.get("MARKETING_DESCRIPTION") or 
        extracted_data.get("marketing_description", "")
    )
    
    # 4. Item Features (1..20)
    features_list = (
        extracted_data.get("key_features") or 
        extracted_data.get("item_features") or 
        []
    )
    if isinstance(features_list, str):
        features_list = [features_list]
    for i in range(1, 21):
        key_underscore = f"ITEM_FEATURES_{i}"
        key_space = f"ITEM_FEATURES {i}"
        val = ""
        if i-1 < len(features_list):
            val = str(features_list[i-1])
        elif key_underscore in extracted_data:
            val = str(extracted_data[key_underscore])
        elif key_space in extracted_data:
            val = str(extracted_data[key_space])
        row_dict[key_underscore] = val
        
    # 5. Core Specification & Classification Attributes
    row_dict["With"] = extracted_data.get("With") or extracted_data.get("with_statement", "")
    row_dict["Standard/Approvals"] = extracted_data.get("Standard/Approvals") or extracted_data.get("standards", "")
    row_dict["Prop 65"] = extracted_data.get("Prop 65", "")
    row_dict["Application"] = extracted_data.get("Application") or extracted_data.get("application", "")
    row_dict["Includes"] = extracted_data.get("Includes") or extracted_data.get("includes", "")
    row_dict["Product Name"] = prod_type
    
    # 6. Flatten Attribute Matrix (ATTRIBUTE_LABEL 1..50, ATTRIBUTE_VALUE 1..50, ATTRIBUTE_UOM 1..50)
    has_indexed_attrs = any(f"ATTRIBUTE_LABEL {i}" in extracted_data for i in range(1, 51))
    if has_indexed_attrs:
        for i in range(1, 51):
            row_dict[f"ATTRIBUTE_LABEL {i}"] = str(extracted_data.get(f"ATTRIBUTE_LABEL {i}", ""))
            row_dict[f"ATTRIBUTE_VALUE {i}"] = str(extracted_data.get(f"ATTRIBUTE_VALUE {i}", ""))
            row_dict[f"ATTRIBUTE_UOM {i}"] = str(extracted_data.get(f"ATTRIBUTE_UOM {i}", ""))
    else:
        attrs = extracted_data.get("attribute_matrix") or extracted_data.get("attributes") or {}
        idx = 1
        if isinstance(attrs, dict):
            for attr_key, attr_obj in attrs.items():
                if idx > 50:
                    break
                if isinstance(attr_obj, dict):
                    val = attr_obj.get("value", "")
                    uom = attr_obj.get("uom", "")
                else:
                    val = str(attr_obj)
                    uom = ""
                if val:
                    label = attr_key.replace("_", " ").title()
                    row_dict[f"ATTRIBUTE_LABEL {idx}"] = label
                    row_dict[f"ATTRIBUTE_VALUE {idx}"] = str(val)
                    row_dict[f"ATTRIBUTE_UOM {idx}"] = str(uom)
                    idx += 1
        elif isinstance(attrs, list):
            for item in attrs:
                if idx > 50:
                    break
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    label = str(item[0])
                    val = str(item[1])
                    uom = str(item[2]) if len(item) >= 3 else ""
                    row_dict[f"ATTRIBUTE_LABEL {idx}"] = label
                    row_dict[f"ATTRIBUTE_VALUE {idx}"] = val
                    row_dict[f"ATTRIBUTE_UOM {idx}"] = uom
                    idx += 1
                    
    # 7. Commercial & Packaging Fields
    row_dict["UPC"] = extracted_data.get("UPC") or input_row.get("UPC", "")
    row_dict["EAN"] = extracted_data.get("EAN") or input_row.get("EAN", "")
    row_dict["GTIN"] = extracted_data.get("GTIN") or input_row.get("GTIN", "")
    row_dict["UNSPSC"] = extracted_data.get("UNSPSC") or input_row.get("UNSPSC", "")
    row_dict["Warranty"] = extracted_data.get("Warranty", "")
    row_dict["List Price"] = extracted_data.get("List Price") or input_row.get("List Price", "")
    row_dict["Selling Qty"] = extracted_data.get("Selling Qty") or input_row.get("Selling Qty", "")
    row_dict["Selling UOM"] = extracted_data.get("Selling UOM") or input_row.get("Selling UOM", "")
    row_dict["Standard Packaging Information"] = extracted_data.get("Standard Packaging Information", "")
    row_dict["LENGTH"] = extracted_data.get("LENGTH") or extracted_data.get("length", "")
    row_dict["LENGTH_UOM"] = extracted_data.get("LENGTH_UOM", "")
    row_dict["HEIGHT"] = extracted_data.get("HEIGHT") or extracted_data.get("height", "")
    row_dict["HEIGHT_UOM"] = extracted_data.get("HEIGHT_UOM", "")
    row_dict["WIDTH"] = extracted_data.get("WIDTH") or extracted_data.get("width", "")
    row_dict["WIDTH_UOM"] = extracted_data.get("WIDTH_UOM", "")
    row_dict["WEIGHT"] = extracted_data.get("WEIGHT") or extracted_data.get("weight", "")
    row_dict["WEIGHT_UOM"] = extracted_data.get("WEIGHT_UOM", "")
    row_dict["VOLUME"] = extracted_data.get("VOLUME", "")
    row_dict["VOLUME_UOM"] = extracted_data.get("VOLUME_UOM", "")
    
    # 8. Digital Assets & Documents
    brand_slug = re.sub(r'[^A-Za-z0-9_]', '', (brand or mfr).upper().replace(" ", "_"))
    mpn_slug = re.sub(r'[^A-Za-z0-9_]', '', mpn.upper().replace(" ", "_").replace("-", "_"))
    prefix = f"{brand_slug}_{mpn_slug}" if brand_slug else mpn_slug
    
    row_dict["Product Image"] = extracted_data.get("Product Image") or f"{prefix}.jpg"
    for i in range(1, 5):
        row_dict[f"Alternate Image {i}"] = extracted_data.get(f"Alternate Image {i}", "")
    row_dict["Specification Sheet"] = extracted_data.get("Specification Sheet") or f"{prefix}_Specification_Sheet.pdf"
    row_dict["Actual Image (Yes/No)"] = extracted_data.get("Actual Image (Yes/No)") or "Yes"
    
    return row_dict

def sync_csv_to_excel(csv_path: str = "output.csv", excel_path: Optional[str] = None) -> str:
    """
    Reads output.csv and produces an Excel workbook (.xlsx) with styled headers, 
    frozen top row, and proper formatting for Excel.
    """
    if excel_path is None:
        excel_path = os.path.splitext(csv_path)[0] + ".xlsx"
        
    if not os.path.exists(csv_path) or os.path.getsize(csv_path) == 0:
        return excel_path
        
    try:
        import pandas as pd
        df = pd.read_csv(csv_path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
        
        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Delivery Format")
            worksheet = writer.sheets["Delivery Format"]
            
            try:
                from openpyxl.styles import Font, PatternFill, Alignment
                header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
                header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
                
                for cell in worksheet[1]:
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
                    
                worksheet.freeze_panes = "A2"
                worksheet.row_dimensions[1].height = 26
            except Exception:
                pass
                
        return excel_path
    except Exception as e:
        print(f"[WARN] Could not sync to Excel (.xlsx): {e}")
        return excel_path

def append_row_to_output_csv(row_dict: Dict[str, Any], output_path: str = "output.csv", sync_excel: bool = True) -> None:
    """
    Appends a 252-column row to output.csv. 
    If output.csv doesn't exist or is empty, writes the official 252 header line first with UTF-8 BOM.
    Also syncs to output.xlsx so the file can be opened directly in Microsoft Excel.
    """
    headers = get_delivery_headers()
    file_exists = os.path.exists(output_path) and os.path.getsize(output_path) > 0
    
    if not file_exists:
        with open(output_path, mode="w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
            writer.writeheader()
            writer.writerow(row_dict)
    else:
        with open(output_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
            writer.writerow(row_dict)
            
    if sync_excel:
        excel_path = os.path.splitext(output_path)[0] + ".xlsx"
        sync_csv_to_excel(output_path, excel_path)

def write_all_rows_to_output_csv(rows: List[Dict[str, Any]], output_path: str = "output.csv", sync_excel: bool = True) -> None:
    """
    Writes or overwrites output.csv with the official 252-column header and all provided rows.
    Also syncs to output.xlsx with styled formatting.
    """
    headers = get_delivery_headers()
    with open(output_path, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            
    if sync_excel:
        excel_path = os.path.splitext(output_path)[0] + ".xlsx"
        sync_csv_to_excel(output_path, excel_path)


