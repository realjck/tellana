import io

import pytest
from sqlalchemy import text

# Minimal valid 1×1 PNG
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)

# Minimal JPEG header (SOI + APP0 marker)
MINIMAL_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


def test_upload_valid_image(client):
    res = client.post(
        "/api/assets/upload",
        files={"file": ("test.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    assert res.status_code == 200
    assert res.json()["url"].startswith("/uploads/")
    assert res.json()["url"].endswith(".png")


def test_upload_invalid_content_type_rejected_by_client_header(client):
    """Client-declared PDF → rejected (magic bytes check: no valid image signature)."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake content"), "application/pdf")},
    )
    assert res.status_code == 400


def test_upload_magic_bytes_override_client_header(client):
    """PNG bytes sent with a spoofed application/pdf content_type must still be accepted."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("trick.pdf", io.BytesIO(MINIMAL_PNG), "application/pdf")},
    )
    # Magic bytes say PNG → accepted despite wrong declared type
    assert res.status_code == 200


def test_upload_pdf_bytes_with_image_type_rejected(client):
    """PDF bytes sent with image/png content_type must be rejected (bad magic bytes)."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("evil.png", io.BytesIO(b"%PDF-1.4 fake content"), "image/png")},
    )
    assert res.status_code == 400


def test_upload_writes_file(client, tmp_path):
    """Uploaded file must be present on disk."""
    res = client.post(
        "/api/assets/upload",
        files={"file": ("img.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    filename = res.json()["url"].split("/")[-1]
    assert (tmp_path / filename).exists()


# ── Story 1.1 — Migration modèle Asset ────────────────────────────────────


def test_asset_pydantic_schema_includes_folder_and_is_seed():
    """Asset Pydantic schema must expose folder and is_seed fields."""
    from schemas import Asset as AssetSchema

    asset = AssetSchema(
        id=1,
        filename="portrait.png",
        url="/uploads/characters/alice/portrait.png",
        content_type="image/png",
        folder="characters/alice",
        is_seed=True,
    )
    data = asset.model_dump()
    assert data["folder"] == "characters/alice"
    assert data["is_seed"] is True


def test_asset_model_columns():
    """Asset SQLAlchemy model must declare folder and is_seed columns."""
    from models import Asset as AssetModel

    column_names = {c.name for c in AssetModel.__table__.columns}
    assert "folder" in column_names
    assert "is_seed" in column_names
    assert "id" in column_names
    assert "filename" in column_names
    assert "url" in column_names
    assert "content_type" in column_names


def test_asset_table_created_with_folder_and_is_seed(client):
    """After DB creation, the assets table must contain folder and is_seed columns."""
    from main import app
    from database import get_db

    override = app.dependency_overrides.get(get_db)
    db = next(override())
    rows = db.execute(text("PRAGMA table_info(assets)")).fetchall()
    column_names = {row[1] for row in rows}
    assert "folder" in column_names
    assert "is_seed" in column_names


def test_asset_defaults(client):
    """Asset created without explicit folder/is_seed must use defaults."""
    from main import app
    from database import get_db
    from models import Asset as AssetModel
    from schemas import Asset as AssetSchema

    override = app.dependency_overrides.get(get_db)
    db = next(override())

    asset = AssetModel(
        filename="bg.png",
        url="/uploads/backgrounds/bg.png",
        content_type="image/png",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    schema = AssetSchema.model_validate(asset)
    assert schema.folder == "backgrounds"
    assert schema.is_seed is False
