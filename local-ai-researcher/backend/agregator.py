from llm import ask_llm


def aggregate(query, pages):

    sources = ""

    for i, page in enumerate(pages, 1):

        sources += f"""
SOURCE {i}

Title:
{page['title']}

URL:
{page['url']}

Content:
{page['content'][:6000]}

--------------------------------
"""

    prompt = f"""
You are an AI research assistant.

User question:
{query}

Below are webpages collected from a local
search and crawling system.

{sources}

Create a useful answer to the user's question.

Rules:

1. Use only information present in the sources.
2. Do not invent facts.
3. Identify conflicting information.
4. Prefer information supported by multiple sources.
5. Mention which sources support important claims.
6. Give a concise but informative answer.
"""

    return ask_llm(prompt)