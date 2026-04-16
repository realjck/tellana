from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    published = Column(Boolean, default=False)
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
