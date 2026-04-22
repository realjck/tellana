from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db


def _touch_story(story_id: int, db: Session):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if story:
        story.updated_at = datetime.utcnow()

router = APIRouter(prefix="/stories/{story_id}/scenes/{scene_id}/nodes", tags=["nodes"])


def _get_scene_or_404(story_id: int, scene_id: int, db: Session) -> models.Scene:
    scene = (
        db.query(models.Scene)
        .filter(models.Scene.id == scene_id, models.Scene.story_id == story_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.get("/", response_model=List[schemas.Node])
def list_nodes(story_id: int, scene_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Node)
        .filter(models.Node.scene_id == scene_id)
        .order_by(models.Node.order)
        .all()
    )


@router.post("/", response_model=schemas.Node, status_code=201)
def create_node(
    story_id: int, scene_id: int, node: schemas.NodeCreate, db: Session = Depends(get_db)
):
    _get_scene_or_404(story_id, scene_id, db)
    db_node = models.Node(**node.model_dump(), scene_id=scene_id)
    db.add(db_node)
    _touch_story(story_id, db)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.patch("/{node_id}", response_model=schemas.Node)
def update_node(
    story_id: int,
    scene_id: int,
    node_id: int,
    update: schemas.NodeUpdate,
    db: Session = Depends(get_db),
):
    node = (
        db.query(models.Node)
        .filter(models.Node.id == node_id, models.Node.scene_id == scene_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    _touch_story(story_id, db)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}", status_code=204)
def delete_node(story_id: int, scene_id: int, node_id: int, db: Session = Depends(get_db)):
    node = (
        db.query(models.Node)
        .filter(models.Node.id == node_id, models.Node.scene_id == scene_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    db.delete(node)
    _touch_story(story_id, db)
    db.commit()


@router.post("/reorder", response_model=List[schemas.Node])
def reorder_nodes(
    story_id: int, scene_id: int, body: schemas.ReorderRequest, db: Session = Depends(get_db)
):
    _get_scene_or_404(story_id, scene_id, db)
    nodes = {
        n.id: n
        for n in db.query(models.Node)
        .filter(models.Node.scene_id == scene_id)
        .all()
    }
    if any(node_id not in nodes for node_id in body.order):
        raise HTTPException(status_code=400, detail="Invalid node IDs in reorder request")
    for index, node_id in enumerate(body.order):
        nodes[node_id].order = index
    _touch_story(story_id, db)
    db.commit()
    return sorted(nodes.values(), key=lambda n: n.order)
