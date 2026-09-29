"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .database import engine, Base
from .routes.meetings import router as meetings_router
from .seed import seed_database

app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for Zoom-like video conferencing application",
    version="1.0.0",
)

# CORS — allow frontend origin (configurable via env var)
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(meetings_router)


@app.on_event("startup")
def on_startup():
    """Create tables and seed data on application startup."""
    Base.metadata.create_all(bind=engine)
    seed_database()


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "Zoom Clone API is running"}
