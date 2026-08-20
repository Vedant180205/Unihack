import requests
from urllib.parse import urlparse
import time
import re
from typing import Dict, Any, List, Optional
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

SEARXNG_URL = "http://localhost:8080/search"

BANNED_DOMAINS = [
    "amazon.", "homedepot.", "lowes.", "ebay.", "walmart.", 
    "grainger.", "mcmaster.", "wayfair.", "target.", "aliexpress.", 
    "clockonline.", "menards.", "acehardware."
]

def is_banned_domain(url_or_domain: str) -> bool:
    clean = url_or_domain.lower()
    return any(banned in clean for banned in BANNED_DOMAINS)

def sanitize_mpn(mpn: str) -> str:
    """Removes special characters to improve search reliability."""
    return re.sub(r'[^A-Za-z0-9]', '', mpn)

def execute_search_query(query: str, max_results: int = 8) -> List[Dict[str, str]]:
    """
    Executes search with ultra-fast direct DDGS and SearXNG fallback.
    """
    results = []
    
    # 1. Primary: Direct ultra-fast DDGS
    try:
        ddgs = DDGS()
        raw_results = list(ddgs.text(query, max_results=max_results))
        for r in raw_results:
            results.append({
                "url": r.get("href", ""),
                "title": r.get("title", ""),
                "content": r.get("body", "")
            })
        if results:
            return results
    except Exception:
        pass
        
    # 2. Fallback: Local SearXNG
    try:
        resp = requests.get(SEARXNG_URL, params={"q": query, "format": "json"}, timeout=3)
        if resp.status_code == 200:
            for r in resp.json().get("results", []):
                results.append({
                    "url": r.get("url", ""),
                    "title": r.get("title", ""),
                    "content": r.get("content", "")
                })
    except Exception:
        pass
        
    return results

def compute_candidate_score(result: Dict[str, Any], target_domain: str, mpn: str, brand: str, part_desc: str) -> float:
    """
    Computes a composite relevance score (0.0 to 1.0) for a search candidate URL.
    """
    url = result.get("url", "").lower()
    title = result.get("title", "").lower()
    content = result.get("content", "").lower()
    
    if is_banned_domain(url):
        return 0.0
        
    parsed = urlparse(url)
    path = parsed.path.strip().lower()
    
    # Reject portals, carts, logins, homepages
    if any(ignore in url for ignore in ["/login", "/signin", "/cart", "/checkout", "/account", "/store/"]):
        return 0.0
    if path in ["", "/", "/index.html", "/en-us/", "/en_us/", "/en-us", "/en_us", "/3m/en_us/p/", "/3m/en_us/p", "/p/", "/p"]:
        return 0.0
    if path.endswith("/p/") or path.endswith("/p") or path.endswith("/category/") or path.endswith("/categories/"):
        return 0.0
        
    score = 0.0
    
    # 1. Domain Match Weight (35%)
    netloc = parsed.netloc.replace("www.", "")
    if target_domain and (target_domain in netloc or netloc in target_domain):
        score += 0.35
        
    # 2. Exact MPN Match Weight (45%)
    clean_mpn = sanitize_mpn(mpn).lower()
    if clean_mpn and len(clean_mpn) >= 3:
        if clean_mpn in sanitize_mpn(url) or clean_mpn in sanitize_mpn(title) or clean_mpn in sanitize_mpn(content):
            score += 0.45
            
    # 3. Semantic Token Overlap from Description & Brand (30%)
    query_text = f"{brand} {part_desc}".lower()
    tokens = set(re.findall(r'\b[a-zA-Z0-9]{3,}\b', query_text))
    stopwords = {"and", "the", "for", "with", "inc", "llc", "box", "pack", "disc", "belt"}
    meaningful_tokens = [t for t in tokens if t not in stopwords]
    
    if meaningful_tokens:
        page_blob = f"{url} {title} {content}"
        matches = sum(1 for tok in meaningful_tokens if tok in page_blob)
        token_ratio = matches / len(meaningful_tokens)
        score += token_ratio * 0.30
        
    # Bonus for official product detail page paths (/products/, /p/d/, /p/dc/, /item/, /detail/, .pdf)
    if any(path_indicator in url for path_indicator in ["/p/d/", "/p/dc/", "/products/", "/product/", "/item/", "/details/", ".pdf"]):
        score += 0.20
        
    return min(1.0, round(score, 3))

def find_manufacturer_domain(manufacturer: str) -> str:
    """
    Step 1: Discover the official manufacturer domain dynamically.
    """
    mfr_lower = manufacturer.lower()
    if "diablo" in mfr_lower:
        return "diablotools.com"
    if "freud" in mfr_lower:
        return "diablotools.com"
    if mfr_lower in ["3m", "3m abrasives"]:
        return "3m.com"
    if "milwaukee" in mfr_lower:
        return "milwaukeetool.com"
    if "mirka" in mfr_lower:
        return "mirka.com"
    if "frigidaire" in mfr_lower:
        return "frigidaire.com"
    if "ge" in mfr_lower or "general electric" in mfr_lower:
        return "geappliances.com"
        
    query = f"{manufacturer} official website"
    results = execute_search_query(query, max_results=5)
    
    for res in results:
        url = res.get("url", "")
        if not url or is_banned_domain(url):
            continue
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "").lower()
        print(f"[INFO] Discovered official domain for {manufacturer}: {domain}")
        return domain
        
    print(f"[WARN] No valid domain found for {manufacturer}")
    return ""

def search_exact_product(mpn: str, manufacturer: str, domain: str, part_desc: str = "") -> dict:
    """
    Step 2: Discovers and ranks candidate product URLs using composite semantic scoring.
    """
    candidates = []
    desc_words = [w for w in re.findall(r'\b[a-zA-Z0-9]{3,}\b', part_desc) if w.lower() not in ["and", "the", "for", "with", "box", "pack", "inc", "llc"]]
    
    queries = []
    if domain:
        if desc_words:
            queries.append(f'site:{domain} {" ".join(desc_words[:4])}')
        queries.append(f'site:{domain} "{mpn}"')
        queries.append(f'site:{domain} {mpn}')
            
    if desc_words:
        queries.append(f'"{manufacturer}" {" ".join(desc_words[:3])} official')
    queries.append(f'"{manufacturer}" "{mpn}" official')
    
    for query in queries:
        results = execute_search_query(query, max_results=5)
        for result in results:
            score = compute_candidate_score(result, domain, mpn, manufacturer, part_desc)
            if score >= 0.35:
                candidates.append((score, result))
                
    if not candidates:
        print(f"[WARN] No validated manufacturer URL found for {mpn} on {domain}")
        return {"success": False, "url": None, "reason": "No validated manufacturer URL found"}
        
    # Sort candidates by relevance score descending
    candidates.sort(key=lambda x: x[0], reverse=True)
    best_score, best_res = candidates[0]
    best_url = best_res.get("url")
    
    print(f"[SUCCESS] Top Candidate Selected (Score: {best_score}): {best_url}")
    return {
        "success": True,
        "url": best_url,
        "title": best_res.get("title"),
        "snippet": best_res.get("content"),
        "relevance_score": best_score
    }
