import json
import os
import requests
from dotenv import load_dotenv
from schema import LLM_TARGET_FIELDS

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")

EXTRACTION_PROMPT = """You are extracting structured product data for a parts catalog.

Part number: {part_num}
Part description (from internal catalog, may be abbreviated): {part_desc}
Manufacturer/brand: {manufacturer}

Below is crawled content from web sources about this part.

{sources}

Return ONLY a JSON object with these keys (use empty string "" for any
field you cannot support with the text above - do not guess or invent
values, do not use outside knowledge):

{fields}

Also return an "attributes" array of up to 10 objects, each shaped like
{{"label": "...", "value": "...", "uom": "..."}}, for spec-sheet-style
attributes (dimensions, material, voltage, grit, pack size, etc). Only
include attributes explicitly stated in the sources.

Ensure "INVOICE_DESC" is max 40 chars uppercase (e.g., "{part_num} {manufacturer}").
Ensure "MOBILE_DESC" is 60 to 80 chars descriptive summary.

Respond with raw JSON only, no markdown fences, no commentary.
"""

def extract_with_ollama(prompt: str) -> dict:
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "format": "json"},
        timeout=60,
    )
    response.raise_for_status()
    raw = response.json().get("response", "{}")
    return json.loads(raw)

def extract_with_groq(prompt: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {}
    clean_key = api_key.strip().strip('"').strip("'")
    from groq import Groq
    client = Groq(api_key=clean_key)
    chat = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"},
        temperature=0.1
    )
    raw = chat.choices[0].message.content
    return json.loads(raw)

def extract_fields(part_num: str, part_desc: str, manufacturer: str, crawled_pages: list[dict]) -> dict:
    sources_text = ""
    for i, page in enumerate(crawled_pages, 1):
        if not page.get("success"):
            continue
        sources_text += f"\n--- SOURCE {i}: {page['url']} ---\n{page.get('markdown', '')[:6000]}\n"

    prompt = EXTRACTION_PROMPT.format(
        part_num=part_num,
        part_desc=part_desc,
        manufacturer=manufacturer,
        sources=sources_text if sources_text.strip() else "(No web pages crawled successfully; derive basic fields from part number and description only.)",
        fields=json.dumps(LLM_TARGET_FIELDS, indent=2),
    )

    # 1. Try local Ollama first
    try:
        return extract_with_ollama(prompt)
    except Exception as e:
        print(f"  [INFO] Ollama unavailable ({e}). Attempting Cloud LLM fallback...")

    # 2. Try Groq fallback
    try:
        if os.getenv("GROQ_API_KEY"):
            return extract_with_groq(prompt)
    except Exception as e:
        print(f"  [WARN] Groq extraction fallback failed: {e}")

    # 3. Deterministic basic fallback if no LLM responded
    inv_desc = f"{part_num} {manufacturer}".strip()[:40].upper()
    mob_desc = f"{part_desc} by {manufacturer} - Model {part_num}".strip()
    if len(mob_desc) < 60:
        mob_desc = (mob_desc + " - High performance industrial grade product specification").strip()[:80]
    elif len(mob_desc) > 80:
        mob_desc = mob_desc[:80]

    return {
        "MANUFACTURER_NAME": manufacturer,
        "BRAND_NAME": manufacturer,
        "INVOICE_DESC": inv_desc,
        "MOBILE_DESC": mob_desc,
        "SHORT_DESC": part_desc,
        "Product Name": f"{manufacturer} {part_num}",
        "attributes": []
    }