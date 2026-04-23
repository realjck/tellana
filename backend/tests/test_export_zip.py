import io
import json
import zipfile

import pytest
import routers.stories as stories_router


@pytest.fixture()
def player_dist(tmp_path, monkeypatch):
    """Fake player-dist dir with minimal bundle files."""
    dist = tmp_path / "player-dist"
    dist.mkdir()
    (dist / "player-bundle.js").write_text("// fake bundle")
    (dist / "player-bundle.css").write_text("/* fake css */")
    (dist / "custom.css").write_text("/* custom */")
    monkeypatch.setattr(stories_router, "_PLAYER_DIST_DIR", dist)
    return dist


@pytest.fixture()
def upload_dir(tmp_path, monkeypatch):
    """Redirect _UPLOAD_DIR to tmp_path (already used by conftest for assets.UPLOAD_DIR)."""
    monkeypatch.setattr(stories_router, "_UPLOAD_DIR", tmp_path)
    return tmp_path


@pytest.fixture()
def story_id(client):
    return client.post("/api/stories/", json={"title": "Zip Story"}).json()["id"]


def test_export_zip_503_without_bundle(client, tmp_path, monkeypatch, story_id):
    empty_dist = tmp_path / "empty-dist"
    empty_dist.mkdir()
    monkeypatch.setattr(stories_router, "_PLAYER_DIST_DIR", empty_dist)
    res = client.get(f"/api/stories/{story_id}/export-zip")
    assert res.status_code == 503


def test_export_zip_404_unknown_story(client, player_dist, upload_dir):
    res = client.get("/api/stories/999/export-zip")
    assert res.status_code == 404


def _open_zip(response) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(response.content))


def test_export_zip_basic_structure(client, player_dist, upload_dir, story_id):
    res = client.get(f"/api/stories/{story_id}/export-zip")
    assert res.status_code == 200
    assert "application/zip" in res.headers["content-type"]
    assert "standalone.zip" in res.headers["content-disposition"]

    names = _open_zip(res).namelist()
    assert "index.html" in names
    assert "data/story.json" in names
    assert "assets/js/player-bundle.js" in names
    assert "assets/css/player-bundle.css" in names
    assert "assets/css/custom.css" in names


def test_export_zip_story_json_content(client, player_dist, upload_dir, story_id):
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {"default": {"type": "upload", "url": "/uploads/alice.png"}}},
    ).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "upload", "url": "/uploads/bg.png"}},
    )
    client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={"type": "dialogue", "data": {"character_id": char_id, "text": "Hi"}, "order": 0},
    )

    zf = _open_zip(client.get(f"/api/stories/{story_id}/export-zip"))
    story = json.loads(zf.read("data/story.json"))

    assert story["title"] == "Zip Story"
    assert story["scenes"][0]["background_asset"]["url"] == "assets/images/bg.png"
    assert story["characters"][0]["sprites"]["default"]["url"] == "assets/images/alice.png"
    assert story["scenes"][0]["nodes"][0]["data"]["text"] == "Hi"


def test_export_zip_bundles_upload_images(client, player_dist, upload_dir, story_id):
    (upload_dir / "photo.png").write_bytes(b"fakepng")
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "upload", "url": "/uploads/photo.png"}},
    )

    zf = _open_zip(client.get(f"/api/stories/{story_id}/export-zip"))
    assert "assets/images/photo.png" in zf.namelist()
    assert zf.read("assets/images/photo.png") == b"fakepng"


def test_export_zip_local_assets_rewritten(client, player_dist, upload_dir, tmp_path, monkeypatch, story_id):
    """Local sprites (bundled default assets) must be rewritten to assets/images/."""
    public_dir = tmp_path / "public"
    public_dir.mkdir()
    (public_dir / "sprite_woman.png").write_bytes(b"fakesprite")
    monkeypatch.setattr(stories_router, "_PUBLIC_DIR", public_dir)

    client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Bob", "sprites": {"default": {"type": "local", "url": "/sprite_woman.png"}}},
    )

    res = client.get(f"/api/stories/{story_id}/export-zip")
    zf = _open_zip(res)
    story = json.loads(zf.read("data/story.json"))

    assert story["characters"][0]["sprites"]["default"]["url"] == "assets/images/sprite_woman.png"
    assert "assets/images/sprite_woman.png" in zf.namelist()
    assert zf.read("assets/images/sprite_woman.png") == b"fakesprite"


def test_export_zip_missing_image_file_skipped(client, player_dist, upload_dir, story_id):
    """Missing image files on disk are skipped gracefully — no 500 error."""
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "upload", "url": "/uploads/missing.png"}},
    )

    res = client.get(f"/api/stories/{story_id}/export-zip")
    assert res.status_code == 200
    names = _open_zip(res).namelist()
    assert "assets/images/missing.png" not in names


def test_export_zip_index_html_contains_title(client, player_dist, upload_dir, story_id):
    zf = _open_zip(client.get(f"/api/stories/{story_id}/export-zip"))
    index = zf.read("index.html").decode()
    assert "<title>Zip Story</title>" in index
    assert 'src="assets/js/player-bundle.js"' in index
    assert 'href="assets/css/player-bundle.css"' in index
    assert 'href="assets/css/custom.css"' in index
