import pytest


@pytest.fixture()
def story_id(client):
    return client.post("/api/stories/", json={"title": "Export Story"}).json()["id"]


def test_export_json_not_found(client):
    res = client.get("/api/stories/999/export-json")
    assert res.status_code == 404


def test_export_json_basic_structure(client, story_id):
    res = client.get(f"/api/stories/{story_id}/export-json")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == story_id
    assert data["title"] == "Export Story"
    assert "scenes" in data
    assert "characters" in data


def test_export_json_rewrites_upload_background(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "upload", "url": "/uploads/bg.png"}},
    )

    data = client.get(f"/api/stories/{story_id}/export-json").json()
    bg = data["scenes"][0]["background_asset"]
    assert bg["url"] == "assets/images/bg.png"


def test_export_json_rewrites_character_sprites(client, story_id):
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={
            "name": "Alice",
            "sprites": {
                "default": {"type": "upload", "url": "/uploads/alice.png"},
            },
        },
    ).json()["id"]

    data = client.get(f"/api/stories/{story_id}/export-json").json()
    sprite = data["characters"][0]["sprites"]["default"]
    assert sprite["url"] == "assets/images/alice.png"


def test_export_json_preserves_local_assets(client, story_id):
    """Local (bundled) asset URLs must not be rewritten."""
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "local", "url": "/background_1.png"}},
    )

    data = client.get(f"/api/stories/{story_id}/export-json").json()
    bg = data["scenes"][0]["background_asset"]
    assert bg["url"] == "/background_1.png"


def test_export_json_rewrites_bg_custom_uploads(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"bg_custom_uploads": ["/uploads/custom1.png", "/uploads/custom2.jpg"]},
    )

    data = client.get(f"/api/stories/{story_id}/export-json").json()
    uploads = data["scenes"][0]["bg_custom_uploads"]
    assert uploads == ["assets/images/custom1.png", "assets/images/custom2.jpg"]


def test_export_json_includes_nodes_and_positions(client, story_id):
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Bob", "sprites": {}},
    ).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "S1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={
            "character_ids": [char_id],
            "character_positions": {
                str(char_id): {"x": 0.5, "y": 0.0, "scale": 1.2, "flip_x": True}
            },
        },
    )
    client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={"type": "dialogue", "data": {"character_id": char_id, "text": "Hi"}, "order": 0},
    )

    data = client.get(f"/api/stories/{story_id}/export-json").json()
    scene = data["scenes"][0]
    assert len(scene["nodes"]) == 1
    assert scene["nodes"][0]["data"]["text"] == "Hi"
    assert scene["character_positions"][str(char_id)]["x"] == 0.5
    assert scene["character_positions"][str(char_id)]["flip_x"] is True
