import uuid
from pathlib import Path
from typing import List

import filetype
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/assets", tags=["assets"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _validate_image(content: bytes) -> str:
    """Validate image via magic bytes. Returns mime type or raises 400."""
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")
    kind = filetype.guess(content)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier invalide. Seules les images PNG, JPEG, WebP et GIF sont acceptées.",
        )
    return kind.mime


@router.get("/folders", response_model=List[str])
def list_folders(db: Session = Depends(get_db)):
    rows = db.query(models.Asset.folder).distinct().order_by(models.Asset.folder).all()
    return [row[0] for row in rows]


@router.get("/", response_model=List[schemas.Asset])
def list_assets(folder: str = Query(...), db: Session = Depends(get_db)):
    return db.query(models.Asset).filter(models.Asset.folder == folder).all()


@router.post("/", response_model=schemas.Asset)
async def create_asset(
    file: UploadFile = File(...),
    folder: str = Form(default="backgrounds"),
    db: Session = Depends(get_db),
):
    folder = folder.replace("\\", "/")
    content = await file.read()
    mime = _validate_image(content)
    (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "upload").name
    (UPLOAD_DIR / folder / filename).write_bytes(content)
    db_asset = models.Asset(
        filename=filename,
        url=f"/uploads/{folder}/{filename}",
        content_type=mime,
        folder=folder,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    mime = _validate_image(content)
    ext = Path(file.filename or "upload").suffix or f".{mime.split('/')[1]}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
