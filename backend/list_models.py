"""
List Gemini models available to the configured API key.

Uses the current Google Gen AI SDK (`google-genai`). The old
`google.generativeai` package is deprecated (fully removed after 2026) and
its model list included retired names like gemini-1.5-flash, which now
always 404. This script reflects the models Google actually serves today.
"""
from google import genai
from google.genai.errors import ClientError
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    raise SystemExit("GEMINI_API_KEY not set in environment/.env")

print(f"Using API Key: {api_key[:5]}...")

try:
    client = genai.Client(api_key=api_key)
    print("Listing models that support generateContent...\n")
    for m in client.models.list():
        for action in (m.supported_actions or []):
            if action == "generateContent":
                print(m.name)
                break
except ClientError as e:
    print(f"Error: {e}")
except Exception as e:
    print(f"Error: {e}")