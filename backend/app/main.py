"""
app/main.py — FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import pipeline, upload, export

app = FastAPI(
    title="UniClean AI Backend",
    description="Product data enrichment pipeline powered by Groq and SearXNG",
    version="1.0.0",
)

# CORS — allow Next.js frontend (localhost:3000) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers under /api prefix
app.include_router(pipeline.router, prefix="/api", tags=["Pipeline"])
app.include_router(upload.router,   prefix="/api", tags=["Upload"])
app.include_router(export.router,   prefix="/api", tags=["Export"])

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "UniClean AI Backend is running"}

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
