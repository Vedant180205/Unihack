import requests


OLLAMA_URL = "http://localhost:11434"


def ask_llm(prompt):

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": "gemma3",
            "prompt": prompt,
            "stream": False
        },
        timeout=300
    )

    response.raise_for_status()

    return response.json()["response"]