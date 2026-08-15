import duckdb
import polars as pl
import os

DB_PATH = "unihack.duckdb"  # Persistent database file

def init_db():
    conn = duckdb.connect(DB_PATH)
    
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "resources")
    
    # Example for loading CSV
    input_sample = os.path.join(docs_dir, "Unihack_ Sample Dataset - Input.csv")
    if os.path.exists(input_sample):
        conn.execute(f"CREATE TABLE IF NOT EXISTS sample_input AS SELECT * FROM read_csv_auto('{input_sample}', normalize_names=True)")
        print(f"Loaded {input_sample} into sample_input table.")
        
    return conn

if __name__ == "__main__":
    db_conn = init_db()
    # verify
    tables = db_conn.execute("SHOW TABLES").fetchall()
    print("Tables in DuckDB:", tables)
