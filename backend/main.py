from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import models
from database import engine
from routers import assets, characters, nodes, scenes, stories

# Create DB tables
models.Base.metadata.create_all(bind=engine)

# Safe migration: add character_positions column if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE scenes ADD COLUMN character_positions JSON DEFAULT '{}'"))
    except Exception:
        pass  # Column already exists

# Safe migration: add color column to characters if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE characters ADD COLUMN color TEXT"))
    except Exception:
        pass  # Column already exists

# Safe migration: add published_at column to stories if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE stories ADD COLUMN published_at DATETIME"))
    except Exception:
        pass  # Column already exists

# Ensure uploads and published dirs exist
Path("uploads").mkdir(exist_ok=True)
Path("published").mkdir(exist_ok=True)

app = FastAPI(title="Tellana API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/published", StaticFiles(directory="published", html=True), name="published")

app.include_router(stories.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(characters.router, prefix="/api")
app.include_router(assets.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "app": "Tellana API"}
