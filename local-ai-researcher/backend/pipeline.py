import asyncio, csv, json, os
from search import search
from build_queries import build_queries
from rank_sources import rank_and_split
from crawl_sources import crawl_sources
from extract_fields import extract_fields
from merge_and_write import merge_row
from schema import OUTPUT_COLUMNS

INPUT_CSV = "Unihack__Sample_Dataset_-_Input.csv"
OUTPUT_CSV = "output.csv"
CHECKPOINT = "done_part_nums.json"
CONCURRENCY = 4  # tune to your CPU/RAM - each slot runs a headless browser

def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        return set(json.load(open(CHECKPOINT)))
    return set()

def save_checkpoint(done: set):
    json.dump(list(done), open(CHECKPOINT, "w"))

async def process_row(input_row: dict) -> dict:
    part_num = input_row["Mfg_Part_Num"]
    manufacturer = input_row["Part_Manuf"]
    desc = input_row["Part_Desc"]

    queries = build_queries(part_num, desc, manufacturer)
    all_results = []
    for q in queries:
        all_results.extend(search(q, limit=5))

    mfr_url, ref_urls = rank_and_split(all_results, desc, manufacturer, part_num)
    urls_to_crawl = ([mfr_url] if mfr_url else []) + ref_urls
    crawled = await crawl_sources(urls_to_crawl) if urls_to_crawl else []

    extracted = extract_fields(part_num, desc, manufacturer, crawled)

    doc_links, images = {}, []
    for page in crawled:
        if page.get("success"):
            doc_links.update(page.get("doc_links", {}))
            images.extend(page.get("images", []))

    return merge_row(input_row, mfr_url, ref_urls, doc_links, images, extracted)

async def run(limit=None):
    done = load_checkpoint()
    write_header = not os.path.exists(OUTPUT_CSV)

    with open(INPUT_CSV, newline="") as f_in:
        rows = [r for r in csv.DictReader(f_in) if r["Mfg_Part_Num"] not in done]
    if limit:
        rows = rows[:limit]

    with open(OUTPUT_CSV, "a", newline="") as f_out:
        writer = csv.DictWriter(f_out, fieldnames=OUTPUT_COLUMNS)
        if write_header:
            writer.writeheader()

        sem = asyncio.Semaphore(CONCURRENCY)

        async def worker(row):
            async with sem:
                try:
                    result = await process_row(row)
                    writer.writerow(result)
                    f_out.flush()
                    done.add(row["Mfg_Part_Num"])
                    save_checkpoint(done)
                    print(f"[OK] {row['Mfg_Part_Num']}")
                except Exception as e:
                    print(f"[FAIL] {row['Mfg_Part_Num']}: {e}")

        await asyncio.gather(*(worker(r) for r in rows))

if __name__ == "__main__":
    import sys
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    asyncio.run(run(limit=limit))