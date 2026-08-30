import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATABASE_URL = os.environ.get('DATABASE_URL')
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    PORT = int(os.environ.get('PORT', 5001))
