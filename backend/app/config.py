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

    # Optimize Supabase connection URL for Serverless (port 6543 Transaction pooler)
    if DATABASE_URL and "pooler.supabase.com:5432" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543", 1)

    if DATABASE_URL and "supabase.com" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
        sep = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"
        
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///local_db.sqlite3'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": False,  # Remove extra ping roundtrip in serverless functions
        "pool_size": 5,
        "max_overflow": 10,
        "pool_recycle": 300,
        "connect_args": {
            "connect_timeout": 5,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3
        }
    }
    
    # CORS
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Security limits — bumped for panorama uploads (full-res 360° images can be 50-200 MB)
    MAX_CONTENT_LENGTH = 256 * 1024 * 1024  # 256 MB max request size
