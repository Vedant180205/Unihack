import duckdb
import polars as pl
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "unihack.duckdb")

def init_taxonomies(conn):
    # Create taxonomies table
    conn.execute("""
    CREATE TABLE IF NOT EXISTS taxonomies (
        classpath TEXT PRIMARY KEY,
        attributes JSON
    )
    """)
    
    # Check if table is empty before seeding
    count = conn.execute("SELECT COUNT(*) FROM taxonomies").fetchone()[0]
    if count == 0:
        seed_data = [
            (
                "Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers",
                json.dumps({
                    "Mounting Type": ["Leg Mounting", "Built-In", "Under-Counter"],
                    "Material": ["Stainless Steel", "Plastic", "Black Stainless"],
                    "Wash Cycles": ["3-Wash Cycle", "4-Wash Cycle", "5-Wash Cycle", "6-Wash Cycle"],
                    "Voltage": ["120 V", "240 V"],
                    "Amperage": ["15 A", "20 A"]
                })
            ),
            (
                "Plumbing > Faucets > Kitchen Faucets",
                json.dumps({
                    "Mounting Type": ["Deck Mount", "Wall Mount"],
                    "Material": ["Brass", "Stainless Steel", "Chrome", "Matte Black"],
                    "Handle Type": ["Single Handle", "Double Handle", "Touchless"]
                })
            ),
            (
                "Power Tools > Drills",
                json.dumps({
                    "Chuck Size": ["1/2 in", "3/8 in", "1/4 in"],
                    "Voltage": ["12V", "18V", "20V", "120V"],
                    "Speed (RPM)": [],
                    "Drive Type": ["Keyless", "Keyed"]
                })
            ),
            (
                "HVAC > Air Conditioners > Window Units",
                json.dumps({
                    "Cooling Capacity (BTU)": [],
                    "Voltage": ["115 V", "230 V"],
                    "Energy Star Rating": ["Yes", "No"]
                })
            ),
            (
                "Plumbing > Pipes > Copper Pipes",
                json.dumps({
                    "Diameter (in)": ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2"],
                    "Wall Thickness": ["Type K", "Type L", "Type M"],
                    "Material Grade": ["Copper"]
                })
            )
        ]
        
        conn.executemany(
            "INSERT INTO taxonomies (classpath, attributes) VALUES (?, ?)", 
            seed_data
        )
        print("Seeded taxonomies table with 5 categories.")

def init_db():
    conn = duckdb.connect(DB_PATH)
    
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "resources")
    
    # Example for loading CSV
    input_sample = os.path.join(docs_dir, "Unihack_ Sample Dataset - Input.csv")
    if os.path.exists(input_sample):
        conn.execute(f"CREATE TABLE IF NOT EXISTS sample_input AS SELECT * FROM read_csv_auto('{input_sample}', normalize_names=True)")
        print(f"Loaded {input_sample} into sample_input table.")
        
    init_taxonomies(conn)
        
    return conn

if __name__ == "__main__":
    db_conn = init_db()
    # verify
    tables = db_conn.execute("SHOW TABLES").fetchall()
    print("Tables in DuckDB:", tables)
