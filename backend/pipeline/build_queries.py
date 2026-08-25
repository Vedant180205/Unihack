import re

# Part_Manuf in this dataset is often the DISTRIBUTOR/seller of record, not
# the actual product brand (e.g. "Jam Industrial Supply LLC" selling 3M
# product, "U S Lumber" selling Boise Cascade product). If the value looks
# like a distributor, don't use it as the manufacturer for search - fall
# back to the leading brand token in Part_Desc instead.
DISTRIBUTOR_KEYWORDS = [
    "supply", "distributor", "distributing", "cooperative", "wholesale",
    "building materials", "lumber", "dealers", "industrial supply",
    "cascade", "parksite",
]

def clean_manufacturer(raw: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()

def looks_like_distributor(name: str) -> bool:
    lname = name.lower()
    return any(kw in lname for kw in DISTRIBUTOR_KEYWORDS)

def guess_brand_from_desc(part_desc: str, mfg_part_num: str) -> str:
    """Fallback: the token right after the part number in Part_Desc is
    usually the brand, e.g. 'DCB518ASTS06G Diablo 1/2...' -> 'Diablo'."""
    desc = part_desc
    if desc.startswith(mfg_part_num):
        desc = desc[len(mfg_part_num):].strip()
    tokens = desc.split()
    return tokens[0] if tokens else ""

def resolve_brand(part_desc: str, part_manuf: str, mfg_part_num: str) -> str:
    mfr = clean_manufacturer(part_manuf)
    if not mfr or mfr == "-" or looks_like_distributor(mfr):
        fallback = guess_brand_from_desc(part_desc, mfg_part_num)
        return fallback or mfr
    return mfr

def build_queries(mfg_part_num: str, part_desc: str, part_manuf: str, domain: str = "") -> list[str]:
    # Since the exact manufacturer is provided, we use it directly
    brand = clean_manufacturer(part_manuf) or part_manuf
    
    # Grab a few key terms from the description for disambiguation
    key_terms = " ".join(part_desc.split()[:4])
    
    if domain:
        return [
            f'site:{domain} "{mfg_part_num}"',
            f'site:{domain} "{mfg_part_num}" {key_terms}',
            f'site:{domain} "{mfg_part_num}" specification'
        ]
        
    return [
        f'"{mfg_part_num}" {brand}',
        f'"{mfg_part_num}" {brand} {key_terms}',
        f'"{mfg_part_num}" {brand} specification'
    ]

if __name__ == "__main__":
    import csv
    with open("Unihack__Sample_Dataset_-_Input.csv", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    for i in [0, 1, 6, 20, 84]:  # spread across the file, not just the top
        row = rows[i]
        brand = resolve_brand(row["Part_Desc"], row["Part_Manuf"], row["Mfg_Part_Num"])
        print(f"\nROW {i+1}: {row['Mfg_Part_Num']}")
        print(f"  Part_Manuf field : {row['Part_Manuf']}")
        print(f"  Resolved brand   : {brand}")
        for q in build_queries(row["Mfg_Part_Num"], row["Part_Desc"], row["Part_Manuf"]):
            print("  query ->", q)