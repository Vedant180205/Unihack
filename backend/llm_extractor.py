import os
import requests
from bs4 import BeautifulSoup
from googlesearch import search
from google import genai
from google.genai import types
from groq import Groq
import json
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# We grab our Graph rules to enforce constraints
from rules import get_category_schema, build_pydantic_model_for_category

# ---------------------------------------------------------
# The Hybrid RAG Engine
# ---------------------------------------------------------
def search_manufacturer_specs(mfg_part_num: str, brand: str) -> Optional[str]:
    """
    Searches the web for the specs. If Google/DuckDuckGo block our IP (Cloudflare),
    we fall back to standard URL pattern generation (very reliable for Hackathons).
    """
    query = f"{brand} {mfg_part_num} specifications"
    print(f"[*] Searching web for: '{query}'")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36'}
        res = requests.post("https://html.duckduckgo.com/html/", data={"q": query}, headers=headers, timeout=5)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        for a in soup.find_all('a', class_='result__url'):
            href = a.get('href')
            if href and "http" in href:
                return href
    except Exception:
        pass
        
    # --- Hackathon Fallback (Bypasses Anti-Bot Blocks) ---
    print("[!] Search engine blocked the request. Falling back to direct URL generation...")
    brand_clean = brand.upper()
    if "FRIGIDAIRE" in brand_clean:
        return f"https://www.frigidaire.com/en/p/owner-center/product-support/{mfg_part_num}"
    elif "WHIRLPOOL" in brand_clean:
        return f"https://www.whirlpool.com/search.html?term={mfg_part_num}"
        
    return None

import asyncio
from crawl4ai import AsyncWebCrawler

async def crawl_text_from_url(url: str) -> str:
    """
    Downloads the page using a headless Chromium browser (Playwright) to render 
    all Javascript, then converts the content into clean Markdown.
    """
    if not url: return ""
    print(f"[*] Scraping specs using Crawl4AI (Stealth Mode) from: {url}")
    try:
        # magic=True enables Crawl4AI's stealth mode to bypass Cloudflare and Datadome
        async with AsyncWebCrawler(verbose=True, magic=True) as crawler:
            result = await crawler.arun(url=url)
            return result.markdown[:10000] # Cap context limit
    except Exception as e:
        print(f"[!] Crawl4AI scraping failed for {url}: {e}")
        return ""

def extract_attributes_with_gemini(scraped_text: str, category_schema: dict, dynamic_model_class):
    """
    Feeds the scraped text into Gemini Flash Lite and guarantees strict JSON output.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[!] GEMINI_API_KEY missing, skipping Gemini extraction.")
        return None
        
    client = genai.Client(api_key=api_key)
    model = "gemini-3.5-flash-lite"
    
    prompt = f"""
    You are a strict product data extraction AI.
    Read the following manufacturer product specifications.
    Extract the attributes defined in the schema.
    If an attribute is not explicitly stated in the text, you MUST return null. Do not guess.
    
    Category Constraints:
    {category_schema}
    
    Manufacturer Text:
    {scraped_text}
    """

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]
    
    # Enforce Pydantic Output using the new SDK
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=dynamic_model_class,
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )
        return response.text
    except Exception as e:
        print(f"[!] Extraction failed: {e}")
        return None

def extract_attributes_with_groq_fallback(mfg_part_num: str, brand: str, category_schema: dict):
    """
    The Smart Fallback: Uses Groq's Built-In Tools to Agentically Search 
    and Visit Websites when the local headless browser gets blocked.
    """
    print("[*] Initiating Groq Agentic Search Fallback...")
    
    if not os.environ.get("GROQ_API_KEY"):
        print("[!] GROQ_API_KEY missing from environment variables.")
        return None, None
        
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    model = "llama-3.3-70b-versatile" # Groq's top open model that supports tools
    
    schema_json = json.dumps(category_schema, indent=2)
    
    prompt = f"""
    You are a strict product data extraction AI.
    Your task is to search the web and find the official manufacturer specifications for: {brand} {mfg_part_num}.
    
    Use your built-in web search and website visiting tools to find the product page or spec sheet.
    Once you find the data, extract the attributes defined in the JSON schema below.
    
    CRITICAL: You MUST return a valid JSON object. 
    If an attribute is not explicitly stated on the official sites, you MUST set its value to null. Do not guess.
    
    Category Constraints:
    {schema_json}
    """

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "user", "content": prompt}
            ],
            extra_body={"tools":[{"type":"browser_search"}]}
        )
        
        content = response.choices[0].message.content
        citation_url = None
        
        # Grab the top citation from Groq's executed tools to fulfill Rule 3
        if hasattr(response.choices[0].message, 'executed_tools') and response.choices[0].message.executed_tools:
            search_results_obj = response.choices[0].message.executed_tools[0].search_results
            if hasattr(search_results_obj, 'results') and search_results_obj.results:
                citation_url = getattr(search_results_obj.results[0], 'url', None)
        
        # Extract the JSON chunk
        import re
        match = re.search(r'\{.*\}', content, re.DOTALL)
        json_str = match.group(0) if match else content
        
        return json_str, citation_url
        
    except Exception as e:
        print(f"[!] Groq Fallback failed: {e}")
        return None, None

# ---------------------------------------------------------
# The Main Pipeline
# ---------------------------------------------------------
async def process_item_ai_pipeline(mfg_part_num: str, brand: str, classpath: str):
    print(f"\n--- Processing {brand} {mfg_part_num} ---")
    
    schema_constraints = get_category_schema(classpath)
    dynamic_model = build_pydantic_model_for_category(classpath)
    
    # 1. Try Free RAG Workflow with Crawl4AI
    source_url = search_manufacturer_specs(mfg_part_num, brand)
    scraped_text = await crawl_text_from_url(source_url) if source_url else ""
    
    extracted_json = None
    if scraped_text and dynamic_model:
        extracted_json = extract_attributes_with_gemini(scraped_text, schema_constraints, dynamic_model)
        
    # 2. Smart Fallback Logic: If Crawl4AI failed or returned empty/null data
    if not extracted_json or "null" in extracted_json:
        print("[!] Free RAG returned empty/null data. Switching to Groq Agentic Search Fallback!")
        extracted_json, fallback_url = extract_attributes_with_groq_fallback(mfg_part_num, brand, schema_constraints)
        if fallback_url:
            source_url = fallback_url
        
    return {
        "mfr_url": source_url or "Found via Grounding",
        "extracted_attributes_json": extracted_json
    }

if __name__ == "__main__":
    # Test our pipeline with the Frigidaire Dishwasher from the sample dataset
    test_mpn = "PDSH4816AF"
    test_brand = "FRIGIDAIRE"
    test_class = "Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers"
    
    # Run the asynchronous pipeline
    result = asyncio.run(process_item_ai_pipeline(test_mpn, test_brand, test_class))
    print("\n--- Final Pipeline Output ---")
    print(result)
