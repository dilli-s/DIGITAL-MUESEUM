import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / '.env')
load_dotenv(Path(__file__).with_name('.env'))
if not os.getenv('DATABASE_URL'):
    load_dotenv(
        Path(__file__).resolve().parents[2]
        / 'flask-mapping-service' / 'app' / '.env'
    )

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # Handle the postgresql -> postgresql+psycopg normalization if needed
    if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
        
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///local_db.sqlite3'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # CORS
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Security limits
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max request size
