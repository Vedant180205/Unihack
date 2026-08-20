import csv
import sys
import asyncio
import json
from preprocessor import preprocess_catalog_row
from search_engine import find_manufacturer_domain, search_exact_product
from scraper import scrape_product_page
from extractor import process_scraped_file

INPUT_CSV = r"..\docs\resources\Unihack_ Sample Dataset - Input.csv"

async def process_row(row):
    # 0. Preprocessing: Resolve true brand, strip distributor noise
    cleaned_info = preprocess_catalog_row(row)
    part_num = cleaned_info.get("mfg_part_num") or row.get("Mfg_Part_Num") or row.get("PART_NUMBER")
    manufacturer = cleaned_info.get("clean_brand") or cleaned_info.get("clean_manufacturer") or row.get("Part_Manuf")
    raw_mfg = row.get("Part_Manuf") or row.get("MANUFACTURER_NAME") or row.get("BRAND_NAME")
    
    if not part_num or not manufacturer:
        print(f"[ERROR] Missing Part Number or Manufacturer for row: {row}")
        return
        
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
        return
        
    output_text += f"--- DOMAIN DISCOVERY ---\n"
    output_text += f"Discovered Official Domain: {domain}\n\n"
        
    # 2. Search Product on Official Domain
    part_desc = cleaned_info.get("part_desc") or row.get("Part_Desc", "")
    search_res = search_exact_product(part_num, manufacturer, domain, part_desc=part_desc)
    if not search_res.get("success"):
        print(f"[FAIL] Could not find exact product page for {part_num}.")
        return
        
    url = search_res.get("url")
    output_text += f"--- EXACT PRODUCT URL DISCOVERED ---\n"
    output_text += f"URL: {url}\n\n"
    
    # 3. Scrape Product Page with Playwright
    scrape_res = await scrape_product_page(url)
    if not scrape_res.get("success"):
        print(f"[FAIL] Could not scrape product page {url}.")
        return
        
    markdown = scrape_res.get("markdown", "")
    html_content = scrape_res.get("html", "")
    
    output_text += f"--- SCRAPED PAGE MARKDOWN (Crawl4AI Processed) ---\n"
    output_text += markdown
    
    clean_filename = (row.get("Mfg_Part_Num") or part_num).replace("/", "_").replace("\\", "_")
    out_filename_txt = f"scraped_output_{clean_filename}.txt"
    out_filename_html = f"scraped_output_{clean_filename}.html"
    out_filename_json = f"extracted_output_{clean_filename}.json"
    
    with open(out_filename_txt, 'w', encoding='utf-8') as f:
        f.write(output_text)
        
    with open(out_filename_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"\n--- Scrape Success! ---")
    print(f"Saved text report to {out_filename_txt}")
    print(f"Saved RAW UNPROCESSED HTML to {out_filename_html}")
    
    # 4. Phase 3 Neural Extraction (NuExtract GGUF / extractor.py)
    print(f"\n--- Running Local Neural Extraction (NuExtract GGUF) ---")
    delivery_json = process_scraped_file(out_filename_txt)
    
    with open(out_filename_json, 'w', encoding='utf-8') as f:
        json.dump(delivery_json, f, indent=2)
        
    print(f"[+] Saved 252-column delivery JSON to {out_filename_json}")
    print(f"[+] INVOICE_DESC: {delivery_json.get('INVOICE_DESCRIPTION')}")
    print(f"[+] MOBILE_DESC : {delivery_json.get('MOBILE_DESCRIPTION')}")
    print(f"[+] SHORT_TITLE : {delivery_json.get('SHORT_DESCRIPTION')}")
    print(f"[+] Confidence  : {delivery_json.get('confidence_score')}%")

async def run_pipeline(limit=2):
    try:
        with open(INPUT_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                if count >= limit:
                    break
                await process_row(row)
                count += 1
    except FileNotFoundError:
        print(f"[ERROR] Input file not found: {INPUT_CSV}")

if __name__ == "__main__":
    limit = 2
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass
            
    asyncio.run(run_pipeline(limit=limit))
