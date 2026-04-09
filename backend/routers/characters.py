from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/stories/{story_id}/characters", tags=["characters"])


@router.get("/", response_model=List[schemas.Character])
def list_characters(story_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Character)
        .filter(models.Character.story_id == story_id)
        .all()
    )


@router.post("/", response_model=schemas.Character, status_code=201)
def create_character(
    story_id: int, character: schemas.CharacterCreate, db: Session = Depends(get_db)
):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    db_char = models.Character(**character.model_dump(), story_id=story_id)
    db.add(db_char)
    db.commit()
    db.refresh(db_char)
    return db_char


@router.patch("/{character_id}", response_model=schemas.Character)
def update_character(
    story_id: int,
    character_id: int,
    update: schemas.CharacterUpdate,
    db: Session = Depends(get_db),
):
    char = (
        db.query(models.Character)
        .filter(
            models.Character.id == character_id,
            models.Character.story_id == story_id,
        )
        .first()
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(char, field, value)
    db.commit()
    db.refresh(char)
    return char


@router.delete("/{character_id}", status_code=204)
def delete_character(
    story_id: int, character_id: int, db: Session = Depends(get_db)
):
    char = (
        db.query(models.Character)
        .filter(
            models.Character.id == character_id,
            models.Character.story_id == story_id,
        )
        .first()
    )
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    # Remove the character from all scenes in this story
    scenes = (
        db.query(models.Scene)
        .filter(models.Scene.story_id == story_id)
        .all()
    )
    for scene in scenes:
        if character_id in (scene.character_ids or []):
            scene.character_ids = [cid for cid in scene.character_ids if cid != character_id]
        positions = scene.character_positions or {}
        if str(character_id) in positions:
            scene.character_positions = {k: v for k, v in positions.items() if k != str(character_id)}

    db.delete(char)
    db.commit()
