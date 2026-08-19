import csv
import sys
import asyncio
from search_engine import find_manufacturer_domain, search_exact_product
from scraper import scrape_product_page

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
        
    print(f"\n--- Pipeline Success! ---")
    print(f"Saved text report to {out_filename_txt}")
    print(f"Saved RAW UNPROCESSED HTML to {out_filename_html}")

async def run_pipeline(limit=1):
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
    limit = 1
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass
            
    asyncio.run(run_pipeline(limit=limit))
