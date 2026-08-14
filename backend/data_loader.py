import duckdb
import pandas as pd
import os

DB_PATH = ":memory:"  # In memory for now, change to a file for persistence

def init_db():
    conn = duckdb.connect(DB_PATH)
    
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "resources")
    
    # Example for loading CSV
    input_sample = os.path.join(docs_dir, "Unihack_ Sample Dataset - Input.csv")
    if os.path.exists(input_sample):
        conn.execute(f"CREATE TABLE IF NOT EXISTS sample_input AS SELECT * FROM read_csv_auto('{input_sample}', normalize_names=True)")
        print(f"Loaded {input_sample} into sample_input table.")
    
    # Placeholder for Excel master files (using Pandas to read Excel into DuckDB)
    brand_file = os.path.join(docs_dir, "UniCat_Manufacturer_and_Brand_List.xlsx")
    if os.path.exists(brand_file):
        df_brands = pd.read_excel(brand_file)
        conn.execute("CREATE TABLE IF NOT EXISTS master_brands AS SELECT * FROM df_brands")
        print(f"Loaded {brand_file} into master_brands table.")
    else:
        print(f"Master file not found: {brand_file}")
        
    return conn

if __name__ == "__main__":
    db_conn = init_db()
    # verify
    tables = db_conn.execute("SHOW TABLES").fetchall()
    print("Tables in DuckDB:", tables)
