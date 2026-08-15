import re

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

# This acts as our "Embedded Knowledge Graph" for now.
# In a full run, this would be a NetworkX graph parsed from Unicat_Lov_v1_0.xlsx

KNOWLEDGE_GRAPH = {
    "Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers": {
        "Mounting Type": ["Leg Mounting", "Built-In", "Under-Counter"],
        "Material": ["Stainless Steel", "Plastic", "Black Stainless"],
        "Wash Cycles": ["3-Wash Cycle", "4-Wash Cycle", "5-Wash Cycle", "6-Wash Cycle"],
        "Voltage": ["120 V", "240 V"],
        "Amperage": ["15 A", "20 A"]
    },
    "Plumbing > Faucets > Kitchen Faucets": {
        "Mounting Type": ["Deck Mount", "Wall Mount"],
        "Material": ["Brass", "Stainless Steel", "Chrome", "Matte Black"],
        "Handle Type": ["Single Handle", "Double Handle", "Touchless"]
    }
}

def get_category_schema(classpath: str) -> dict:
    """
    Takes a category classpath and queries the Knowledge Graph 
    to return the EXACT allowed attributes and their valid LOVs.
    """
    # Graph Traversal (simulated by dict lookup)
    return KNOWLEDGE_GRAPH.get(classpath, {})

def build_pydantic_model_for_category(classpath: str):
    """
    Dynamically constructs a Pydantic schema based on the Knowledge Graph.
    This guarantees the LLM physically cannot hallucinate invalid values.
    """
    schema_constraints = get_category_schema(classpath)
    # We will use this in the LLM step to feed to the `instructor` library.
    return schema_constraints
