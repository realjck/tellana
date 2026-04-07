import uuid
from pathlib import Path

import filetype
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/assets", tags=["assets"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")

    # Validate via magic bytes — ignore client-declared content_type
    kind = filetype.guess(content)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier invalide. Seules les images PNG, JPEG, WebP et GIF sont acceptées.",
        )

    ext = Path(file.filename or "upload").suffix or f".{kind.extension}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)

    return {"url": f"/uploads/{filename}"}
