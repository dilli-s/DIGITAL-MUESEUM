import os
import google.generativeai as genai

class AIProvider:
    def __init__(self):
        self.api_key = os.environ.get("AI_API_KEY")
        self.model_name = os.environ.get("AI_MODEL", "gemini-2.5-flash")
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
        else:
            self.model = None
            
    def generate_response(self, system_instruction, context_text, user_question):
        if not self.model:
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
            # We configure generation parameters like timeout / tokens if needed
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=500,
                    temperature=0.3
                )
            )
            return response.text
        except Exception as e:
            raise Exception(f"AI Provider error: {str(e)}")

# Singleton instance
ai_provider = AIProvider()
