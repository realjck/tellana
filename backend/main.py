import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import models
from database import engine, SessionLocal
from routers import assets, characters, graph, nodes, scenes, stories

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

# Safe migration: add source_handle column to graph_edges if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE graph_edges ADD COLUMN source_handle TEXT"))
    except Exception:
        pass  # Column already exists

# Safe migration: add folder column to assets if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE assets ADD COLUMN folder TEXT DEFAULT 'backgrounds'"))
    except Exception:
        pass  # Column already exists

# Safe migration: add is_seed column to assets if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE assets ADD COLUMN is_seed BOOLEAN DEFAULT FALSE"))
    except Exception:
        pass  # Column already exists

# Ensure uploads and published dirs exist
Path("uploads").mkdir(exist_ok=True)
Path("published").mkdir(exist_ok=True)

SEED_ASSETS_DIR = Path("seed_assets")


def _load_seeds(db, upload_dir: Path, seed_dir: Path) -> None:
    """Copy seed PNGs to upload_dir and register in DB. Idempotent."""
    if not seed_dir.exists():
        return
    for src_file in sorted(seed_dir.rglob("*.png")):
        rel = src_file.relative_to(seed_dir)
        folder = rel.parent.as_posix()
        filename = src_file.name
        dest_dir = upload_dir / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / filename
        if not dest_file.exists():
            shutil.copy2(src_file, dest_file)
        existing = (
            db.query(models.Asset)
            .filter(models.Asset.folder == folder, models.Asset.filename == filename)
            .first()
        )
        if not existing:
            db.add(
                models.Asset(
                    filename=filename,
                    url=f"/uploads/{folder}/{filename}",
                    content_type="image/png",
                    folder=folder,
                    is_seed=True,
                )
            )
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import routers.assets as _assets_router
    db = SessionLocal()
    try:
        _load_seeds(db, _assets_router.UPLOAD_DIR, SEED_ASSETS_DIR)
    finally:
        db.close()
    yield


app = FastAPI(title="Tellana API", version="0.1.0", lifespan=lifespan)

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
app.include_router(graph.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "app": "Tellana API"}
