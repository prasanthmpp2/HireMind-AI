import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# Load .env file
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "")
    AUTH_COOKIE_NAME = "hiremind_session"
    AUTH_CSRF_COOKIE_NAME = "hiremind_csrf"
    AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "true" if os.getenv("FLASK_ENV") == "production" else "false").lower() in ("1", "true", "yes")
    AUTH_SESSION_TTL_SECONDS = int(os.getenv("AUTH_SESSION_TTL_SECONDS", str(8 * 60 * 60)))
    
    # Database configuration
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'hiremind.db'}")
    # Handle SQLAlchemy 1.4+ postgresql:// vs postgres:// if needed
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Groq API configuration
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_FALLBACK_MODEL = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
    AI_PROVIDER = os.getenv("AI_PROVIDER", "groq").strip().lower()
    HF_TOKEN = os.getenv("HF_TOKEN", "").strip() or os.getenv("HUGGINGFACE_API_KEY", "")
    HF_MODEL = os.getenv("HF_MODEL", "openai/gpt-oss-120b")
    HF_PROVIDER = os.getenv("HF_PROVIDER", "fireworks-ai")
    LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
    LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "1"))

    # ChromaDB & Sentence Transformer configuration (Online Service)
    CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", str(BASE_DIR / "chroma_db"))
    HUGGINGFACE_API_KEY = HF_TOKEN
    SENTENCE_TRANSFORMER_MODEL = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_TIMEOUT_SECONDS = float(os.getenv("EMBEDDING_TIMEOUT_SECONDS", "15"))
    USE_ONLINE_EMBEDDINGS = os.getenv("USE_ONLINE_EMBEDDINGS", "true").lower() in ("true", "1", "yes")

    # Uploads
    UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads")))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)) # 16 MB max
    ALLOWED_EXTENSIONS = {"pdf", "docx"}
    MAX_UPLOAD_FILE_SIZE = int(os.getenv("MAX_UPLOAD_FILE_SIZE", 10 * 1024 * 1024))
    MAX_UPLOAD_FILES = int(os.getenv("MAX_UPLOAD_FILES", 20))
    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

