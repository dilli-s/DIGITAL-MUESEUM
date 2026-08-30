import os
from google import genai
from google.genai import types

class AIProvider:
    def __init__(self):
        self.api_key = os.environ.get("AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        self.model_name = os.environ.get("AI_MODEL", "gemini-3.6-flash")
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
    def generate_response(self, system_instruction, context_text, user_question):
        if not self.client:
            return "AI Assistant is currently unavailable because the API key is not configured."
            
        prompt = f"""
SYSTEM:
{system_instruction}

CONTEXT:
{context_text}

USER QUESTION:
{user_question}
"""
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=500,
                    temperature=0.3
                )
            )
            return response.text
        except Exception as e:
            raise Exception(f"AI Provider error: {str(e)}")

# Singleton instance
ai_provider = AIProvider()
