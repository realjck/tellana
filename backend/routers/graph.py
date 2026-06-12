from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/stories", tags=["graph"])


def _get_story_or_404(story_id: int, db: Session):
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/{story_id}/graph", response_model=schemas.GraphResponse)
def get_graph(story_id: int, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)
    nodes = db.query(models.GraphNode).filter(models.GraphNode.story_id == story_id).all()
    edges = db.query(models.GraphEdge).filter(models.GraphEdge.story_id == story_id).all()
    return schemas.GraphResponse(nodes=nodes, edges=edges)


@router.post("/{story_id}/graph/nodes", response_model=schemas.GraphNode, status_code=201)
def create_graph_node(story_id: int, node: schemas.GraphNodeCreate, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)

    if node.type == "start":
        existing = db.query(models.GraphNode).filter(
            models.GraphNode.story_id == story_id,
            models.GraphNode.type == "start",
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A start node already exists for this story")

    db_node = models.GraphNode(
        story_id=story_id,
        type=node.type,
        position_x=node.position_x,
        position_y=node.position_y,
        data=node.data,
    )
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.patch("/{story_id}/graph/nodes/{node_id}", response_model=schemas.GraphNode)
def update_graph_node(
    story_id: int, node_id: int, update: schemas.GraphNodeUpdate, db: Session = Depends(get_db)
):
    _get_story_or_404(story_id, db)
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == node_id,
        models.GraphNode.story_id == story_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{story_id}/graph/nodes/{node_id}", status_code=204)
def delete_graph_node(story_id: int, node_id: int, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)
    node = db.query(models.GraphNode).filter(
        models.GraphNode.id == node_id,
        models.GraphNode.story_id == story_id,
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    db.query(models.GraphEdge).filter(
        or_(
            models.GraphEdge.source_node_id == node_id,
            models.GraphEdge.target_node_id == node_id,
        )
    ).delete(synchronize_session=False)

    db.delete(node)
    db.commit()


@router.post("/{story_id}/graph/edges", response_model=schemas.GraphEdge, status_code=201)
def create_graph_edge(story_id: int, edge: schemas.GraphEdgeCreate, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)

    source = db.query(models.GraphNode).filter(
        models.GraphNode.id == edge.source_node_id,
        models.GraphNode.story_id == story_id,
    ).first()
    if not source:
        raise HTTPException(status_code=400, detail="Source node not found in this story")

    target = db.query(models.GraphNode).filter(
        models.GraphNode.id == edge.target_node_id,
        models.GraphNode.story_id == story_id,
    ).first()
    if not target:
        raise HTTPException(status_code=400, detail="Target node not found in this story")

    if source.type == "branch":
        outgoing_count = db.query(models.GraphEdge).filter(
            models.GraphEdge.source_node_id == edge.source_node_id,
        ).count()
        if outgoing_count >= 5:
            raise HTTPException(status_code=400, detail="Branch node cannot have more than 5 outgoing edges")

    db_edge = models.GraphEdge(
        story_id=story_id,
        source_node_id=edge.source_node_id,
        target_node_id=edge.target_node_id,
        label=edge.label,
        order=edge.order,
    )
    db.add(db_edge)
    db.commit()
    db.refresh(db_edge)
    return db_edge


@router.delete("/{story_id}/graph/edges/{edge_id}", status_code=204)
def delete_graph_edge(story_id: int, edge_id: int, db: Session = Depends(get_db)):
    _get_story_or_404(story_id, db)
    edge = db.query(models.GraphEdge).filter(
        models.GraphEdge.id == edge_id,
        models.GraphEdge.story_id == story_id,
    ).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    db.delete(edge)
    db.commit()
