import pytest


@pytest.fixture()
def story_scene(client):
    """Creates a story and a scene, returns (story_id, scene_id)."""
    story_id = client.post("/api/stories/", json={"title": "Story"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Scène 1"}
    ).json()["id"]
    return story_id, scene_id


def _dialogue_data():
    return {"type": "dialogue", "data": {"character_id": None, "text": "Hello"}, "order": 0}


def test_create_node(client, story_scene):
    story_id, scene_id = story_scene
    res = client.post(f"/api/stories/{story_id}/scenes/{scene_id}/nodes/", json=_dialogue_data())
    assert res.status_code == 201
    data = res.json()
    assert data["type"] == "dialogue"
    assert data["data"]["text"] == "Hello"
    assert data["scene_id"] == scene_id


def test_create_node_invalid_type(client, story_scene):
    story_id, scene_id = story_scene
    payload = {"type": "unknown", "data": {}, "order": 0}
    res = client.post(f"/api/stories/{story_id}/scenes/{scene_id}/nodes/", json=payload)
    assert res.status_code == 422


def test_update_node(client, story_scene):
    story_id, scene_id = story_scene
    node_id = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/", json=_dialogue_data()
    ).json()["id"]
    res = client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/{node_id}",
        json={"data": {"text": "Updated"}},
    )
    assert res.status_code == 200
    assert res.json()["data"]["text"] == "Updated"


def test_delete_node(client, story_scene):
    story_id, scene_id = story_scene
    node_id = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/", json=_dialogue_data()
    ).json()["id"]
    res = client.delete(f"/api/stories/{story_id}/scenes/{scene_id}/nodes/{node_id}")
    assert res.status_code == 204


def test_delete_node_preserves_others(client, story_scene):
    story_id, scene_id = story_scene
    n1 = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={**_dialogue_data(), "order": 0},
    ).json()["id"]
    n2 = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={**_dialogue_data(), "order": 1},
    ).json()["id"]
    client.delete(f"/api/stories/{story_id}/scenes/{scene_id}/nodes/{n1}")
    scene = client.get(f"/api/stories/{story_id}/scenes/{scene_id}").json()
    assert len(scene["nodes"]) == 1
    assert scene["nodes"][0]["id"] == n2


def test_reorder_nodes(client, story_scene):
    story_id, scene_id = story_scene
    n1 = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={**_dialogue_data(), "order": 0},
    ).json()["id"]
    n2 = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/",
        json={**_dialogue_data(), "order": 1},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/reorder",
        json={"order": [n2, n1]},
    )
    assert res.status_code == 200
    reordered = res.json()
    assert reordered[0]["id"] == n2
    assert reordered[1]["id"] == n1


def test_reorder_nodes_invalid_ids(client, story_scene):
    story_id, scene_id = story_scene
    client.post(f"/api/stories/{story_id}/scenes/{scene_id}/nodes/", json=_dialogue_data())
    res = client.post(
        f"/api/stories/{story_id}/scenes/{scene_id}/nodes/reorder",
        json={"order": [9999]},
    )
    assert res.status_code == 400
