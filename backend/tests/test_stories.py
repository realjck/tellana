def test_create_story(client):
    res = client.post("/api/stories/", json={"title": "Ma Story"})
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Ma Story"
    assert "slug" in data
    assert data["published"] is False
    assert "scenes" in data
    assert data["scenes"] == []


def test_slug_ascii_transliteration(client):
    res = client.post("/api/stories/", json={"title": "Épisode 1 : L'été"})
    assert res.status_code == 201
    slug = res.json()["slug"]
    assert "episode" in slug
    assert "É" not in slug


def test_slug_is_unique(client):
    r1 = client.post("/api/stories/", json={"title": "Same Title"})
    r2 = client.post("/api/stories/", json={"title": "Same Title"})
    assert r1.json()["slug"] != r2.json()["slug"]


def test_list_stories(client):
    client.post("/api/stories/", json={"title": "A"})
    client.post("/api/stories/", json={"title": "B"})
    res = client.get("/api/stories/")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_stories_first_scene_background(client):
    story_id = client.post("/api/stories/", json={"title": "X"}).json()["id"]
    # No scenes → first_scene_background is null
    res = client.get("/api/stories/")
    assert res.json()[0]["first_scene_background"] is None

    # Add a scene with a background
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène 1"}
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "local", "url": "/bg.png"}},
    )
    res = client.get("/api/stories/")
    assert res.json()[0]["first_scene_background"]["url"] == "/bg.png"


def test_get_story(client):
    story_id = client.post("/api/stories/", json={"title": "X"}).json()["id"]
    res = client.get(f"/api/stories/{story_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "X"
    assert "scenes" in data
    assert "characters" in data


def test_get_story_not_found(client):
    res = client.get("/api/stories/9999")
    assert res.status_code == 404


def test_update_story_title(client):
    story_id = client.post("/api/stories/", json={"title": "Old"}).json()["id"]
    res = client.patch(f"/api/stories/{story_id}", json={"title": "New"})
    assert res.status_code == 200
    assert res.json()["title"] == "New"


def test_publish_story(client):
    story_id = client.post("/api/stories/", json={"title": "Draft"}).json()["id"]
    res = client.patch(f"/api/stories/{story_id}", json={"published": True})
    assert res.json()["published"] is True


def test_get_by_slug_unpublished(client):
    story = client.post("/api/stories/", json={"title": "Hidden"}).json()
    res = client.get(f"/api/stories/by-slug/{story['slug']}")
    assert res.status_code == 404


def test_get_by_slug_published(client):
    story = client.post("/api/stories/", json={"title": "Public"}).json()
    client.patch(f"/api/stories/{story['id']}", json={"published": True})
    # Add a scene with a node
    scene_id = client.post(
        f"/api/stories/{story['id']}/scenes/", json={"title": "Scène 1"}
    ).json()["id"]
    client.post(
        f"/api/stories/{story['id']}/scenes/{scene_id}/nodes/",
        json={"type": "dialogue", "data": {"character_id": None, "text": "Hi"}, "order": 0},
    )
    res = client.get(f"/api/stories/by-slug/{story['slug']}")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Public"
    assert "scenes" in data
    assert len(data["scenes"]) == 1
    assert len(data["scenes"][0]["nodes"]) == 1


def test_delete_story(client):
    story_id = client.post("/api/stories/", json={"title": "ToDelete"}).json()["id"]
    res = client.delete(f"/api/stories/{story_id}")
    assert res.status_code == 204
    assert client.get(f"/api/stories/{story_id}").status_code == 404


def test_story_scenes_include_character_ids_and_positions(client):
    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Sc1"}
    ).json()["id"]
    # Create a character
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {}},
    ).json()["id"]
    # Assign character to scene with a position
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={
            "character_ids": [char_id],
            "character_positions": {str(char_id): {"x": 0.5, "y": 0.0, "scale": 1.0, "flip_x": False}},
        },
    )
    res = client.get(f"/api/stories/{story_id}")
    assert res.status_code == 200
    scene = res.json()["scenes"][0]
    assert "character_ids" in scene
    assert char_id in scene["character_ids"]
    assert "character_positions" in scene
    assert str(char_id) in scene["character_positions"]
    assert scene["character_positions"][str(char_id)]["x"] == 0.5


def test_list_stories_includes_first_scene_chars_and_characters(client):
    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Sc1"}
    ).json()["id"]
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {}},
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={
            "character_ids": [char_id],
            "character_positions": {str(char_id): {"x": -0.3, "y": 0.0, "scale": 1.0, "flip_x": False}},
        },
    )
    res = client.get("/api/stories/")
    assert res.status_code == 200
    s = res.json()[0]
    assert "first_scene_character_ids" in s
    assert char_id in s["first_scene_character_ids"]
    assert "first_scene_character_positions" in s
    assert str(char_id) in s["first_scene_character_positions"]
    assert "characters" in s
    assert any(c["id"] == char_id for c in s["characters"])
