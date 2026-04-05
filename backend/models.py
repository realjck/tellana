from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    published = Column(Boolean, default=False)
    background_url = Column(String, nullable=True)
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
    image_url = Column(String, nullable=False)
    position = Column(String, default="left")  # "left" or "right"

    story = relationship("Story", back_populates="characters")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    order = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # "dialogue" | "text" | "quiz"
    data = Column(JSON, nullable=False, default=dict)

    story = relationship("Story", back_populates="nodes")
