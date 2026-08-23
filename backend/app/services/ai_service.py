from app.services.ai_provider import ai_provider
from app.services.museum_retrieval import retrieve_museum_context
import html
import re

SYSTEM_INSTRUCTION = """
You are a knowledgeable and helpful museum assistant. 
Answer the user's question primarily using the provided museum CONTEXT information. 
If the provided information does not contain the answer, clearly say: "I couldn't find enough information about that in the museum collection."
Do NOT invent dates, artists, historical facts, locations, object origins, or museum policies.
Keep your response concise and informative.
"""

def sanitize_text(text):
    """Basic sanitization to prevent prompt injection and remove tags."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities
    clean = html.unescape(clean)
    # Basic protection against prompt injection keywords (not foolproof, but an extra layer)
    clean = clean.replace("IGNORE ALL PREVIOUS INSTRUCTIONS", "")
    clean = clean.replace("ignore all previous instructions", "")
    return clean.strip()

def process_ai_question(question):
    # 1. Validate & Sanitize
    if not question or not isinstance(question, str):
        raise ValueError("Invalid question format")
        
    if len(question) > 500:
        raise ValueError("Question is too long")
        
    safe_question = sanitize_text(question)
    
    if not safe_question:
        raise ValueError("Question cannot be empty")
        
    # 2. Retrieve Context
    context_text, sources = retrieve_museum_context(safe_question)
    
    # 3. Generate Answer
    answer = ai_provider.generate_response(SYSTEM_INSTRUCTION, context_text, safe_question)
    
    return {
        "answer": answer,
        "sources": sources
    }
