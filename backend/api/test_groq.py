import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq()

def test_compound():
    print("Testing groq/compound...")
    try:
        response = client.chat.completions.create(
            model="groq/compound",
            messages=[{"role": "user", "content": "What is the Frigidaire PDSH4816AF?"}]
        )
        print("Success:", response.choices[0].message.content[:100])
        if response.choices[0].message.executed_tools:
            print("Citations:", response.choices[0].message.executed_tools[0].search_results)
    except Exception as e:
        print("Failed:", e)

def test_browser():
    print("\nTesting openai/gpt-oss-120b with browser_search...")
    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": "What is the Frigidaire PDSH4816AF?"}],
            extra_body={"tools":[{"type":"browser_search"}]}
        )
        safe_content = response.choices[0].message.content.encode('ascii', 'ignore').decode('ascii')
        print("Success Content:", safe_content[:200])
        
        # Check citations
        if hasattr(response.choices[0].message, 'executed_tools') and response.choices[0].message.executed_tools:
            print("Citations:", response.choices[0].message.executed_tools[0].search_results)
        else:
            print("No executed_tools field found on the message object.")
            
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test_compound()
    test_browser()
