def test_create_story(client):
    res = client.post("/api/stories/", json={"title": "Ma Story"})
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Ma Story"
    assert "slug" in data
    assert data["published"] is False


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


def test_get_story(client):
    story_id = client.post("/api/stories/", json={"title": "X"}).json()["id"]
    res = client.get(f"/api/stories/{story_id}")
    assert res.status_code == 200
    assert res.json()["title"] == "X"


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
    res = client.get(f"/api/stories/by-slug/{story['slug']}")
    assert res.status_code == 200
    assert res.json()["title"] == "Public"


def test_delete_story(client):
    story_id = client.post("/api/stories/", json={"title": "ToDelete"}).json()["id"]
    res = client.delete(f"/api/stories/{story_id}")
    assert res.status_code == 204
    assert client.get(f"/api/stories/{story_id}").status_code == 404
