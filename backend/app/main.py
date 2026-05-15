# FastAPI application entry point
# TODO: Initialize FastAPI app, configure CORS middleware, and register routers
# (upload, analysis, employees, squad)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="GhostBuster API",
    description="AI-Powered Ghost Worker Detection System",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://ghostbuster-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "GhostBuster API is running",
        "version": "1.0.0",
        "status": "healthy"
    }

# TODO: Include routers here
# from app.routers import upload, analysis, employees, squad
# app.include_router(upload.router, prefix="/api", tags=["upload"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)