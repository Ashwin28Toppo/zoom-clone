"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .database import engine, Base, SessionLocal
from .routes.meetings import router as meetings_router
from .routes.auth import router as auth_router

app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for Zoom-like video conferencing application",
    version="2.0.0",
)

# CORS — allow frontend origin (configurable via env var + wildcard vercel regex)
cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://zoom-clone-mocha-nu.vercel.app",
)
origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth_router)
app.include_router(meetings_router)


def _migrate_database():
    """Add new columns to existing tables if they don't exist (SQLite migration)."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///./zoom_clone.db")
    if not db_url.startswith("sqlite"):
        return  # Only needed for SQLite

    import sqlite3
    db_path = db_url.replace("sqlite:///", "").replace("./", "")
    if not os.path.exists(db_path):
        return  # New DB, no migration needed

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Add host_user_id to meetings if missing
        cursor.execute("PRAGMA table_info(meetings)")
        meeting_cols = {row[1] for row in cursor.fetchall()}
        if "host_user_id" not in meeting_cols:
            cursor.execute("ALTER TABLE meetings ADD COLUMN host_user_id INTEGER REFERENCES users(id)")
            conn.commit()

        # Add last_seen to participants if missing (heartbeat presence)
        cursor.execute("PRAGMA table_info(participants)")
        participant_cols = {row[1] for row in cursor.fetchall()}
        if "last_seen" not in participant_cols:
            cursor.execute("ALTER TABLE participants ADD COLUMN last_seen DATETIME")
            # Back-fill existing rows with joined_at value
            cursor.execute("UPDATE participants SET last_seen = joined_at WHERE last_seen IS NULL")
            conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
def on_startup():
    """Create tables and run migrations on application startup."""
    _migrate_database()        # Run before create_all so FKs are consistent
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "Zoom Clone API is running", "version": "2.0.0"}
