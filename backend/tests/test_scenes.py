import pytest


@pytest.fixture()
def story_id(client):
    return client.post("/api/stories/", json={"title": "Story"}).json()["id"]


def test_create_scene(client, story_id):
    res = client.post(f"/api/stories/{story_id}/scenes/", json={"title": "Scène 1"})
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Scène 1"
    assert data["order"] == 0
    assert data["story_id"] == story_id
    assert data["background_asset"] is None
    assert data["character_ids"] == []
    assert data["nodes"] == []


def test_create_scene_order_increments(client, story_id):
    s1 = client.post(f"/api/stories/{story_id}/scenes/", json={"title": "A"}).json()
    s2 = client.post(f"/api/stories/{story_id}/scenes/", json={"title": "B"}).json()
    assert s1["order"] == 0
    assert s2["order"] == 1


def test_list_scenes(client, story_id):
    client.post(f"/api/stories/{story_id}/scenes/", json={"title": "A"})
    client.post(f"/api/stories/{story_id}/scenes/", json={"title": "B"})
    res = client.get(f"/api/stories/{story_id}/scenes/")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_get_scene(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène 1"}
    ).json()["id"]
    res = client.get(f"/api/stories/{story_id}/scenes/{scene_id}")
    assert res.status_code == 200
    assert res.json()["title"] == "Scène 1"


def test_get_scene_not_found(client, story_id):
    res = client.get(f"/api/stories/{story_id}/scenes/9999")
    assert res.status_code == 404


def test_update_scene_title(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Old"}
    ).json()["id"]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}", json={"title": "New"}
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New"


def test_update_scene_background(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène"}
    ).json()["id"]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"background_asset": {"type": "local", "url": "/bg.png"}},
    )
    assert res.status_code == 200
    assert res.json()["background_asset"]["url"] == "/bg.png"


def test_update_scene_character_ids_valid(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène"}
    ).json()["id"]
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {}},
    ).json()["id"]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"character_ids": [char_id]},
    )
    assert res.status_code == 200
    assert res.json()["character_ids"] == [char_id]


def test_update_scene_character_ids_invalid(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène"}
    ).json()["id"]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"character_ids": [9999]},
    )
    assert res.status_code == 400


def test_update_scene_character_ids_max_4(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène"}
    ).json()["id"]
    char_ids = [
        client.post(
            f"/api/stories/{story_id}/characters/",
            json={"name": f"Char{i}", "sprites": {}},
        ).json()["id"]
        for i in range(5)
    ]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={"character_ids": char_ids},
    )
    assert res.status_code == 400


def test_delete_scene(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "ToDelete"}
    ).json()["id"]
    res = client.delete(f"/api/stories/{story_id}/scenes/{scene_id}")
    assert res.status_code == 204
    assert (
        client.get(f"/api/stories/{story_id}/scenes/{scene_id}").status_code == 404
    )


def test_delete_scene_cascades_nodes(client, story_id):
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène"}
    ).json()["id"]
    client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={"type": "dialogue", "data": {}, "order": 0},
    )
    client.delete(f"/api/stories/{story_id}/scenes/{scene_id}")
    # Story should have no scenes
    story = client.get(f"/api/stories/{story_id}").json()
    assert story["scenes"] == []


def test_reorder_scenes(client, story_id):
    s1 = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "A"}
    ).json()["id"]
    s2 = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "B"}
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/scenes/reorder", json={"order": [s2, s1]}
    )
    assert res.status_code == 200
    reordered = res.json()
    assert reordered[0]["id"] == s2
    assert reordered[1]["id"] == s1


def test_reorder_scenes_invalid_ids(client, story_id):
    client.post(f"/api/stories/{story_id}/scenes/", json={"title": "A"})
    res = client.post(
        f"/api/stories/{story_id}/scenes/reorder", json={"order": [9999]}
    )
    assert res.status_code == 400
