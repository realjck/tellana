import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401 — registers all ORM models with Base.metadata
from database import Base, get_db
from main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Fresh in-memory DB + TestClient per test. Redirects uploads to tmp_path."""
    import routers.assets as assets_router
    monkeypatch.setattr(assets_router, "UPLOAD_DIR", tmp_path)

    # StaticPool ensures all ORM sessions share the same in-memory connection
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
