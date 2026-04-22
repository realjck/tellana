import re
import unicodedata
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from database import get_db

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
