from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    published = Column(Boolean, default=False)
    background_asset = Column(JSON, nullable=True)
    background_loop = Column(Boolean, default=True)
    bg_custom_uploads = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    nodes = relationship(
        "Node",
        back_populates="story",
        cascade="all, delete-orphan",
        order_by="Node.order",
    )
    characters = relationship(
        "Character", back_populates="story", cascade="all, delete-orphan"
    )


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    name = Column(String, nullable=False)
    sprites = Column(JSON, nullable=False, default=dict)

    story = relationship("Story", back_populates="characters")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    order = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # "dialogue" | "text" | "quiz"
    data = Column(JSON, nullable=False, default=dict)

    story = relationship("Story", back_populates="nodes")
