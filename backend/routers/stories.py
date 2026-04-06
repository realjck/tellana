import re
import unicodedata
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
    return db.query(models.Story).order_by(models.Story.updated_at.desc()).all()


@router.post("/", response_model=schemas.Story, status_code=201)
def create_story(story: schemas.StoryCreate, db: Session = Depends(get_db)):
    db_story = models.Story(**story.model_dump(), slug=_generate_slug(story.title))
    db.add(db_story)
    db.commit()
    db.refresh(db_story)
    return db_story


@router.get("/by-slug/{slug}", response_model=schemas.Story)
def get_story_by_slug(slug: str, db: Session = Depends(get_db)):
    story = (
        db.query(models.Story)
        .filter(models.Story.slug == slug, models.Story.published == True)
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
