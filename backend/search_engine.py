import requests
from urllib.parse import urlparse
import time
import re

SEARXNG_URL = "http://localhost:8080/search"

def sanitize_mpn(mpn: str) -> str:
    """Removes special characters to improve search reliability."""
    return re.sub(r'[^A-Za-z0-9]', '', mpn)

def find_manufacturer_domain(manufacturer: str) -> str:
    """
    Step 1: Find the official domain for the manufacturer.
    We query SearXNG for the manufacturer name and pick the top result.
    """
    query = f"{manufacturer} official site"
    params = {
        "q": query,
        "format": "json",
        "engines": "google,bing,duckduckgo",
        "language": "en"
    }
    
    try:
        resp = requests.get(SEARXNG_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        
        results = data.get("results", [])
        if not results:
            print(f"[WARN] No domain found for {manufacturer}")
            return ""
            
        # The top result's domain is highly likely to be the official site
        top_url = results[0].get("url", "")
        parsed = urlparse(top_url)
        
        # Strip 'www.' to get the base domain (e.g., 'milwaukeetool.com')
        domain = parsed.netloc.replace("www.", "")
        print(f"[INFO] Discovered official domain for {manufacturer}: {domain}")
        return domain
        
    except Exception as e:
        print(f"[ERROR] Failed to find domain for {manufacturer}: {e}")
        return ""

def search_exact_product(mpn: str, manufacturer: str, domain: str) -> dict:
    """
    Step 2: Find the exact product page on the manufacturer's site.
    We strictly search within the discovered domain and validate the snippet.
    """
    if not domain:
        return {"success": False, "url": None, "reason": "No domain provided"}
        
    # We use exact quotes around the MPN and restrict the search to the domain
    query = f'site:{domain} "{mpn}"'
    params = {
        "q": query,
        "format": "json",
        "engines": "google,bing,duckduckgo",
        "language": "en"
    }
    
    clean_mpn = sanitize_mpn(mpn).lower()
    
    try:
        print(f"[INFO] Searching: {query}")
        resp = requests.get(SEARXNG_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        
        for result in data.get("results", []):
            url = result.get("url", "")
            title = result.get("title", "").lower()
            content = result.get("content", "").lower()
            
            # Validation Rule: The exact MPN (or stripped MPN) MUST be present in the title, url, or snippet
            if clean_mpn in sanitize_mpn(title).lower() or clean_mpn in sanitize_mpn(content).lower() or clean_mpn in sanitize_mpn(url).lower():
                print(f"[SUCCESS] Exact Match Found: {url}")
                return {
                    "success": True,
                    "url": url,
                    "title": result.get("title"),
                    "snippet": result.get("content")
                }
                
        print(f"[WARN] No perfectly matching URL found for {mpn} on {domain}")
        return {"success": False, "url": None, "reason": "Failed strict MPN validation"}
        
    except Exception as e:
        print(f"[ERROR] Product search failed for {mpn}: {e}")
        return {"success": False, "url": None, "reason": str(e)}

if __name__ == "__main__":
    # Quick Test
    test_mfg = "Milwaukee"
    test_mpn = "49-94-0013"
    
    print("--- Testing Discovery Engine ---")
    domain = find_manufacturer_domain(test_mfg)
    if domain:
        time.sleep(1) # Rate limit protection
        result = search_exact_product(test_mpn, test_mfg, domain)
        print("Result:", result)
