import re
from pydantic import create_model, Field
from typing import Optional, Literal

def normalize_uom(value: str) -> str:
    """
    Normalizes messy units based on standard engineering abbreviations.
    E.g. 'inches', 'IN.', 'inch' -> 'in'
    """
    if not value: return ""
    value = str(value).lower().strip()
    
    # Distance / Length
    if re.match(r'^(inch|inches|in\.?)$', value): return "in"
    if re.match(r'^(foot|feet|ft\.?)$', value): return "ft"
    if re.match(r'^(millimeter|millimeters|mm\.?)$', value): return "mm"
    if re.match(r'^(centimeter|centimeters|cm\.?)$', value): return "cm"
    
    # Electrical
    if re.match(r'^(volts|volt|v\.?)$', value): return "V"
    if re.match(r'^(amps|amp|ampere|amperes|a\.?)$', value): return "A"
    
    # Weight
    if re.match(r'^(pounds|pound|lbs|lb\.?)$', value): return "lb"
    if re.match(r'^(ounces|ounce|oz\.?)$', value): return "oz"
    
    return value

def normalize_fraction(decimal_val: float) -> str:
    """
    Converts a floating decimal into a standard trade fraction string.
    E.g. 0.5 -> "1/2", 0.25 -> "1/4", 0.125 -> "1/8"
    """
    fractions = {
        0.5: "1/2",
        0.25: "1/4",
        0.75: "3/4",
        0.125: "1/8",
        0.375: "3/8",
        0.625: "5/8",
        0.875: "7/8",
        0.0625: "1/16",
        # We can add all 63 mappings here as needed
    }
    
    whole = int(decimal_val)
    frac = decimal_val - whole
    
    # Check if we have an exact fraction match (using round to avoid floating point errors)
    frac_rounded = round(frac, 4)
    if frac_rounded in fractions:
        frac_str = fractions[frac_rounded]
        if whole > 0:
            return f"{whole}-{frac_str}"
        return frac_str
    
    return str(decimal_val)

# ---------------------------------------------------------
# Taxonomy Knowledge Graph (Step 2.2)
# ---------------------------------------------------------
import duckdb
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "unihack.duckdb")

def get_category_schema(classpath: str) -> dict:
    """
    Queries the DuckDB taxonomies table for the allowed attributes
    of a given category. Returns {} if not found.
    """
    try:
        conn = duckdb.connect(DB_PATH)
        result = conn.execute(
            "SELECT attributes FROM taxonomies WHERE classpath = ?", 
            [classpath]
        ).fetchone()
        conn.close()
        if result and result[0]:
            return json.loads(result[0])
    except Exception as e:
        print(f"[!] Taxonomy lookup failed: {e}")
    return {}

def build_pydantic_model_for_category(classpath: str):
    """
    Dynamically constructs a Pydantic model class from the DuckDB taxonomy.
    The LLM physically cannot hallucinate values outside the allowed LOVs.
    Returns the model CLASS (not an instance).
    """
    schema = get_category_schema(classpath)
    if not schema:
        return None  # Unknown category; let LLM run free-form
    
    field_definitions = {}
    for attr_name, allowed_values in schema.items():
        # Sanitize the attribute name to be a valid Python identifier
        field_key = re.sub(r'[^a-zA-Z0-9_]', '_', attr_name).lower()
        
        # Build a Literal type from the allowed list of values
        if allowed_values:
            literal_type = Literal[tuple(str(v) for v in allowed_values)]
            field_definitions[field_key] = (
                Optional[literal_type],
                Field(None, description=f"Must be one of: {allowed_values}")
            )
        else:
            field_definitions[field_key] = (
                Optional[str],
                Field(None, description=f"Extract value for {attr_name}")
            )
    
    DynamicModel = create_model('DynamicTaxonomyModel', **field_definitions)
    return DynamicModel
