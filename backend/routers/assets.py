import json
import os
import uuid
from pathlib import Path
from typing import List

import filetype
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
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


def _normalize_folder(folder: str) -> str:
    """Normalize to POSIX slashes and reject path traversal (`..` segments)."""
    folder = folder.replace("\\", "/")
    if ".." in folder.split("/"):
        raise HTTPException(status_code=400, detail="Chemin de dossier invalide")
    return folder


def _count_references(db: Session, url: str) -> dict:
    """Count scenes and nodes whose JSON references the given asset url."""
    scene_count = 0
    for scene in db.query(models.Scene).all():
        bg = scene.background_asset
        if isinstance(bg, dict) and bg.get("url") == url:
            scene_count += 1
        elif url in (scene.bg_custom_uploads or []):
            scene_count += 1
    node_count = sum(
        1 for node in db.query(models.Node).all() if url in json.dumps(node.data or {})
    )
    return {"scenes": scene_count, "nodes": node_count}


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
    replace: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    folder = _normalize_folder(folder)
    content = await file.read()
    filename = Path(file.filename or "upload").name

    # .keep: folder placeholder — bypass image validation (idempotent)
    if filename == ".keep":
        existing_keep = (
            db.query(models.Asset)
            .filter(models.Asset.folder == folder, models.Asset.filename == ".keep")
            .first()
        )
        if existing_keep:
            return existing_keep
        (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
        (UPLOAD_DIR / folder / ".keep").touch()
        keep_asset = models.Asset(
            filename=".keep",
            url=f"/uploads/{folder}/.keep",
            content_type="application/x-empty",
            folder=folder,
        )
        db.add(keep_asset)
        db.commit()
        db.refresh(keep_asset)
        return keep_asset

    mime = _validate_image(content)
    existing = (
        db.query(models.Asset)
        .filter(models.Asset.folder == folder, models.Asset.filename == filename)
        .first()
    )
    if existing and not replace:
        return JSONResponse(
            status_code=409,
            content={
                "existing_id": existing.id,
                "references": _count_references(db, existing.url),
            },
        )
    (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / folder / filename).write_bytes(content)
    if existing:
        existing.content_type = mime
        existing.url = f"/uploads/{folder}/{filename}"  # no-op (same path), kept for clarity
        db.commit()
        db.refresh(existing)
        return existing
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


@router.patch("/folders")
def rename_folder(payload: schemas.FolderRename, db: Session = Depends(get_db)):
    src = _normalize_folder(payload.from_)
    dst = _normalize_folder(payload.to)
    src_path = UPLOAD_DIR / src
    dst_path = UPLOAD_DIR / dst
    if dst_path.exists():
        raise HTTPException(status_code=409, detail="Le dossier cible existe déjà")
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    os.rename(src_path, dst_path)  # disk first; SQL is skipped if this raises
    affected = (
        db.query(models.Asset)
        .filter((models.Asset.folder == src) | (models.Asset.folder.like(f"{src}/%")))
        .all()
    )
    for asset in affected:
        new_folder = dst + asset.folder[len(src):]
        asset.folder = new_folder
        asset.url = f"/uploads/{new_folder}/{asset.filename}"
    db.commit()
    return {"updated": len(affected)}


@router.patch("/{asset_id}/rename", response_model=schemas.Asset)
def rename_file(asset_id: int, payload: schemas.FileRename, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset introuvable")
    new_filename = Path(payload.filename).name  # basename only — prevents path traversal
    clash = (
        db.query(models.Asset)
        .filter(
            models.Asset.folder == asset.folder,
            models.Asset.filename == new_filename,
            models.Asset.id != asset.id,
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=409, detail="Un asset porte déjà ce nom dans ce dossier")
    (UPLOAD_DIR / asset.folder / asset.filename).rename(UPLOAD_DIR / asset.folder / new_filename)
    asset.filename = new_filename
    asset.url = f"/uploads/{asset.folder}/{new_filename}"
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset introuvable")
    file_path = UPLOAD_DIR / asset.folder / asset.filename
    db.delete(asset)
    db.commit()
    if file_path.exists():
        file_path.unlink()


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    mime = _validate_image(content)
    ext = Path(file.filename or "upload").suffix or f".{mime.split('/')[1]}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
