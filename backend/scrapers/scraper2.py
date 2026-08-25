import requests
from bs4 import BeautifulSoup


def scrape_website(url):

    response = requests.get(
        url,
        headers={
            "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/151.0.0.0 Safari/537.36"
    )
        },
        timeout=15
    )

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # elements that usually don't contain useful content
    for element in soup([
        "script",
        "style",
        "nav",
        "footer",
        "header",
        "aside"
    ]):
        element.decompose()

    title = soup.title.get_text(" ", strip=True) if soup.title else ""

    content = soup.get_text(" ", strip=True)

    return {
        "url": url,
        "title": title,
        "content": content
    }


data = scrape_website("https://en.wikipedia.org/wiki/Main_Page")

print("TITLE:", data["title"])
print("\nCONTENT:\n")
print(data["content"])