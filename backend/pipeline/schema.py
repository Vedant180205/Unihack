import csv
import os

BASE = os.path.dirname(__file__)

with open(os.path.join(BASE, "Unihack__Expected_Output_-_Delivery_Format.csv")) as f:
    OUTPUT_COLUMNS = next(csv.reader(f))

PASSTHROUGH_FROM_INPUT = {
    "Mfg_Part_Num": "Mfg_Part_Num",
    "Part_Desc": "Part_Desc",
    "E1_Brand": "E1_Brand",
    "Unilog_Brand": "Unilog_Brand",
    "DIB_Brand": "DIB_Brand",
    "Part_Manuf": "Part_Manuf",
    "MANUFACTURER_PART_NUMBER": "Mfg_Part_Num",
}

LLM_TARGET_FIELDS = [
    "MANUFACTURER_NAME", "BRAND_NAME", "TRADE_NAME", "ALTERNATE_PART_NUMBER",
    "MOBILE_DESC", "INVOICE_DESC", "SHORT_DESC", "LONG_DESC1", "RETAIL_DESC",
    "MARKETING_DESCRIPTION",
    *[f"ITEM_FEATURES_{i}" for i in range(1, 21)],
    "With", "Standard/Approvals", "Prop 65", "Application", "Includes",
    "Product Name",
    "UPC", "EAN", "GTIN", "UNSPSC", "Warranty", "List Price",
    "Selling Qty", "Selling UOM", "Standard Packaging Information",
    "LENGTH", "LENGTH_UOM", "HEIGHT", "HEIGHT_UOM", "WIDTH", "WIDTH_UOM",
    "WEIGHT", "WEIGHT_UOM", "VOLUME", "VOLUME_UOM",
    "Country Of Origin", "Discontinued",
]

if __name__ == "__main__":
    print("Loaded", len(OUTPUT_COLUMNS), "output columns")
    assert len(OUTPUT_COLUMNS) == 252, f"expected 252, got {len(OUTPUT_COLUMNS)}"
    print("OK - matches expected delivery format")