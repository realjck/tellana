import pytest


@pytest.fixture()
def story_id(client):
    return client.post("/api/stories/", json={"title": "Story"}).json()["id"]


def _char(name="Alice", position="left"):
    return {"name": name, "image_url": "/sprite_woman.png", "position": position}


def test_create_character(client, story_id):
    res = client.post(f"/api/stories/{story_id}/characters/", json=_char())
    assert res.status_code == 201
    assert res.json()["name"] == "Alice"
    assert res.json()["position"] == "left"


def test_create_character_right_position(client, story_id):
    res = client.post(f"/api/stories/{story_id}/characters/", json=_char(position="right"))
    assert res.status_code == 201
    assert res.json()["position"] == "right"


def test_create_character_invalid_position(client, story_id):
    res = client.post(f"/api/stories/{story_id}/characters/", json=_char(position="center"))
    assert res.status_code == 422


def test_list_characters(client, story_id):
    client.post(f"/api/stories/{story_id}/characters/", json=_char("A"))
    client.post(f"/api/stories/{story_id}/characters/", json=_char("B"))
    res = client.get(f"/api/stories/{story_id}/characters/")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_update_character(client, story_id):
    char_id = client.post(f"/api/stories/{story_id}/characters/", json=_char()).json()["id"]
    res = client.patch(f"/api/stories/{story_id}/characters/{char_id}", json={"name": "Bob"})
    assert res.status_code == 200
    assert res.json()["name"] == "Bob"


def test_update_character_invalid_position(client, story_id):
    char_id = client.post(f"/api/stories/{story_id}/characters/", json=_char()).json()["id"]
    res = client.patch(f"/api/stories/{story_id}/characters/{char_id}", json={"position": "center"})
    assert res.status_code == 422


def test_delete_character(client, story_id):
    char_id = client.post(f"/api/stories/{story_id}/characters/", json=_char()).json()["id"]
    res = client.delete(f"/api/stories/{story_id}/characters/{char_id}")
    assert res.status_code == 204
    chars = client.get(f"/api/stories/{story_id}/characters/").json()
    assert len(chars) == 0
