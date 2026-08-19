# Bulk Anomaly Detection Analysis

Based on the current codebase, here is an analysis of what **Bulk Anomaly Detection** means, why it is necessary, and how we would implement it.

### 1. What does it mean?
Currently, our pipeline evaluates each product in **isolation**. When the AI extracts data for a Dishwasher, it assigns a `confidence_score` (calculated in `rules.py`) based on two things:
1. Did the brand name match? (Jaro-Winkler string distance)
2. Did the AI fill out all the required fields? (Attribute Completeness)

However, the AI can be confidently **wrong**. For example, it might read "5 lbs" from a random shipping label on a webpage and assign it to the Dishwasher's weight. Because it found *a* value, the completeness score remains high, and the system might auto-approve a 5 lb dishwasher. 

**Bulk Anomaly Detection** means looking at the data **across a batch of similar products** rather than one by one. If we process 100 dishwashers, and 99 of them weigh between 50 and 100 lbs, we can use simple statistics to identify that the 5 lb dishwasher is a massive outlier and flag it as a probable AI hallucination.

### 2. Why is this change required?
* **Catches Contextual Errors:** It catches errors that a single-item rule engine cannot catch. A 5 lb weight is perfectly valid for a Power Drill, but it's an anomaly for a Dishwasher.
* **Reduces False Positives:** Relying purely on "Attribute Completeness" for our confidence score is risky. Anomaly detection acts as a secondary safety net to ensure the extracted values actually make physical sense within their category.
* **Smarter HITL Routing:** By flagging statistical outliers, we can automatically route these specific edge cases to the Human-In-The-Loop (HITL) dashboard, ensuring humans only spend time reviewing genuinely suspicious data.

### 3. What are we supposed to change?
To implement this, we would need to add a post-processing validation step after the AI extraction phase:

1. **Numeric Extraction & Conversion:** We first need to ensure attributes like "Weight" or "Voltage" can be parsed as actual numbers (stripping out "lbs" or "V" using our normalizers in `rules.py`).
2. **Batch Aggregation:** We need to group our processed results by their taxonomy category (e.g., `Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers`).
3. **Statistical Outlier Logic (The Math):** We would create a function (perhaps using `pandas` or `polars`) to calculate the Interquartile Range (IQR) or Standard Deviation for numeric fields within that category.
4. **Flagging Mechanism:**
   * Any value falling outside the typical bounds (e.g., lower than `Q1 - 1.5 * IQR` or higher than `Q3 + 1.5 * IQR`) gets flagged.
   * We would modify our final output schema (in `rules.py` -> `ProductEnrichmentOutput`) to include a new field like `anomaly_warnings: list[str]`. 
   * If an anomaly is detected, we append a warning (e.g., `"Warning: Weight of 5 lbs is unusually low for a Built-In Dishwasher"`) and drastically reduce the item's `confidence_score` so it is forced into the Next.js HITL dashboard for manual review.
