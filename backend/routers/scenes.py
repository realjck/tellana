from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/stories/{story_id}/scenes", tags=["scenes"])


def _get_story_or_404(story_id: int, db: Session) -> models.Story:
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _get_scene_or_404(story_id: int, scene_id: int, db: Session) -> models.Scene:
    scene = (
        db.query(models.Scene)
        .filter(models.Scene.id == scene_id, models.Scene.story_id == story_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.get("/", response_model=List[schemas.SceneSummary])
def list_scenes(story_id: int, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)
    return (
        db.query(models.Scene)
        .filter(models.Scene.story_id == story_id)
        .order_by(models.Scene.order)
        .all()
    )


@router.post("/", response_model=schemas.Scene, status_code=201)
def create_scene(story_id: int, body: schemas.SceneCreate, db: Session = Depends(get_db)):
    story = _get_story_or_404(story_id, db)
    scene_count = (
        db.query(models.Scene).filter(models.Scene.story_id == story_id).count()
    )
    db_scene = models.Scene(
        story_id=story_id,
        title=body.title,
        order=scene_count,
    )
    db.add(db_scene)
    db.commit()
    db.refresh(db_scene)
    return db_scene


@router.get("/{scene_id}", response_model=schemas.Scene)
def get_scene(story_id: int, scene_id: int, db: Session = Depends(get_db)):
    return _get_scene_or_404(story_id, scene_id, db)


@router.patch("/{scene_id}", response_model=schemas.Scene)
def update_scene(
    story_id: int,
    scene_id: int,
    update: schemas.SceneUpdate,
    db: Session = Depends(get_db),
):
    scene = _get_scene_or_404(story_id, scene_id, db)
    update_data = update.model_dump(exclude_unset=True)

    if "character_ids" in update_data:
        ids = update_data["character_ids"]
        if len(ids) > 4:
            raise HTTPException(status_code=400, detail="Maximum 4 characters per scene")
        valid_ids = {
            c.id
            for c in db.query(models.Character)
            .filter(models.Character.story_id == story_id)
            .all()
        }
        if any(cid not in valid_ids for cid in ids):
            raise HTTPException(status_code=400, detail="Invalid character IDs")

    for field, value in update_data.items():
        setattr(scene, field, value)
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=204)
def delete_scene(story_id: int, scene_id: int, db: Session = Depends(get_db)):
    scene = _get_scene_or_404(story_id, scene_id, db)
    db.delete(scene)
    db.commit()


@router.post("/reorder", response_model=List[schemas.SceneSummary])
def reorder_scenes(
    story_id: int, body: schemas.ReorderRequest, db: Session = Depends(get_db)
):
    _get_story_or_404(story_id, db)
    scenes = {
        s.id: s
        for s in db.query(models.Scene)
        .filter(models.Scene.story_id == story_id)
        .all()
    }
    if any(scene_id not in scenes for scene_id in body.order):
        raise HTTPException(status_code=400, detail="Invalid scene IDs in reorder request")
    for index, scene_id in enumerate(body.order):
        scenes[scene_id].order = index
    db.commit()
    return sorted(scenes.values(), key=lambda s: s.order)
