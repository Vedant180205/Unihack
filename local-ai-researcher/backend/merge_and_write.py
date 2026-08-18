import csv
from schema import OUTPUT_COLUMNS, PASSTHROUGH_FROM_INPUT

def merge_row(input_row: dict, mfr_url, ref_urls, doc_links, images, extracted: dict) -> dict:
    row = {col: "" for col in OUTPUT_COLUMNS}

    for out_col, in_col in PASSTHROUGH_FROM_INPUT.items():
        row[out_col] = input_row.get(in_col, "")

    for field, value in extracted.items():
        if field in row and field != "attributes":
            row[field] = value

    for i, attr in enumerate(extracted.get("attributes", [])[:50], start=1):
        row[f"ATTRIBUTE_LABEL {i}"] = attr.get("label", "")
        row[f"ATTRIBUTE_VALUE {i}"] = attr.get("value", "")
        row[f"ATTRIBUTE_UOM {i}"] = attr.get("uom", "")

    row["MFR URL"] = mfr_url or ""
    for i, url in enumerate(ref_urls[:5], start=1):
        row[f"Ref URL {i}"] = url

    for field, url in doc_links.items():
        row[field] = url
    if images:
        row["Product Image"] = images[0]
        for i, img in enumerate(images[1:5], start=1):
            row[f"Alternate Image {i}"] = img

    return row

def write_rows(rows: list[dict], out_path: str):
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)