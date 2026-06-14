from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict, Literal
from datetime import datetime

NodeType = Literal["dialogue", "text", "quiz"]
# Future node types (not yet implemented): "image", "video", "image_text"

GraphNodeType = Literal["start", "scene", "branch", "end"]

AssetSourceType = Literal["upload", "remote", "local", "generated"]


# ── Asset ──────────────────────────────────────────────────────────────────

class Asset(BaseModel):
    id: int
    filename: str
    url: str
    content_type: str
    folder: str
    is_seed: bool

    model_config = {"from_attributes": True}


class FolderRename(BaseModel):
    from_: str = Field(alias="from")  # `from` is a reserved keyword
    to: str


class FileRename(BaseModel):
    filename: str


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
    color: Optional[str] = None
    sprites: Dict[str, AssetRef] = {}


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
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
    scene_id: int

    model_config = {"from_attributes": True}


# ── Scene ──────────────────────────────────────────────────────────────────

class CharacterPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0
    flip_x: bool = False


class SceneCreate(BaseModel):
    title: str


class SceneUpdate(BaseModel):
    title: Optional[str] = None
    background_asset: Optional[AssetRef] = None
    background_loop: Optional[bool] = None
    bg_custom_uploads: Optional[List[str]] = None
    character_ids: Optional[List[int]] = None
    character_positions: Optional[Dict[str, CharacterPosition]] = None


class SceneSummary(BaseModel):
    id: int
    story_id: int
    title: str
    order: int
    background_asset: Optional[AssetRef] = None
    background_loop: bool
    character_ids: List[int] = []
    character_positions: Dict[str, CharacterPosition] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Scene(SceneSummary):
    nodes: List[Node] = []
    bg_custom_uploads: List[str] = []


# ── Story ──────────────────────────────────────────────────────────────────

class StoryBase(BaseModel):
    title: str


class StoryCreate(StoryBase):
    pass


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    published: Optional[bool] = None


class StorySummary(BaseModel):
    id: int
    title: str
    slug: str
    published: bool
    published_at: Optional[datetime] = None
    first_scene_background: Optional[AssetRef] = None
    first_scene_character_ids: List[int] = []
    first_scene_character_positions: Dict[str, CharacterPosition] = {}
    characters: List[Character] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Story(StoryBase):
    id: int
    slug: str
    published: bool
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    scenes: List[SceneSummary] = []
    characters: List[Character] = []

    model_config = {"from_attributes": True}


# For the public by-slug endpoint: scenes include their nodes
class PublicStory(StoryBase):
    id: int
    slug: str
    published: bool
    created_at: datetime
    updated_at: datetime
    scenes: List[Scene] = []
    characters: List[Character] = []

    model_config = {"from_attributes": True}


# ── Reorder ────────────────────────────────────────────────────────────────

class ReorderRequest(BaseModel):
    order: List[int]


# ── Graph ──────────────────────────────────────────────────────────────────

class GraphNodeCreate(BaseModel):
    type: GraphNodeType
    position_x: float = 0.0
    position_y: float = 0.0
    data: Dict[str, Any] = {}


class GraphNodeUpdate(BaseModel):
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    data: Optional[Dict[str, Any]] = None


class GraphNode(BaseModel):
    id: int
    story_id: int
    type: GraphNodeType
    position_x: float
    position_y: float
    data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GraphEdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    label: Optional[str] = None
    source_handle: Optional[str] = None
    order: int = 0


class GraphEdge(BaseModel):
    id: int
    story_id: int
    source_node_id: int
    target_node_id: int
    label: Optional[str] = None
    source_handle: Optional[str] = None
    order: int

    model_config = {"from_attributes": True}


class GraphResponse(BaseModel):
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []
