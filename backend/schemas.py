from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


# ── Character ──────────────────────────────────────────────────────────────

class CharacterBase(BaseModel):
    name: str
    image_url: str
    position: str = "left"


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None
    position: Optional[str] = None


class Character(CharacterBase):
    id: int
    story_id: int

    model_config = {"from_attributes": True}


# ── Node ───────────────────────────────────────────────────────────────────

class NodeBase(BaseModel):
    type: str
    data: Dict[str, Any] = {}
    order: int


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    type: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    order: Optional[int] = None


class Node(NodeBase):
    id: int
    story_id: int

    model_config = {"from_attributes": True}


# ── Story ──────────────────────────────────────────────────────────────────

class StoryBase(BaseModel):
    title: str
    background_url: Optional[str] = None


class StoryCreate(StoryBase):
    pass


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    background_url: Optional[str] = None
    published: Optional[bool] = None


class StorySummary(StoryBase):
    id: int
    slug: str
    published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Story(StoryBase):
    id: int
    slug: str
    published: bool
    created_at: datetime
    updated_at: datetime
    nodes: List[Node] = []
    characters: List[Character] = []

    model_config = {"from_attributes": True}


# ── Reorder ────────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    order: List[int]
