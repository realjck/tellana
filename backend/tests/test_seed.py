import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import Base
from main import _load_seeds

MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def seed_dir(tmp_path):
    """Fake seed_assets/ with 6 minimal valid PNGs."""
    for persona in ["alice", "bob"]:
        for pose in ["default", "happy", "surprised"]:
            p = tmp_path / "seed_assets" / "characters" / persona
            p.mkdir(parents=True, exist_ok=True)
            (p / f"{pose}.png").write_bytes(MINIMAL_PNG)
    return tmp_path / "seed_assets"


def test_seed_copies_files_to_uploads(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    for persona in ["alice", "bob"]:
        for pose in ["default", "happy", "surprised"]:
            assert (upload_dir / "characters" / persona / f"{pose}.png").exists()


def test_seed_inserts_db_with_is_seed_true(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    assets = db_session.query(models.Asset).all()
    assert len(assets) == 6
    assert all(a.is_seed for a in assets)
    folders = {a.folder for a in assets}
    assert folders == {"characters/alice", "characters/bob"}


def test_seed_is_idempotent(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    _load_seeds(db_session, upload_dir, seed_dir)
    assert db_session.query(models.Asset).count() == 6


def test_seed_skips_if_no_seed_dir(db_session, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, tmp_path / "nonexistent")
    assert db_session.query(models.Asset).count() == 0


def test_seed_does_not_overwrite_existing_file(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    dest = upload_dir / "characters" / "alice"
    dest.mkdir(parents=True)
    existing_content = b"existing content"
    (dest / "default.png").write_bytes(existing_content)
    _load_seeds(db_session, upload_dir, seed_dir)
    assert (dest / "default.png").read_bytes() == existing_content
