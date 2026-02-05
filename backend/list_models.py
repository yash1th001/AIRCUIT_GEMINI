import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('EMERGENT_LLM_KEY')
print(f"Using API Key: {api_key[:5]}...")

try:
    genai.configure(api_key=api_key)
    print("Listing models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error: {e}")
