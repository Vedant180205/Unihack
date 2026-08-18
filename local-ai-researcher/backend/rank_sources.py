from urllib.parse import urlparse
from build_queries import resolve_brand

MARKETPLACE_DOMAINS = {
    "amazon.com", "ebay.com", "alibaba.com", "walmart.com",
}

def domain_of(url: str) -> str:
    return urlparse(url).netloc.replace("www.", "")

def looks_like_manufacturer_site(url: str, brand: str) -> bool:
    if not brand:
        return False
    brand_slug = brand.lower().split()[0]
    return brand_slug in domain_of(url).lower()

def rank_and_split(results: list[dict], part_desc: str, part_manuf: str, part_num: str):
    """Returns (mfr_url_or_None, ref_urls[:5]). Uses resolve_brand() so
    distributor-labeled Part_Manuf values don't misdirect the manufacturer match."""
    brand = resolve_brand(part_desc, part_manuf, part_num)

    filtered = [r for r in results if domain_of(r["url"]) not in MARKETPLACE_DOMAINS]

    mfr_candidates = [r for r in filtered if looks_like_manufacturer_site(r["url"], brand)]
    mfr_url = mfr_candidates[0]["url"] if mfr_candidates else None

    remaining = [r for r in filtered if r["url"] != mfr_url]
    remaining.sort(key=lambda r: part_num.lower() not in (r.get("content") or "").lower())

    # de-dupe
    seen, ref_urls = set(), []
    for r in remaining:
        if r["url"] not in seen:
            seen.add(r["url"])
            ref_urls.append(r["url"])

    return mfr_url, ref_urls[:5]