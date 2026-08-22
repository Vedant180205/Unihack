import os
from pathlib import Path

# Root directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
APP_DIR  = BASE_DIR / "app"

# Input/Output paths
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUT_DIR  = BASE_DIR / "output"
DOCS_DIR    = BASE_DIR.parent / "docs" / "resources"

# Ensure dirs exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Default input CSV (used when no upload provided)
DEFAULT_INPUT_CSV = DOCS_DIR / "Unihack_ Sample Dataset - Input.csv"

# Output files
OUTPUT_CSV  = OUTPUT_DIR / "output.csv"
OUTPUT_XLSX = OUTPUT_DIR / "output.xlsx"

# Exporter template
TEMPLATE_CSV = DOCS_DIR / "Unihack_ Expected Output - Delivery Format.csv"

# SearXNG
SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")

# Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
