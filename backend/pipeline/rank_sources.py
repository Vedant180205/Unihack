from urllib.parse import urlparse

MARKETPLACE_DOMAINS = {
    "amazon.com", "ebay.com", "alibaba.com", "walmart.com",
}

def domain_of(url: str) -> str:
    return urlparse(url).netloc.replace("www.", "")

def rank_and_split(results: list[dict], part_desc: str, part_manuf: str, part_num: str, official_domain: str = ""):
    """
    Filters marketplaces, then finds the manufacturer's official URL.
    VERIFICATION: It enforces that the exact part_num is present in the URL, Title, or Snippet 
    before declaring it the official product page.
    """
    filtered = [r for r in results if domain_of(r["url"]) not in MARKETPLACE_DOMAINS]
    
    mfr_candidates = []
    if official_domain:
        mfr_candidates = [r for r in filtered if official_domain in domain_of(r["url"])]
    else:
        brand_slug = part_manuf.lower().split()[0]
        mfr_candidates = [r for r in filtered if brand_slug in domain_of(r["url"]).lower()]
        
    mfr_url = None
    target_pnum = part_num.lower()
    
    # Verification step
    for cand in mfr_candidates:
        title = (cand.get("title") or "").lower()
        url = (cand.get("url") or "").lower()
        content = (cand.get("content") or "").lower()
        
        # We only accept it if the part number is explicitly found
        if target_pnum in title or target_pnum in url or target_pnum in content:
            mfr_url = cand["url"]
            break
            
    remaining = [r for r in filtered if r["url"] != mfr_url]
    remaining.sort(key=lambda r: target_pnum not in (r.get("content") or "").lower())
    
    # de-dupe
    seen, ref_urls = set(), []
    for r in remaining:
        if r["url"] not in seen:
            seen.add(r["url"])
            ref_urls.append(r["url"])

    return mfr_url, ref_urls[:5]