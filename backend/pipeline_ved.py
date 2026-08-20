import csv
import sys
import asyncio
import json
from search_engine import find_manufacturer_domain, search_exact_product
from scraper import scrape_product_page
from extractor import process_scraped_file

INPUT_CSV = r"..\docs\resources\Unihack_ Sample Dataset - Input.csv"

async def process_row(row):
    part_num = row.get("Mfg_Part_Num") or row.get("PART_NUMBER") or row.get("MANUFACTURER_PART_NUMBER")
    raw_mfg = row.get("Part_Manuf") or row.get("MANUFACTURER_NAME") or row.get("BRAND_NAME")
    manufacturer = raw_mfg.split("(")[0].strip() if raw_mfg else None
    
    if not part_num or not manufacturer:
        print(f"[ERROR] Missing Part Number or Manufacturer for row: {row}")
        return
        
    print(f"\n==========================================")
    print(f"Processing: {manufacturer} | {part_num}")
    print(f"==========================================")
    
    output_text = f"--- INPUTS TAKEN FROM CSV ---\n"
    output_text += f"Manufacturer Name: {manufacturer}\n"
    output_text += f"Part Number / MPN: {part_num}\n"
    output_text += f"Raw Manufacturer String: {raw_mfg}\n\n"
    
    # 1. Discover Domain
    domain = find_manufacturer_domain(manufacturer)
    if not domain:
        print("[FAIL] Could not discover domain.")
        return
        
    output_text += f"--- DOMAIN DISCOVERY ---\n"
    output_text += f"Discovered Official Domain: {domain}\n\n"
        
    # 2. Search Product on Domain
    search_res = search_exact_product(part_num, manufacturer, domain)
    if not search_res.get("success"):
        print("[FAIL] Could not find exact product page.")
        return
        
    url = search_res.get("url")
    output_text += f"--- EXACT PRODUCT URL DISCOVERED ---\n"
    output_text += f"URL: {url}\n\n"
    
    # 3. Scrape Product Page
    scrape_res = await scrape_product_page(url)
    if not scrape_res.get("success"):
        print("[FAIL] Could not scrape product page.")
        return
        
    markdown = scrape_res.get("markdown", "")
    html_content = scrape_res.get("html", "")
    
    output_text += f"--- SCRAPED PAGE MARKDOWN (Crawl4AI Processed) ---\n"
    output_text += markdown
    
    out_filename_txt = f"scraped_output_{part_num}.txt".replace("/", "_")
    out_filename_html = f"scraped_output_{part_num}.html".replace("/", "_")
    
    with open(out_filename_txt, 'w', encoding='utf-8') as f:
        f.write(output_text)
        
    with open(out_filename_html, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"\n--- Scrape Success! ---")
    print(f"Saved text report to {out_filename_txt}")
    print(f"Saved RAW UNPROCESSED HTML to {out_filename_html}")

    # 4. Phase 3 Neural Extraction (NuExtract GGUF / extractor.py)
    print(f"\n--- Running Local Neural Extraction ---")
    try:
        delivery_json = process_scraped_file(out_filename_txt)
        
        out_filename_json = f"extracted_output_{part_num}.json".replace("/", "_")
        with open(out_filename_json, 'w', encoding='utf-8') as f:
            json.dump(delivery_json, f, indent=2)
            
        print(f"[+] Saved 252-column delivery JSON to {out_filename_json}")
        print(f"[+] INVOICE_DESC: {delivery_json.get('INVOICE_DESCRIPTION')}")
        print(f"[+] MOBILE_DESC : {delivery_json.get('MOBILE_DESCRIPTION')}")
        print(f"[+] SHORT_TITLE : {delivery_json.get('SHORT_DESCRIPTION')}")
        print(f"[+] Confidence  : {delivery_json.get('confidence_score')}%")
    except Exception as e:
        print(f"[ERROR] Extraction failed: {e}")

async def run_pipeline(limit=1, skip=0):
    try:
        with open(INPUT_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                if count < skip:
                    count += 1
                    continue
                if count >= skip + limit:
                    break
                await process_row(row)
                count += 1
    except FileNotFoundError:
        print(f"[ERROR] Input file not found: {INPUT_CSV}")

if __name__ == "__main__":
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




