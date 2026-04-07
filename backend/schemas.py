from pydantic import BaseModel
from typing import Optional, List, Any, Dict, Literal
from datetime import datetime

NodeType = Literal["dialogue", "text", "quiz"]
# Future node types (not yet implemented): "image", "video", "image_text"

AssetSourceType = Literal["upload", "remote", "local", "generated"]


# ── AssetRef ───────────────────────────────────────────────────────────────

class AssetRef(BaseModel):
    type: AssetSourceType
    url: Optional[str] = None
    opfs_key: Optional[str] = None
    job_id: Optional[str] = None
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


# ── Character ──────────────────────────────────────────────────────────────

class CharacterBase(BaseModel):
    name: str
    sprites: Dict[str, AssetRef] = {}


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    sprites: Optional[Dict[str, AssetRef]] = None


class Character(CharacterBase):
    id: int
    story_id: int

    model_config = {"from_attributes": True}


# ── Node ───────────────────────────────────────────────────────────────────

class NodeBase(BaseModel):
    type: NodeType
    data: Dict[str, Any] = {}
    order: int


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    type: Optional[NodeType] = None
    data: Optional[Dict[str, Any]] = None
    order: Optional[int] = None


class Node(NodeBase):
    id: int
    story_id: int

    model_config = {"from_attributes": True}


# ── Story ──────────────────────────────────────────────────────────────────

class StoryBase(BaseModel):
    title: str
    background_asset: Optional[AssetRef] = None
    background_loop: bool = True


class StoryCreate(StoryBase):
    pass


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    background_asset: Optional[AssetRef] = None
    background_loop: Optional[bool] = None
    published: Optional[bool] = None
    bg_custom_uploads: Optional[List[str]] = None


class StorySummary(StoryBase):
    id: int
    slug: str
    published: bool
    bg_custom_uploads: List[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Story(StoryBase):
    id: int
    slug: str
    published: bool
    bg_custom_uploads: List[str] = []
    created_at: datetime
    updated_at: datetime
    nodes: List[Node] = []
    characters: List[Character] = []

    model_config = {"from_attributes": True}


# ── Reorder ────────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    order: List[int]
