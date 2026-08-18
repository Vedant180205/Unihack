from bs4 import BeautifulSoup

# Read HTML file
with open("page.html", "r", encoding="utf-8") as file:
    html = file.read()

# Parse HTML
soup = BeautifulSoup(html, "html.parser")

# Extract title
title = soup.title.get_text(strip=True) if soup.title else "No title"

# Extract headings
headings = []

for heading in soup.find_all(["h1", "h2", "h3"]):
    text = heading.get_text(" ", strip=True)

    if text:
        headings.append(text)

# Extract paragraphs
paragraphs = []

for p in soup.find_all("p"):
    text = p.get_text(" ", strip=True)

    if text:
        paragraphs.append(text)

# Display results
print("\nTITLE:")
print(title)

print("\nHEADINGS:")
for heading in headings:
    print("-", heading)

print("\nPARAGRAPHS:")
for paragraph in paragraphs:
    print("-", paragraph)