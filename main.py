import os
from openai import OpenAI

# Check for dotenv file support
try:
    # pyrefly: ignore [missing-import]
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Retrieve API key from environment ('open_ai_key' or 'OPENAI_API_KEY')
api_key = os.getenv("open_ai_key") or os.getenv("OPENAI_API_KEY")

if not api_key:
    # Optional fallback if set directly in code or environment
    api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=api_key)

response = client.chat.completions.create(
    model="gpt-4.1-nano-2025-04-14",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)

print(response.choices[0].message.content)
