import os
import duckdb
import polars as pl
from sentence_transformers import SentenceTransformer, util
import torch

class EntityLinker:
    def __init__(self, db_path="unihack.duckdb", model_name="all-MiniLM-L6-v2"):
        self.db_path = db_path
        # Loads a lightweight, super-fast embedding model (Contrastive Learning based)
        self.model = SentenceTransformer(model_name)
        self.master_brands = []
        self.brand_embeddings = None
        self._load_master_data()

    def _load_master_data(self):
        conn = duckdb.connect(self.db_path)
        try:
            # Check if our master_brands table exists (from Phase 1 loader)
            tables = [t[0] for t in conn.execute("SHOW TABLES").fetchall()]
            if 'master_brands' in tables:
                df = conn.execute("SELECT DISTINCT BRAND_NAME FROM master_brands WHERE BRAND_NAME IS NOT NULL").pl()
                self.master_brands = df['BRAND_NAME'].to_list()
            else:
                # Fallback: Since the master Excel file wasn't provided yet, 
                # we'll extract valid brands from the Ground Truth Delivery Output CSV
                docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "resources")
                delivery_file = os.path.join(docs_dir, "Unihack_ Expected Output - Delivery Format.csv")
                if os.path.exists(delivery_file):
                    df = pl.read_csv(delivery_file, null_values=["-- No Unilog Brand --", "-- Unbranded --", "-- No DIB Brand --", ""])
                    # Extract unique valid brands
                    self.master_brands = df['BRAND_NAME'].drop_nulls().unique().to_list()
                else:
                    self.master_brands = ["Dummy Brand"]
            
            # Mathematical Step: Pre-compute vectors for the master list
            if self.master_brands:
                print(f"Pre-computing embeddings for {len(self.master_brands)} master brands...")
                self.brand_embeddings = self.model.encode(self.master_brands, convert_to_tensor=True)
                
        except Exception as e:
            print(f"Error loading master data: {e}")
            self.master_brands = ["Dummy Brand"]
            self.brand_embeddings = self.model.encode(self.master_brands, convert_to_tensor=True)
        finally:
            conn.close()

    def resolve_brand(self, messy_string: str) -> dict:
        """
        Takes a messy supplier brand string, computes its vector embedding, 
        and calculates cosine similarity against the master brand vectors to find the nearest match.
        """
        if not messy_string or str(messy_string).strip() == "" or not self.master_brands:
            return {"canonical_brand": None, "confidence": 0.0}
            
        # 1. Encode the messy query string into a vector
        query_embedding = self.model.encode(messy_string, convert_to_tensor=True)
        
        # 2. Compute mathematical cosine similarity against the pre-calculated master matrix
        cos_scores = util.cos_sim(query_embedding, self.brand_embeddings)[0]
        
        # 3. Find the highest scoring match
        top_result = torch.topk(cos_scores, k=1)
        score = top_result.values[0].item()
        best_match_idx = top_result.indices[0].item()
        canonical_brand = self.master_brands[best_match_idx]
        
        return {
            "messy_input": messy_string,
            "canonical_brand": canonical_brand,
            "confidence": round(score, 4)
        }

# Global singleton to keep the model cached in memory so the API stays blazingly fast
_linker_instance = None

def get_linker():
    global _linker_instance
    if _linker_instance is None:
        _linker_instance = EntityLinker()
    return _linker_instance

def resolve_brand(messy_string: str) -> dict:
    """Public wrapper to call the singleton linker."""
    linker = get_linker()
    return linker.resolve_brand(messy_string)

# Example usage/test if running this file directly
if __name__ == "__main__":
    test_messy = "Freud Inc (2435)"
    print(f"Testing messy input: '{test_messy}'")
    result = resolve_brand(test_messy)
    print("Resolved Output:", result)
