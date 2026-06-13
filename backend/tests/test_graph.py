import pytest


@pytest.fixture()
def story_id(client):
    return client.post("/api/stories/", json={"title": "Graph Story"}).json()["id"]


@pytest.fixture()
def start_node_id(client, story_id):
    return client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "start"},
    ).json()["id"]


@pytest.fixture()
def branch_node_id(client, story_id):
    return client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "branch", "data": {"title": "Choose", "replay": False, "show_visited": False}},
    ).json()["id"]


# ── GET /graph ──────────────────────────────────────────────────────────────

def test_get_graph_empty(client, story_id):
    res = client.get(f"/api/stories/{story_id}/graph")
    assert res.status_code == 200
    body = res.json()
    assert body["nodes"] == []
    assert body["edges"] == []


def test_get_graph_404_unknown_story(client):
    res = client.get("/api/stories/999/graph")
    assert res.status_code == 404


# ── POST /graph/nodes ───────────────────────────────────────────────────────

def test_create_start_node(client, story_id):
    res = client.post(f"/api/stories/{story_id}/graph/nodes", json={"type": "start"})
    assert res.status_code == 201
    body = res.json()
    assert body["type"] == "start"
    assert body["story_id"] == story_id
    assert body["position_x"] == 0.0
    assert body["position_y"] == 0.0
    assert body["data"] == {}


def test_create_scene_node(client, story_id):
    res = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "scene", "position_x": 100.5, "position_y": 200.0, "data": {"scene_id": 1}},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["type"] == "scene"
    assert body["position_x"] == 100.5
    assert body["data"] == {"scene_id": 1}


def test_create_end_node(client, story_id):
    res = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin heureuse", "text": "Bravo"}},
    )
    assert res.status_code == 201
    assert res.json()["type"] == "end"


def test_create_node_404_unknown_story(client):
    res = client.post("/api/stories/999/graph/nodes", json={"type": "start"})
    assert res.status_code == 404


# ── Contrainte start unique ─────────────────────────────────────────────────

def test_start_node_unique_per_story(client, story_id, start_node_id):
    res = client.post(f"/api/stories/{story_id}/graph/nodes", json={"type": "start"})
    assert res.status_code == 400
    assert "start" in res.json()["detail"].lower()


def test_start_node_unique_per_story_independent(client):
    """Two different stories can each have a start node."""
    s1 = client.post("/api/stories/", json={"title": "S1"}).json()["id"]
    s2 = client.post("/api/stories/", json={"title": "S2"}).json()["id"]
    assert client.post(f"/api/stories/{s1}/graph/nodes", json={"type": "start"}).status_code == 201
    assert client.post(f"/api/stories/{s2}/graph/nodes", json={"type": "start"}).status_code == 201


# ── PATCH /graph/nodes/{id} ─────────────────────────────────────────────────

def test_update_node_position(client, story_id, start_node_id):
    res = client.patch(
        f"/api/stories/{story_id}/graph/nodes/{start_node_id}",
        json={"position_x": 50.0, "position_y": 75.0},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["position_x"] == 50.0
    assert body["position_y"] == 75.0


def test_update_node_data(client, story_id, branch_node_id):
    res = client.patch(
        f"/api/stories/{story_id}/graph/nodes/{branch_node_id}",
        json={"data": {"title": "Updated", "replay": True, "show_visited": True}},
    )
    assert res.status_code == 200
    assert res.json()["data"]["title"] == "Updated"


def test_update_node_404(client, story_id):
    res = client.patch(f"/api/stories/{story_id}/graph/nodes/999", json={"position_x": 1.0})
    assert res.status_code == 404


# ── DELETE /graph/nodes/{id} ────────────────────────────────────────────────

def test_delete_node(client, story_id, start_node_id):
    res = client.delete(f"/api/stories/{story_id}/graph/nodes/{start_node_id}")
    assert res.status_code == 204
    graph = client.get(f"/api/stories/{story_id}/graph").json()
    assert all(n["id"] != start_node_id for n in graph["nodes"])


def test_delete_node_cascades_edges(client, story_id, branch_node_id):
    """Deleting a node must remove all its connected edges."""
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "neutral", "title": "Fin", "text": ""}},
    ).json()["id"]
    edge_id = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": branch_node_id, "target_node_id": end_id},
    ).json()["id"]

    client.delete(f"/api/stories/{story_id}/graph/nodes/{branch_node_id}")

    graph = client.get(f"/api/stories/{story_id}/graph").json()
    assert all(e["id"] != edge_id for e in graph["edges"])


def test_delete_node_404(client, story_id):
    res = client.delete(f"/api/stories/{story_id}/graph/nodes/999")
    assert res.status_code == 404


# ── POST /graph/edges ───────────────────────────────────────────────────────

def test_create_edge(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id, "label": "Go", "order": 0},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["source_node_id"] == start_node_id
    assert body["target_node_id"] == end_id
    assert body["label"] == "Go"
    assert body["story_id"] == story_id


def test_create_edge_invalid_source(client, story_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": 9999, "target_node_id": end_id},
    )
    assert res.status_code == 400


def test_create_edge_invalid_target(client, story_id, start_node_id):
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": 9999},
    )
    assert res.status_code == 400


# ── Contrainte branch max 5 sorties ─────────────────────────────────────────

def test_branch_max_5_outgoing_edges(client, story_id, branch_node_id):
    """Branch node cannot have more than 5 outgoing edges."""
    for i in range(5):
        end_id = client.post(
            f"/api/stories/{story_id}/graph/nodes",
            json={"type": "end", "data": {"type": "neutral", "title": f"Fin {i}", "text": ""}},
        ).json()["id"]
        res = client.post(
            f"/api/stories/{story_id}/graph/edges",
            json={"source_node_id": branch_node_id, "target_node_id": end_id},
        )
        assert res.status_code == 201

    extra_end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "neutral", "title": "Fin extra", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": branch_node_id, "target_node_id": extra_end_id},
    )
    assert res.status_code == 400
    assert "5" in res.json()["detail"]


def test_non_branch_node_no_outgoing_limit(client, story_id, start_node_id):
    """Non-branch nodes are not subject to the 5-edge limit."""
    for _ in range(6):
        end_id = client.post(
            f"/api/stories/{story_id}/graph/nodes",
            json={"type": "end", "data": {"type": "neutral", "title": "Fin", "text": ""}},
        ).json()["id"]
        res = client.post(
            f"/api/stories/{story_id}/graph/edges",
            json={"source_node_id": start_node_id, "target_node_id": end_id},
        )
        assert res.status_code == 201


# ── DELETE /graph/edges/{id} ────────────────────────────────────────────────

def test_delete_edge(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    edge_id = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id},
    ).json()["id"]

    res = client.delete(f"/api/stories/{story_id}/graph/edges/{edge_id}")
    assert res.status_code == 204

    graph = client.get(f"/api/stories/{story_id}/graph").json()
    assert all(e["id"] != edge_id for e in graph["edges"])


def test_delete_edge_404(client, story_id):
    res = client.delete(f"/api/stories/{story_id}/graph/edges/999")
    assert res.status_code == 404


# ── GET /graph retourne nodes + edges ───────────────────────────────────────

def test_get_graph_returns_all(client, story_id, start_node_id, branch_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": branch_node_id, "target_node_id": end_id, "label": "Fin heureuse"},
    )

    graph = client.get(f"/api/stories/{story_id}/graph").json()
    node_ids = {n["id"] for n in graph["nodes"]}
    assert start_node_id in node_ids
    assert branch_node_id in node_ids
    assert end_id in node_ids
    assert len(graph["edges"]) == 1
    assert graph["edges"][0]["label"] == "Fin heureuse"


# ── source_handle ───────────────────────────────────────────────────────────

def test_create_edge_with_source_handle(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id, "source_handle": "c_abc"},
    )
    assert res.status_code == 201
    assert res.json()["source_handle"] == "c_abc"

    graph = client.get(f"/api/stories/{story_id}/graph").json()
    assert graph["edges"][0]["source_handle"] == "c_abc"


def test_create_edge_source_handle_defaults_null(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id},
    )
    assert res.status_code == 201
    assert res.json()["source_handle"] is None
