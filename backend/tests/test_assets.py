import io

import pytest
from sqlalchemy import text

# ── Shared helpers ─────────────────────────────────────────────────────────


def _create_asset(client, filename, folder, content_type="image/png"):
    """Insert an Asset directly into the test DB (POST /upload has no DB persistence yet)."""
    from main import app
    from database import get_db
    from models import Asset as AssetModel

    override = app.dependency_overrides.get(get_db)
    db = next(override())
    asset = AssetModel(
        filename=filename,
        url=f"/uploads/{folder}/{filename}",
        content_type=content_type,
        folder=folder,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

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


# ── Story 1.2 — Listing des assets par dossier ────────────────────────────


def test_list_assets_by_folder_exact_match(client):
    _create_asset(client, "bg1.png", "backgrounds")
    _create_asset(client, "bg2.png", "backgrounds")
    _create_asset(client, "alice.png", "characters/alice")

    res = client.get("/api/assets?folder=backgrounds")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert all(a["folder"] == "backgrounds" for a in data)
    assert "alice.png" not in [a["filename"] for a in data]


def test_list_assets_includes_schema_fields(client):
    _create_asset(client, "portrait.png", "characters/alice")

    res = client.get("/api/assets?folder=characters/alice")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    asset = data[0]
    for field in ("id", "filename", "url", "content_type", "folder", "is_seed"):
        assert field in asset


def test_list_assets_empty_folder(client):
    res = client.get("/api/assets?folder=backgrounds")
    assert res.status_code == 200
    assert res.json() == []


def test_list_assets_missing_folder_param(client):
    res = client.get("/api/assets")
    assert res.status_code == 422


def test_list_folders_sorted(client):
    _create_asset(client, "bob.png", "characters/bob")
    _create_asset(client, "bg.png", "backgrounds")
    _create_asset(client, "alice.png", "characters/alice")

    res = client.get("/api/assets/folders")
    assert res.status_code == 200
    assert res.json() == ["backgrounds", "characters/alice", "characters/bob"]


def test_list_folders_deduplicated(client):
    _create_asset(client, "bg1.png", "backgrounds")
    _create_asset(client, "bg2.png", "backgrounds")

    res = client.get("/api/assets/folders")
    assert res.status_code == 200
    assert res.json().count("backgrounds") == 1


def test_list_folders_empty(client):
    res = client.get("/api/assets/folders")
    assert res.status_code == 200
    assert res.json() == []


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


# ── Story 1.3 — Upload d'un asset dans un dossier ─────────────────────────


def test_create_asset_with_folder(client, tmp_path):
    res = client.post(
        "/api/assets",
        files={"file": ("portrait.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "characters/alice"
    assert data["filename"] == "portrait.png"
    assert data["url"] == "/uploads/characters/alice/portrait.png"
    assert data["content_type"] == "image/png"
    assert data["is_seed"] is False
    assert "id" in data
    assert (tmp_path / "characters" / "alice" / "portrait.png").exists()


def test_create_asset_default_folder(client, tmp_path):
    res = client.post(
        "/api/assets",
        files={"file": ("bg.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "backgrounds"
    assert data["url"] == "/uploads/backgrounds/bg.png"
    assert (tmp_path / "backgrounds" / "bg.png").exists()


def test_create_asset_normalizes_backslash_folder(client):
    res = client.post(
        "/api/assets",
        files={"file": ("img.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "characters\\alice"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "characters/alice"
    assert data["url"] == "/uploads/characters/alice/img.png"


def test_create_asset_persists_in_db(client):
    res = client.post(
        "/api/assets",
        files={"file": ("test.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "backgrounds"},
    )
    assert res.status_code == 200
    asset_id = res.json()["id"]

    res2 = client.get("/api/assets?folder=backgrounds")
    assert res2.status_code == 200
    ids = [a["id"] for a in res2.json()]
    assert asset_id in ids


def test_create_asset_invalid_type_rejected(client):
    res = client.post(
        "/api/assets",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        data={"folder": "backgrounds"},
    )
    assert res.status_code == 400


# ── Story 1.4 — Renommage de dossier et de fichier ────────────────────────


def _upload(client, filename, folder):
    return client.post(
        "/api/assets",
        files={"file": (filename, io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": folder},
    )


def test_rename_folder_updates_folder_and_url(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/alice-v2"},
    )
    assert res.status_code == 200

    listing = client.get("/api/assets?folder=characters/alice-v2").json()
    assert len(listing) == 1
    assert listing[0]["id"] == asset_id
    assert listing[0]["url"] == "/uploads/characters/alice-v2/portrait.png"
    # Disque renommé
    assert (tmp_path / "characters" / "alice-v2" / "portrait.png").exists()
    assert not (tmp_path / "characters" / "alice").exists()
    # Ancien dossier vide en DB
    assert client.get("/api/assets?folder=characters/alice").json() == []


def test_rename_folder_target_exists_conflict(client):
    _upload(client, "a.png", "characters/alice")
    _upload(client, "b.png", "characters/bob")

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/bob"},
    )
    assert res.status_code == 409
    # Aucune mutation : alice intacte
    assert len(client.get("/api/assets?folder=characters/alice").json()) == 1


def test_rename_folder_renames_subfolders(client):
    _upload(client, "main.png", "characters/alice")
    _upload(client, "pose.png", "characters/alice/poses")

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/anna"},
    )
    assert res.status_code == 200
    assert len(client.get("/api/assets?folder=characters/anna").json()) == 1
    sub = client.get("/api/assets?folder=characters/anna/poses").json()
    assert len(sub) == 1
    assert sub[0]["url"] == "/uploads/characters/anna/poses/pose.png"


def test_rename_folder_normalizes_backslash(client, tmp_path):
    _upload(client, "x.png", "characters/alice")

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters\\alice", "to": "characters\\anna"},
    )
    assert res.status_code == 200
    listing = client.get("/api/assets?folder=characters/anna").json()
    assert len(listing) == 1
    assert (tmp_path / "characters" / "anna" / "x.png").exists()


def test_rename_file_updates_db_and_disk(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]

    res = client.patch(
        f"/api/assets/{asset_id}/rename",
        json={"filename": "portrait-v2.png"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "portrait-v2.png"
    assert data["url"] == "/uploads/characters/alice/portrait-v2.png"
    assert (tmp_path / "characters" / "alice" / "portrait-v2.png").exists()
    assert not (tmp_path / "characters" / "alice" / "portrait.png").exists()


def test_rename_file_not_found(client):
    res = client.patch("/api/assets/999/rename", json={"filename": "x.png"})
    assert res.status_code == 404


# ── Story 1.5 — Détection et remplacement d'asset par même nom ─────────────


def test_upload_same_name_conflict_with_references(client):
    up = _upload(client, "portrait.png", "characters/alice").json()
    url = up["url"]  # /uploads/characters/alice/portrait.png

    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Sc"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "upload", "url": url}},
    )
    client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={"type": "dialogue", "data": {"text": "x", "img": url}, "order": 0},
    )

    res = client.post(
        "/api/assets",
        files={"file": ("portrait.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 409
    body = res.json()
    assert body["existing_id"] == up["id"]  # top-level, pas sous "detail"
    assert body["references"] == {"scenes": 1, "nodes": 1}


def test_upload_same_name_conflict_no_references(client):
    _upload(client, "portrait.png", "characters/alice")
    res = client.post(
        "/api/assets",
        files={"file": ("portrait.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 409
    assert res.json()["references"] == {"scenes": 0, "nodes": 0}


def test_upload_replace_overwrites_same_id(client, tmp_path):
    first = _upload(client, "portrait.png", "characters/alice").json()
    other_png = MINIMAL_JPEG  # contenu différent (image valide)

    res = client.post(
        "/api/assets?replace=true",
        files={"file": ("portrait.png", io.BytesIO(other_png), "image/jpeg")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 200
    assert res.json()["id"] == first["id"]  # même id
    # Une seule ligne en DB
    assert len(client.get("/api/assets?folder=characters/alice").json()) == 1
    # Fichier écrasé
    assert (tmp_path / "characters" / "alice" / "portrait.png").read_bytes() == other_png


def test_upload_new_name_no_conflict(client):
    _upload(client, "a.png", "characters/alice")
    res = _upload(client, "b.png", "characters/alice")
    assert res.status_code == 200


# ── Epic 1 review — patchs P1 (collision rename) & P2 (path traversal) ─────


def test_rename_file_target_name_conflict(client):
    _upload(client, "a.png", "characters/alice")
    b_id = _upload(client, "b.png", "characters/alice").json()["id"]

    res = client.patch(f"/api/assets/{b_id}/rename", json={"filename": "a.png"})
    assert res.status_code == 409
    # Les deux assets restent intacts
    names = [x["filename"] for x in client.get("/api/assets?folder=characters/alice").json()]
    assert sorted(names) == ["a.png", "b.png"]


def test_create_asset_rejects_path_traversal_folder(client):
    res = client.post(
        "/api/assets",
        files={"file": ("x.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "../escape"},
    )
    assert res.status_code == 400


def test_rename_folder_rejects_path_traversal(client):
    _upload(client, "x.png", "characters/alice")
    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "../escape"},
    )
    assert res.status_code == 400


# ── Story 2.1 — Support fichier .keep (placeholder dossier vide) ─────────────


def test_upload_keep_creates_folder_placeholder(client, tmp_path):
    res = client.post(
        "/api/assets",
        files={"file": (".keep", io.BytesIO(b""), "application/x-empty")},
        data={"folder": "characters/alice-v2"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == ".keep"
    assert data["content_type"] == "application/x-empty"
    assert data["folder"] == "characters/alice-v2"
    assert data["url"] == "/uploads/characters/alice-v2/.keep"
    assert (tmp_path / "characters" / "alice-v2" / ".keep").exists()


def test_upload_keep_is_idempotent(client):
    res1 = client.post(
        "/api/assets",
        files={"file": (".keep", io.BytesIO(b""), "application/x-empty")},
        data={"folder": "characters/alice-v2"},
    )
    assert res1.status_code == 200
    id1 = res1.json()["id"]

    res2 = client.post(
        "/api/assets",
        files={"file": (".keep", io.BytesIO(b""), "application/x-empty")},
        data={"folder": "characters/alice-v2"},
    )
    assert res2.status_code == 200
    assert res2.json()["id"] == id1  # même id, pas de doublon


def test_upload_keep_appears_in_folders_list(client):
    client.post(
        "/api/assets",
        files={"file": (".keep", io.BytesIO(b""), "application/x-empty")},
        data={"folder": "characters/new-folder"},
    )
    res = client.get("/api/assets/folders")
    assert res.status_code == 200
    assert "characters/new-folder" in res.json()


# ── Story 2.4 — Suppression d'asset ─────────────────────────────────────────


def test_delete_asset_removes_from_db_and_disk(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]
    assert (tmp_path / "characters" / "alice" / "portrait.png").exists()

    res = client.delete(f"/api/assets/{asset_id}")
    assert res.status_code == 204

    assert not (tmp_path / "characters" / "alice" / "portrait.png").exists()
    listing = client.get("/api/assets?folder=characters/alice").json()
    assert all(a["id"] != asset_id for a in listing)


def test_delete_asset_not_found(client):
    res = client.delete("/api/assets/999")
    assert res.status_code == 404


def test_delete_seed_asset_allowed(client):
    from main import app
    from database import get_db
    from models import Asset as AssetModel

    override = app.dependency_overrides.get(get_db)
    db = next(override())
    asset = AssetModel(
        filename="seed.png",
        url="/uploads/characters/alice/seed.png",
        content_type="image/png",
        folder="characters/alice",
        is_seed=True,
    )
    db.add(asset)
    db.commit()
    asset_id = asset.id

    res = client.delete(f"/api/assets/{asset_id}")
    assert res.status_code == 204
