# Unihack Automated Content Pipeline - Implementation Plan

Our objective is to build a production-grade, highly scalable AI pipeline that processes messy supplier data into the 252-column Unilog canonical schema without hallucinations. 

## The Pipeline Flow (End-to-End)

When a row of data (e.g., `"Freud Inc (2435)"`, `"Diablo 1/2x18 Sanding Belt"`) enters our system, it moves through three phases:

---

### Phase 1: High-Performance Foundation & Rule Engine
*We process the raw data and apply deterministic engineering rules before the AI even touches it, drastically reducing API costs and hallucinations.*

1.  **Fast Ingestion (`data_loader.py`)**: The raw `Unihack_ Sample Dataset - Input.csv` is read using **Polars** (for blazing speed) and loaded into **DuckDB** (for persistent in-memory SQL querying).
2.  **Deterministic Rules (`rules.py`)**: Instead of relying on missing Excel reference sheets, we use pure Python regex logic to normalize engineering abbreviations (e.g., `inches` -> `in`) and convert decimals to trade fractions (e.g., `0.5` -> `1/2`).

---

### Phase 2: Advanced AI Engine (Entity, Graph, & RAG)
*We use specialized AI models to extract and resolve data.*

#### 2.1 Contrastive Entity Linker (`entity_linker.py`)
1. **The Problem**: Supplier strings are messy (e.g., `"Jam Industrial Supply LLC (JAMIN)"`).
2. **The Solution**: We use a `SentenceTransformer` embedding model to mathematically map the messy string to the canonical master brand (e.g., `"3M®"`) via Cosine Similarity.

#### 2.2 Taxonomy Knowledge Graph (`rules.py`)
1. **The Problem**: We don't want the AI to hallucinate attributes that don't belong to a category.
2. **The Solution**: We define a Python dictionary graph. If the product is a "Dishwasher", the graph instantly tells the LLM it is *only* allowed to extract "Mounting Type" and "Wash Cycles".

#### 2.3 Agentic Web-Retrieval & Extractor (`llm_extractor.py`)
To guarantee 100% data extraction without getting blocked by Javascript or Anti-Bot Captchas, we will use industry-standard Open Source tools:
1. **The Searcher (Free Google Search & URL Fallback)**: We will stick to our `googlesearch-python` module. If Google blocks the automated request, we will instantly fall back to our direct URL generation logic (e.g., generating the Frigidaire URL from the MPN). This requires ZERO API keys or credit cards.
2. **The Scraper (Crawl4AI)**: We will rip out `BeautifulSoup` and use the modern `crawl4ai` framework. It uses a headless Chromium browser (`Playwright`) to render Javascript-heavy pages (like Frigidaire) and converts the specs into clean Markdown for the LLM.
3. **The Extractor (Gemini Flash Lite)**: We will feed the Crawl4AI Markdown into the `google-genai` SDK using `response_schema` to mathematically guarantee Pydantic JSON extraction.

#### 2.4 Groq Agentic Search Fallback (Completed)
We successfully mitigated the Datadome Firewall block by utilizing Groq's `openai/gpt-oss-120b` model equipped with the `browser_search` tool. This agentic search mimics human browsing behavior to bypass bot protections, extracts the product specifications, and captures the **Source URL Citation** (fulfilling Hackathon Rule 3 & 5).

---

### Phase 2.5: The Universal Taxonomy Engine (Replacing Hardcodes)

**Goal**: Because we have 8 days, we want to prove to Unilog that our system is truly generic and industry-agnostic. We will remove the hardcoded `Dishwasher` classes and build a dynamic taxonomy engine.

#### 2.5.1 The Approach
1. **Database Schema Storage**: We will create a `taxonomies` table in DuckDB. This will store the expected attributes, allowed values (enums), and descriptions for *any* category (HVAC, Plumbing, Appliances, etc.) as JSON.
2. **Dynamic Pydantic Generation**: In `rules.py` and `llm_extractor.py`, instead of a hardcoded class, we will write a function that:
   - Queries the database for the given SKU's category.
   - Uses `pydantic.create_model()` to construct a strict schema at runtime.
   - Feeds this dynamic schema into the LLM pipelines.

#### 2.5.2 Why this wins the Hackathon
This is the ultimate proof of **"Scalability"** and **"Innovation in Approach"**. You will be able to show the judges that to support a brand new industry, they don't need to write new code; they simply inject a new JSON taxonomy into the database, and the AI automatically adapts its extraction constraints.

---

### Phase 3: Assembly & Human-In-The-Loop Dashboard

**Goal**: Build a stunning, interactive Web UI for operators to audit and approve the AI-extracted product data, directly interfacing with our backend.

#### 3.1 The Tech Stack
To minimize overhead during the hackathon and keep everything unified, we will extend our existing backend into a Full-Stack application:
- **Backend**: FastAPI (already installed).
- **Frontend**: Jinja2 Templates + Vanilla JS + TailwindCSS (via CDN).
- **Aesthetics**: A dark-mode, premium, high-tech dashboard (glassmorphism, clean typography, micro-animations) to "WOW" the judges.

#### 3.2 Key Features
1. **The Audit Queue**: A main dashboard listing SKUs pending enrichment.
2. **One-Click Enrichment**: A button to trigger the `process_item_ai_pipeline` for a SKU.
3. **The Review Interface**: A side-by-side view displaying the extracted JSON structure against a clickable link to the Source Citation URL.

#### 3.3 Proposed Files
#### [NEW] `c:\Users\Sahil\Desktop\UniHack\Unihack\backend\main.py`
The FastAPI server containing the REST endpoints and serving the HTML template.

#### [NEW] `c:\Users\Sahil\Desktop\UniHack\Unihack\backend\templates\dashboard.html`
The responsive, Tailwind-styled UI for the Human-in-the-loop operator.

---

### Phase 3: Assembly & Human-In-The-Loop (Frontend)
*We format the extracted data and calculate confidence.*

1.  **Multi-Format Synthesis**: We use the extracted attributes to generate the 5 specific output strings: `Invoice Desc`, `Mobile Desc`, `Short Title`, `Long Desc`, and `Retail Desc`.
2.  **Bayesian Confidence (Entropy)**: The LLM assigns a probability score to its extraction. 
3.  **FastAPI -> Next.js**: We expose the final output via FastAPI. If the confidence is below 85%, the item is flagged and sent to the Next.js Human-In-The-Loop (HITL) audit dashboard for manual review.