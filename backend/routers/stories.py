import html
import io
import json
import re
import shutil
import unicodedata
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from database import get_db

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_FRONTEND_DIR = _BACKEND_DIR.parent / "frontend"
_PLAYER_DIST_DIR = _FRONTEND_DIR / "player-dist"
_PUBLIC_DIR = _FRONTEND_DIR / "public"
_UPLOAD_DIR = _BACKEND_DIR / "uploads"
_PUBLISHED_DIR = _BACKEND_DIR / "published"

router = APIRouter(prefix="/stories", tags=["stories"])


def _generate_slug(title: str) -> str:
    # Transliterate accented chars (é→e, ç→c, etc.) before stripping
    normalized = unicodedata.normalize("NFKD", title.lower())
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", ascii_title)
    slug = re.sub(r"[\s_-]+", "-", slug).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:8]}"


@router.get("/", response_model=List[schemas.StorySummary])
def list_stories(db: Session = Depends(get_db)):
    stories = (
        db.query(models.Story)
        .options(selectinload(models.Story.characters), selectinload(models.Story.scenes))
        .order_by(models.Story.updated_at.desc())
        .all()
    )
    result = []
    for story in stories:
        first_scene = story.scenes[0] if story.scenes else None
        result.append(schemas.StorySummary(
            id=story.id,
            title=story.title,
            slug=story.slug,
            published=story.published,
            first_scene_background=first_scene.background_asset if first_scene else None,
            first_scene_character_ids=first_scene.character_ids if first_scene else [],
            first_scene_character_positions=first_scene.character_positions if first_scene else {},
            characters=[schemas.Character.model_validate(c) for c in story.characters],
            created_at=story.created_at,
            updated_at=story.updated_at,
        ))
    return result


@router.post("/", response_model=schemas.Story, status_code=201)
def create_story(story: schemas.StoryCreate, db: Session = Depends(get_db)):
    db_story = models.Story(title=story.title, slug=_generate_slug(story.title))
    db.add(db_story)
    db.commit()
    db.refresh(db_story)
    return db_story


@router.get("/by-slug/{slug}", response_model=schemas.PublicStory)
def get_story_by_slug(slug: str, db: Session = Depends(get_db)):
    story = (
        db.query(models.Story)
        .options(
            selectinload(models.Story.scenes).selectinload(models.Scene.nodes),
            selectinload(models.Story.characters),
        )
        .filter(models.Story.slug == slug, models.Story.published == True)
        .first()
    )
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _rewrite_upload_urls(obj):
    """Recursively rewrite /uploads/{f} → assets/images/{f} in serialized story data."""
    if isinstance(obj, dict):
        if obj.get("type") == "upload" and isinstance(obj.get("url"), str) and obj["url"].startswith("/uploads/"):
            obj = {**obj, "url": "assets/images/" + obj["url"][len("/uploads/"):]}
        return {k: _rewrite_upload_urls(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_rewrite_upload_urls(item) for item in obj]
    if isinstance(obj, str) and obj.startswith("/uploads/"):
        return "assets/images/" + obj[len("/uploads/"):]
    return obj


@router.get("/{story_id}/export-json", response_model=schemas.PublicStory)
def export_story_json(story_id: int, db: Session = Depends(get_db)):
    story = (
        db.query(models.Story)
        .options(
            selectinload(models.Story.scenes).selectinload(models.Scene.nodes),
            selectinload(models.Story.characters),
        )
        .filter(models.Story.id == story_id)
        .first()
    )
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    data = schemas.PublicStory.model_validate(story).model_dump(mode="json")
    return _rewrite_upload_urls(data)


def _collect_and_rewrite_local_assets(data) -> tuple:
    """Walk data, rewrite local /xxx.png → assets/images/xxx.png, collect files to copy.

    Returns (rewritten_data, dict mapping dest_filename → ("upload"|"local", src_ref)).
    Upload assets are already rewritten by _rewrite_upload_urls; we just collect them here.
    """
    files: dict[str, tuple[str, str]] = {}

    def walk(obj):
        if isinstance(obj, dict):
            asset_type = obj.get("type")
            url = obj.get("url")
            if asset_type in ("upload", "local") and isinstance(url, str):
                if url.startswith("assets/images/"):
                    files[url[len("assets/images/"):]] = ("upload", url[len("assets/images/"):])
                    return obj
                if asset_type == "local" and url.startswith("/"):
                    name = Path(url).name
                    files[name] = ("local", url)
                    return {**obj, "url": f"assets/images/{name}"}
            return {k: walk(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [walk(item) for item in obj]
        if isinstance(obj, str) and obj.startswith("assets/images/"):
            files[obj[len("assets/images/"):]] = ("upload", obj[len("assets/images/"):])
            return obj
        return obj

    return walk(data), files


def _generate_index_html(title: str) -> str:
    safe_title = html.escape(title)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>
  <link rel="stylesheet" href="assets/css/player-bundle.css">
  <link rel="stylesheet" href="assets/css/custom.css">
</head>
<body>
  <div id="root"></div>
  <script src="assets/js/player-bundle.js"></script>
</body>
</html>
"""


def _build_story_zip(story) -> io.BytesIO:
    """Build and return an in-memory ZIP for the given story."""
    player_js = _PLAYER_DIST_DIR / "player-bundle.js"
    if not player_js.exists():
        raise HTTPException(status_code=503, detail="Player bundle introuvable. Lancez : npm run build:player")

    data = schemas.PublicStory.model_validate(story).model_dump(mode="json")
    data = _rewrite_upload_urls(data)
    data, files_to_copy = _collect_and_rewrite_local_assets(data)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data/story.json", json.dumps(data, ensure_ascii=False, indent=2))
        zf.write(player_js, "assets/js/player-bundle.js")

        player_css = _PLAYER_DIST_DIR / "player-bundle.css"
        if player_css.exists():
            zf.write(player_css, "assets/css/player-bundle.css")

        custom_css = _PLAYER_DIST_DIR / "custom.css"
        if custom_css.exists():
            zf.write(custom_css, "assets/css/custom.css")
        else:
            zf.writestr("assets/css/custom.css", "/* Custom CSS */\n")

        for dest_name, (src_type, src_ref) in files_to_copy.items():
            src = _UPLOAD_DIR / src_ref if src_type == "upload" else _PUBLIC_DIR / src_ref.lstrip("/")
            if src.exists():
                zf.write(src, f"assets/images/{dest_name}")

        zf.writestr("index.html", _generate_index_html(story.title))

    buf.seek(0)
    return buf


def _load_full_story(story_id: int, db: Session):
    return (
        db.query(models.Story)
        .options(
            selectinload(models.Story.scenes).selectinload(models.Scene.nodes),
            selectinload(models.Story.characters),
        )
        .filter(models.Story.id == story_id)
        .first()
    )


@router.get("/{story_id}/export-zip")
def export_story_zip(story_id: int, db: Session = Depends(get_db)):
    story = _load_full_story(story_id, db)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    buf = _build_story_zip(story)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{story.slug}-standalone.zip"'},
    )


@router.post("/{story_id}/publish", response_model=schemas.Story)
def publish_story(story_id: int, db: Session = Depends(get_db)):
    story = _load_full_story(story_id, db)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    buf = _build_story_zip(story)

    pub_dir = _PUBLISHED_DIR / story.slug
    if pub_dir.exists():
        shutil.rmtree(pub_dir)
    pub_dir.mkdir(parents=True)
    with zipfile.ZipFile(buf) as zf:
        zf.extractall(pub_dir)

    story.published = True
    story.published_at = datetime.utcnow()
    db.commit()
    db.refresh(story)
    return story


@router.post("/{story_id}/unpublish", response_model=schemas.Story)
def unpublish_story(story_id: int, db: Session = Depends(get_db)):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    pub_dir = _PUBLISHED_DIR / story.slug
    if pub_dir.exists():
        shutil.rmtree(pub_dir)

    story.published = False
    db.commit()
    db.refresh(story)
    return story


@router.get("/{story_id}/play", response_model=schemas.PublicStory)
def get_story_for_play(story_id: int, db: Session = Depends(get_db)):
    story = (
        db.query(models.Story)
        .options(
            selectinload(models.Story.scenes).selectinload(models.Scene.nodes),
            selectinload(models.Story.characters),
        )
        .filter(models.Story.id == story_id)
        .first()
    )
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/{story_id}", response_model=schemas.Story)
def get_story(story_id: int, db: Session = Depends(get_db)):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.patch("/{story_id}", response_model=schemas.Story)
def update_story(
    story_id: int, update: schemas.StoryUpdate, db: Session = Depends(get_db)
):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(story, field, value)
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=204)
def delete_story(story_id: int, db: Session = Depends(get_db)):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(story)
    db.commit()
