# Unihack AI Pipeline - Universal Taxonomy Engine

An advanced, production-grade AI pipeline designed to ingest messy, unstandardized supplier data, dynamically retrieve category-specific rules, and agentically extract and structure product specifications using LLMs.

## Features
- **Universal Taxonomy Engine (DuckDB)**: Database-driven schema generation. New product categories can be added purely via JSON, without changing any code.
- **Dynamic Pydantic Constraints**: Uses `pydantic.create_model()` to programmatically generate extraction schemas on the fly, physically preventing the LLM from hallucinating values outside allowed LOVs.
- **Agentic Search Fallback (Groq)**: Bypasses anti-bot mechanisms by equipping an advanced open-source LLM (`gpt-oss-120b`) with a `browser_search` tool to autonomously hunt down spec sheets.
- **Stealth HTML Scraping (Crawl4AI)**: Extracts clean markdown from JavaScript-heavy vendor websites.
- **Contrastive Entity Linking**: Uses `SentenceTransformers` to mathematically link messy supplier names to a canonical Master Brand database.

## Architecture

The project is structured in 3 distinct phases:

1. **Deterministic Rule Engine (`rules.py`, `data_loader.py`)**
   - Rapid ingestion via Polars and DuckDB.
   - Engineering unit normalization (e.g., `inches` -> `in`, `0.5` -> `1/2`).

2. **Advanced AI Engine (`llm_extractor.py`, `entity_linker.py`)**
   - Entity linkage via cosine similarity.
   - DuckDuckGo spec sheet discovery.
   - Crawl4AI markdown conversion.
   - Strict Pydantic JSON extraction via Gemini Flash Lite.

3. **Human-In-The-Loop Dashboard (WIP)**
   - A FastAPI/Next.js interface for operators to audit and approve AI-extracted output.

## Setup Instructions

### Prerequisites
- Python 3.10+
- Playwright browsers installed

### Installation
1. Create and activate your virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Or `.\venv\Scripts\activate` on Windows
   ```
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   playwright install
   ```
3. Set up your `.env` file in the `backend/` directory:
   ```env
   GEMINI_API_KEY=your_gemini_key
   GROQ_API_KEY=your_groq_key
   ```
4. Seed the DuckDB database:
   ```bash
   python backend/data_loader.py
   ```

### Running the Pipeline
```bash
python backend/llm_extractor.py
```
