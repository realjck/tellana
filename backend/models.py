from sqlalchemy import Column, Integer, Float, String, Boolean, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    published = Column(Boolean, default=False)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    scenes = relationship(
        "Scene",
        back_populates="story",
        cascade="all, delete-orphan",
        order_by="Scene.order",
    )
    characters = relationship(
        "Character", back_populates="story", cascade="all, delete-orphan"
    )
    graph_nodes = relationship(
        "GraphNode", back_populates="story", cascade="all, delete-orphan"
    )
    graph_edges = relationship(
        "GraphEdge", back_populates="story", cascade="all, delete-orphan"
    )


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    title = Column(String, nullable=False)
    order = Column(Integer, nullable=False)
    background_asset = Column(JSON, nullable=True)
    background_loop = Column(Boolean, default=True)
    bg_custom_uploads = Column(JSON, nullable=False, default=list)
    character_ids = Column(JSON, nullable=False, default=list)
    character_positions = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    story = relationship("Story", back_populates="scenes")
    nodes = relationship(
        "Node",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="Node.order",
    )


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)
    sprites = Column(JSON, nullable=False, default=dict)

    story = relationship("Story", back_populates="characters")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    order = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # "dialogue" | "text" | "quiz"
    # Future node types (not yet implemented): "image", "video", "image_text"
    data = Column(JSON, nullable=False, default=dict)

    scene = relationship("Scene", back_populates="nodes")


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    type = Column(String, nullable=False)  # "start" | "scene" | "branch" | "end"
    position_x = Column(Float, nullable=False, default=0.0)
    position_y = Column(Float, nullable=False, default=0.0)
    data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    story = relationship("Story", back_populates="graph_nodes")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    source_node_id = Column(Integer, ForeignKey("graph_nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("graph_nodes.id"), nullable=False)
    label = Column(String, nullable=True)
    source_handle = Column(String, nullable=True)
    order = Column(Integer, nullable=False, default=0)

    story = relationship("Story", back_populates="graph_edges")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    url = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    folder = Column(String, nullable=False, default="backgrounds")
    is_seed = Column(Boolean, nullable=False, default=False)
