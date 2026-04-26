import os
import json
import subprocess
import sys

def install_and_import(package):
    try:
        import fitz
    except ImportError:
        print(f"Installing {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        import fitz
    return fitz

print("Loading PDF library...")
fitz = install_and_import('PyMuPDF')

pdf_path = "G&SR UPTO CS-14 WITH CLICK SEARCH INDEX (1).pdf"
json_path = "rules.json"

print(f"Opening PDF: {pdf_path}")
doc = fitz.open(pdf_path)
data = []

total_pages = len(doc)
print(f"Total Pages: {total_pages}")

# Extract text page by page
for page_num in range(total_pages):
    page = doc.load_page(page_num)
    text = page.get_text("text")
    if text.strip():
        # Optional: Clean up text (remove excessive newlines, etc.)
        clean_text = " ".join(text.split())
        data.append({
            "page": page_num + 1,
            "text": clean_text
        })
    if (page_num + 1) % 50 == 0:
        print(f"Processed {page_num + 1} pages...")

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

print(f"Successfully extracted {len(data)} pages with text and saved to {json_path}")
