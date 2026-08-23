from flask import Blueprint, jsonify, request
from app.services.ai_service import process_ai_question
from functools import wraps
import time

ai_bp = Blueprint('ai', __name__)

# Very basic rate limiting dictionary (in-memory, for demo purposes)
# In production, use Redis or similar.
rate_limits = {}

def rate_limit(limit=10, window=60):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()
            
            # Cleanup old entries
            if ip in rate_limits:
                rate_limits[ip] = [t for t in rate_limits[ip] if now - t < window]
            else:
                rate_limits[ip] = []
                
            if len(rate_limits[ip]) >= limit:
                return jsonify({"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please try again later."}}), 429
                
            rate_limits[ip].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

@ai_bp.route('/ask', methods=['POST'])
@rate_limit(limit=10, window=60)
def ask_assistant():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "Invalid request format"}}), 400
            
        question = data.get('question')
        
        # Process question
        result = process_ai_question(question)
        
        return jsonify({
            "data": result
        })
        
    except ValueError as e:
        return jsonify({"error": {"code": "VALIDATION_ERROR", "message": str(e)}}), 400
    except Exception as e:
        print(f"AI API Error: {e}")
        return jsonify({"error": {"code": "AI_UNAVAILABLE", "message": "The museum assistant is temporarily unavailable."}}), 500
