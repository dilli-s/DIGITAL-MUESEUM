import sys
from app import create_app
app = create_app()
with app.app_context():
    try:
        from app.services.ai_service import process_ai_question
        print(process_ai_question("HI"))
    except Exception as e:
        import traceback
        traceback.print_exc()
