import csv
import sys
import asyncio
import json
import os
import glob

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from preprocessor import preprocess_catalog_row
from search_engine import find_manufacturer_domain, search_exact_product
from scraper import scrape_product_page
from extractor import process_scraped_file
from exporter import build_252_column_row, append_row_to_output_csv, write_all_rows_to_output_csv, sync_csv_to_excel

INPUT_CSV = os.path.join(
    os.path.dirname(BASE_DIR),
    "docs", "resources", "Unihack_ Sample Dataset - Input.csv"
)
OUTPUT_CSV = os.path.join(BASE_DIR, "output.csv")
OUTPUT_XLSX = os.path.join(BASE_DIR, "output.xlsx")

async def process_row(row: dict) -> dict:
    # 0. Preprocessing: Resolve true brand, strip distributor noise
    cleaned_info = preprocess_catalog_row(row)
    part_num = cleaned_info.get("mfg_part_num") or row.get("Mfg_Part_Num") or row.get("PART_NUMBER")
    manufacturer = cleaned_info.get("clean_brand") or cleaned_info.get("clean_manufacturer") or row.get("Part_Manuf")
    raw_mfg = row.get("Part_Manuf") or row.get("MANUFACTURER_NAME") or row.get("BRAND_NAME")
    
    if not part_num or not manufacturer:
        print(f"[ERROR] Missing Part Number or Manufacturer for row: {row}")
        return {}
        
    print(f"\n==========================================")
    print(f"Processing: {manufacturer} | {part_num}")
    print(f"Raw Input: {raw_mfg} | {row.get('Mfg_Part_Num')}")
    print(f"==========================================")
    
    output_text = f"--- INPUTS TAKEN FROM CSV ---\n"
    output_text += f"Manufacturer Name: {manufacturer}\n"
    output_text += f"Part Number / MPN: {part_num}\n"
    output_text += f"Raw Manufacturer String: {raw_mfg}\n\n"
    
    # 1. Discover Official Domain
    domain = find_manufacturer_domain(manufacturer)
    if not domain:
        print(f"[FAIL] Could not discover domain for {manufacturer}.")
        return {}
        
    output_text += f"--- DOMAIN DISCOVERY ---\n"
    output_text += f"Discovered Official Domain: {domain}\n\n"
        
    # 2. Search Product on Official Domain
    part_desc = cleaned_info.get("part_desc") or row.get("Part_Desc", "")
    search_res = search_exact_product(part_num, manufacturer, domain, part_desc=part_desc)
    if not search_res.get("success"):
        print(f"[FAIL] Could not find exact product page for {part_num}.")
        return {}
        
    url = search_res.get("url")
    output_text += f"--- EXACT PRODUCT URL DISCOVERED ---\n"
    output_text += f"URL: {url}\n\n"
    
    # 3. Scrape Product Page
    scrape_res = await scrape_product_page(url)
    if not scrape_res.get("success"):
        print(f"[FAIL] Could not scrape product page {url}.")
        return {}
        
    markdown = scrape_res.get("markdown", "")
    html_content = scrape_res.get("html", "")
    
    output_text += f"--- SCRAPED PAGE MARKDOWN (Crawl4AI Processed) ---\n"
    output_text += markdown
    
    clean_filename = (row.get("Mfg_Part_Num") or part_num).replace("/", "_").replace("\\", "_")
    out_filename_txt = os.path.join(BASE_DIR, f"scraped_output_{clean_filename}.txt")
    out_filename_html = os.path.join(BASE_DIR, f"scraped_output_{clean_filename}.html")
    out_filename_json = os.path.join(BASE_DIR, f"extracted_output_{clean_filename}.json")
    
    with open(out_filename_txt, 'w', encoding='utf-8') as f:
        f.write(output_text)
        
    with open(out_filename_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"\n--- Scrape Success! ---")
    print(f"Saved text report to {out_filename_txt}")
    print(f"Saved RAW UNPROCESSED HTML to {out_filename_html}")
    
    # 4. Neural Extraction (Groq Agent / extractor.py)
    print(f"\n--- Running Neural Extraction (Groq Agent) ---")
    delivery_json = process_scraped_file(out_filename_txt)
    
    with open(out_filename_json, 'w', encoding='utf-8') as f:
        json.dump(delivery_json, f, indent=2)
        
    # 5. Map to Official 252-Column Schema & Write to output.csv and output.xlsx
    final_252_row = build_252_column_row(
        input_row=row,
        extracted_data=delivery_json,
        mfr_url=url,
        ref_urls=[url]
    )
    append_row_to_output_csv(final_252_row, OUTPUT_CSV, sync_excel=True)
    
    print(f"[+] Saved 252-column delivery JSON to {out_filename_json}")
    print(f"[+] Appended 252-column row to {OUTPUT_CSV}")
    print(f"[+] Synced Excel workbook to {OUTPUT_XLSX}")
    print(f"[+] INVOICE_DESC: {final_252_row.get('INVOICE_DESC')}")
    print(f"[+] MOBILE_DESC : {final_252_row.get('MOBILE_DESC')}")
    print(f"[+] SHORT_DESC  : {final_252_row.get('SHORT_DESC')}")
    print(f"[+] Confidence  : {delivery_json.get('confidence_score', 'N/A')}%")
    
    return final_252_row

def export_all_saved_jsons_to_output():
    """Finds all extracted_output_*.json files in the backend folder and writes them to output.csv & output.xlsx."""
    json_files = glob.glob(os.path.join(BASE_DIR, "extracted_output_*.json"))
    if not json_files:
        print("[INFO] No extracted JSON files found.")
        return
        
    print(f"[*] Found {len(json_files)} extracted JSON files. Compiling into {OUTPUT_CSV} & {OUTPUT_XLSX}...")
    
    # Read catalog input rows to map input fields
    input_rows_by_mpn = {}
    if os.path.exists(INPUT_CSV):
        with open(INPUT_CSV, mode="r", encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                mpn = r.get("Mfg_Part_Num") or r.get("PART_NUMBER")
                if mpn:
                    input_rows_by_mpn[mpn.strip()] = r
                    
    compiled_rows = []
    for jf in json_files:
        try:
            with open(jf, "r", encoding="utf-8") as f:
                extracted = json.load(f)
            mpn = extracted.get("Mfg_Part_Num") or extracted.get("PART_NUMBER") or extracted.get("MANUFACTURER_PART_NUMBER") or ""
            input_row = input_rows_by_mpn.get(mpn, {
                "Mfg_Part_Num": mpn,
                "PART_NUMBER": mpn,
                "Part_Desc": extracted.get("Part_Desc", "")
            })
            row_252 = build_252_column_row(
                input_row=input_row,
                extracted_data=extracted,
                mfr_url=extracted.get("MFR URL", ""),
                ref_urls=[extracted.get("MFR URL", "")] if extracted.get("MFR URL") else []
            )
            compiled_rows.append(row_252)
        except Exception as e:
            print(f"[WARN] Failed processing {jf}: {e}")
            
    if compiled_rows:
        write_all_rows_to_output_csv(compiled_rows, OUTPUT_CSV, sync_excel=True)
        print(f"[SUCCESS] Wrote {len(compiled_rows)} rows to {OUTPUT_CSV} and {OUTPUT_XLSX}!")

async def run_pipeline(limit=1, skip=0):
    if not os.path.exists(INPUT_CSV):
        print(f"[ERROR] Input file not found: {INPUT_CSV}")
        return

    with open(INPUT_CSV, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        count = 0
        processed = 0
        for row in reader:
            if count < skip:
                count += 1
                continue
            if processed >= limit:
                break
            await process_row(row)
            count += 1
            processed += 1

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--export-saved":
        export_all_saved_jsons_to_output()
    else:
        limit = 1
        skip = 0
        if len(sys.argv) > 1:
            try:
                limit = int(sys.argv[1])
            except ValueError:
                pass
        if len(sys.argv) > 2:
            try:
                skip = int(sys.argv[2])
            except ValueError:
                pass
                
        asyncio.run(run_pipeline(limit=limit, skip=skip))


