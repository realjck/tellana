---
baseline_commit: 3ace81f
---

# Story 1.5 : Détection et remplacement d'asset par même nom

Status: done

## Story

En tant qu'auteur,
je veux être averti si mon upload écrase un fichier existant,
afin de décider consciemment s'il faut le remplacer ou annuler.

## Acceptance Criteria

1. **Given** un asset `portrait.png` dans `characters/alice` déjà en base
   **When** `POST /api/assets` avec `folder=characters/alice` et un fichier nommé `portrait.png` est appelé (sans `?replace=true`)
   **Then** la réponse est `409 Conflict` avec body **top-level** `{ "existing_id": int, "references": { "scenes": int, "nodes": int } }` (PAS imbriqué sous `detail`)
   **And** aucun fichier n'est écrasé sur disque et aucune ligne DB n'est créée

2. **Given** le conflit détecté
   **When** le body `references` est calculé
   **Then** `references.scenes` = nombre de scènes dont `background_asset.url` OU `bg_custom_uploads` référence l'`url` de l'asset existant
   **And** `references.nodes` = nombre de nœuds dont `data` (JSON) référence cette `url`
   **And** s'il n'y a aucune référence, `references` vaut `{ "scenes": 0, "nodes": 0 }`

3. **Given** un `409 Conflict` reçu par le client
   **When** `POST /api/assets?replace=true` est appelé avec le même `folder` et `filename`
   **Then** le fichier physique est écrasé sur disque (`uploads/{folder}/{filename}`)
   **And** l'asset existant est mis à jour en base (l'`id` reste identique, `content_type` rafraîchi, `url` inchangée car même `folder/filename`)
   **And** aucune nouvelle ligne `Asset` n'est créée (pas de doublon)
   **And** la réponse est `200` avec l'objet `schemas.Asset` de l'asset existant

4. **Given** un `POST /api/assets` (avec ou sans `?replace=true`) pour un `(folder, filename)` qui n'existe pas encore
   **When** l'upload est traité
   **Then** le comportement nominal est conservé : fichier écrit, nouvelle ligne `Asset` créée, réponse `200` (pas de régression Story 1.3)

## Tasks / Subtasks

- [x] **T1** — Helper de comptage des références dans `backend/routers/assets.py` (AC: 2)
  - [x] Ajouter `import json` en tête de fichier
  - [x] `def _count_references(db: Session, url: str) -> dict` retournant `{"scenes": int, "nodes": int}`
  - [x] Scènes : pour chaque `models.Scene`, compter si `background_asset` est un dict avec `url == url` OU si `url in (bg_custom_uploads or [])`
  - [x] Nœuds : pour chaque `models.Node`, compter si `url in json.dumps(node.data or {})`

- [x] **T2** — Détection de collision dans `create_asset` (`POST /api/assets`) (AC: 1, 2, 3, 4)
  - [x] Ajouter le paramètre `replace: bool = Query(default=False)`
  - [x] Après validation + calcul de `filename`, requêter l'asset existant : `folder == folder AND filename == filename`
  - [x] Si existant ET `not replace` → retourner `JSONResponse(status_code=409, content={"existing_id": existing.id, "references": _count_references(db, existing.url)})` AVANT toute écriture disque/DB
  - [x] Si existant ET `replace` → écrire le fichier (écrase), mettre à jour `existing.content_type` + `existing.url`, `db.commit()`, `db.refresh(existing)`, retourner `existing` (même id)
  - [x] Si aucun existant → comportement nominal actuel inchangé (write + INSERT + return)
  - [x] Importer `JSONResponse` : `from fastapi.responses import JSONResponse`

- [x] **T3** — Tests dans `backend/tests/test_assets.py` (AC: 1, 2, 3, 4)
  - [x] Test 409 avec références : upload portrait.png, créer story+scene avec ce fond + un nœud référençant l'url, re-upload même nom → 409 body `{existing_id, references:{scenes:1, nodes:1}}`
  - [x] Test 409 sans référence → `references == {"scenes": 0, "nodes": 0}`
  - [x] Test 409 body top-level (pas sous `detail`) : assert `res.json()["existing_id"]` accessible directement
  - [x] Test replace=true : re-upload avec contenu différent → 200, même `id`, fichier écrasé sur disque, une seule ligne en DB
  - [x] Test nouveau nom → 200 nominal (pas de régression)
  - [x] Suite complète verte (107 + nouveaux)

### Review Findings (Epic 1 — code review 2026-06-14)

Revue adversariale 3 couches (Blind Hunter / Edge Case Hunter / Acceptance Auditor) sur le diff complet de l'Epic 1 (`feat/tel-29` vs `main`).

- [x] [Review][Patch] `rename_file` écrase silencieusement un asset voisin en cas de collision de nom cible [backend/routers/assets.py rename_file] — CORRIGÉ : guard `409` si un autre asset porte déjà le `filename` cible dans le dossier.
- [x] [Review][Patch] Pas de garde anti path-traversal sur `folder` / `from` / `to` [backend/routers/assets.py create_asset, rename_folder] — CORRIGÉ : helper `_normalize_folder` rejette les segments `..` (400), appliqué à `create_asset`, `rename_folder` (src + dst).
- [x] [Review][Defer] `os.rename` / `Path.rename` lèvent un 500 non géré si la source disque est absente (assets legacy à URL plate) [backend/routers/assets.py rename_folder, rename_file] — deferred, hors-scope documenté story 1.4.
- [x] [Review][Defer] `rename_folder` : le filtre `LIKE "{src}/%"` ne neutralise pas les métacaractères `_`/`%` d'un nom de dossier [backend/routers/assets.py rename_folder] — deferred, faible probabilité, scope prototype.
- [x] [Review][Defer] `_count_references` : match par sous-chaîne sur `json.dumps(node.data)` → faux positif possible sur urls préfixes [backend/routers/assets.py _count_references] — deferred, conforme aux dev notes prescrites, impact faible.
- [x] [Review][Defer] Pas de contrainte d'unicité `(folder, filename)` ni protection de course sur upload concurrent [backend/models.py Asset] — deferred, SQLite mono-writer + prototype.

## Dev Notes

### Le cœur de la story : comptage des références

Le modèle de données (vérifié dans `backend/models.py` et `backend/schemas.py`) :

- **`Scene.background_asset`** (`JSON`, nullable) : stocke un `AssetRef` sérialisé → dict `{ "type": str, "url": str|null, ... }`. La clé de matching est `url`.
- **`Scene.bg_custom_uploads`** (`JSON`, default `[]`) : liste de strings (urls).
- **`Node.data`** (`JSON`, default `{}`) : dict arbitraire par type de nœud. Les nœuds `dialogue` actuels référencent les sprites indirectement (`character_id` + `sprite_keys` = noms de poses), donc ne contiennent PAS d'url brute aujourd'hui. Les futurs nœuds `image`/`video` embarqueront une url. Le comptage par recherche de l'url dans `json.dumps(data)` couvre les deux cas de façon générique.
- **`Character.sprites`** (`JSON` dict `{pose: AssetRef}`) : référence aussi des urls, MAIS **hors périmètre** — l'AC ne demande de compter QUE `scenes` et `nodes` (cf. message d'impact Story 2.3 : "utilisé dans {scenes} scène(s) et {nodes} nœud(s)"). Voir "Limitation connue" plus bas.

```python
import json  # ajouter en tête

def _count_references(db: Session, url: str) -> dict:
    scene_count = 0
    for scene in db.query(models.Scene).all():
        bg = scene.background_asset
        if isinstance(bg, dict) and bg.get("url") == url:
            scene_count += 1
        elif url in (scene.bg_custom_uploads or []):
            scene_count += 1
    node_count = sum(
        1 for node in db.query(models.Node).all() if url in json.dumps(node.data or {})
    )
    return {"scenes": scene_count, "nodes": node_count}
```

Le comptage est **global** (toutes stories confondues) : un asset est partagé et non rattaché à une story ; l'impact réel d'un remplacement de fichier touche toutes ses références. (L'epic dit "JSONs de la story" mais l'asset étant global, le comptage global est l'impact correct.)

### CRITIQUE — le body 409 doit être top-level, pas sous `detail`

`HTTPException(status_code=409, detail={...})` produirait `{"detail": {...}}` — non conforme. Le consommateur (Story 2.3, `UploadDropZone`) attend `{ existing_id, references }` au top-level. Utiliser **`JSONResponse`** :

```python
from fastapi.responses import JSONResponse  # ajouter à l'import

return JSONResponse(
    status_code=409,
    content={"existing_id": existing.id, "references": _count_references(db, existing.url)},
)
```

FastAPI honore un `Response` explicite et court-circuite le `response_model=schemas.Asset` de la route — pas de conflit. Le chemin `200` continue de retourner l'ORM `Asset` validé par le `response_model`.

### État actuel de `create_asset` (baseline 3ace81f)

```python
@router.post("/", response_model=schemas.Asset)
async def create_asset(
    file: UploadFile = File(...),
    folder: str = Form(default="backgrounds"),
    db: Session = Depends(get_db),
):
    folder = folder.replace("\\", "/")
    content = await file.read()
    mime = _validate_image(content)
    (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename or "upload").name
    (UPLOAD_DIR / folder / filename).write_bytes(content)
    db_asset = models.Asset(
        filename=filename,
        url=f"/uploads/{folder}/{filename}",
        content_type=mime,
        folder=folder,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset
```

**Comportement actuel à corriger** : aujourd'hui un re-upload de même nom écrase le fichier ET crée une ligne DB en doublon, silencieusement. Story 1.5 introduit la détection 409 + le chemin `replace=true` qui réutilise la ligne existante.

### Implémentation cible de `create_asset` (T2)

```python
@router.post("/", response_model=schemas.Asset)
async def create_asset(
    file: UploadFile = File(...),
    folder: str = Form(default="backgrounds"),
    replace: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    folder = folder.replace("\\", "/")
    content = await file.read()
    mime = _validate_image(content)
    filename = Path(file.filename or "upload").name
    existing = (
        db.query(models.Asset)
        .filter(models.Asset.folder == folder, models.Asset.filename == filename)
        .first()
    )
    if existing and not replace:
        return JSONResponse(
            status_code=409,
            content={"existing_id": existing.id, "references": _count_references(db, existing.url)},
        )
    (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / folder / filename).write_bytes(content)
    if existing:
        existing.content_type = mime
        existing.url = f"/uploads/{folder}/{filename}"  # no-op (même chemin), gardé pour clarté
        db.commit()
        db.refresh(existing)
        return existing
    db_asset = models.Asset(
        filename=filename,
        url=f"/uploads/{folder}/{filename}",
        content_type=mime,
        folder=folder,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset
```

### Pattern de test (T3)

Setup story/scene/node via les endpoints HTTP (cf. `test_scenes.py`, `test_nodes.py`). Pour référencer l'url dans une scène, PATCH `background_asset` avec un `AssetRef` (`type` requis) ; pour un nœud, mettre l'url dans `data`.

```python
def test_upload_same_name_conflict_with_references(client):
    up = _upload(client, "portrait.png", "characters/alice").json()
    url = up["url"]  # /uploads/characters/alice/portrait.png

    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(f"/api/stories/{story_id}/scenes/", json={"title": "Sc"}).json()["id"]
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
    assert body["existing_id"] == up["id"]          # top-level, pas sous "detail"
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
    other_png = MINIMAL_JPEG  # contenu différent (toujours une image valide)

    res = client.post(
        "/api/assets?replace=true",
        files={"file": ("portrait.png", io.BytesIO(other_png), "image/jpeg")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 200
    assert res.json()["id"] == first["id"]          # même id
    # Une seule ligne en DB
    assert len(client.get("/api/assets?folder=characters/alice").json()) == 1
    # Fichier écrasé
    assert (tmp_path / "characters" / "alice" / "portrait.png").read_bytes() == other_png


def test_upload_new_name_no_conflict(client):
    _upload(client, "a.png", "characters/alice")
    res = _upload(client, "b.png", "characters/alice")
    assert res.status_code == 200
```

`_upload(client, filename, folder)` est déjà défini dans le fichier (ajouté en Story 1.4). `MINIMAL_PNG` et `MINIMAL_JPEG` existent déjà en tête de fichier.

### Intelligence des stories précédentes (1.1 → 1.4)

- **`create_asset` / `_validate_image`** déjà en place (Story 1.3) — `_validate_image` accepte PNG/JPEG/WebP/GIF, donc `MINIMAL_JPEG` est valide pour tester un remplacement par contenu différent.
- **Endpoints existants** : `GET /folders`, `GET /`, `POST /`, `POST /upload`, `PATCH /folders`, `PATCH /{asset_id}/rename` (Story 1.4). Pas de réordonnancement de routes nécessaire — on modifie `POST /` en place.
- **Helper `_upload`** ajouté en Story 1.4 dans `test_assets.py` — réutilisé ici.
- **Fixture `client`** : DB in-memory fraîche par test + `UPLOAD_DIR` → `tmp_path`. Les stories/scenes/nodes créés via HTTP partagent la même DB (StaticPool).
- **`Query`** déjà importé dans `assets.py` (utilisé par `list_assets`).
- **Pattern PATCH scene** : `background_asset` accepte un `AssetRef` (`type` obligatoire, ex. `"upload"`).

### Fichiers à toucher

| Fichier | Action | Quoi |
|---------|--------|------|
| `backend/routers/assets.py` | MODIFIER | `import json` + `from fastapi.responses import JSONResponse` + helper `_count_references` + détection collision/replace dans `create_asset` |
| `backend/tests/test_assets.py` | MODIFIER | Ajouter ~4 tests Story 1.5 |

**Ne pas toucher :** `models.py`, `schemas.py` (Asset/AssetRef complets), `main.py`, `POST /upload` (legacy inchangé), `PATCH /folders` & `/{id}/rename` (Story 1.4 inchangées), `frontend/` (la modale `UploadDropZone` consommera le 409 en Epic 2 / Story 2.3).

### Périmètre — bornes claires

**In scope :** détection collision `(folder, filename)`, `409 { existing_id, references }` top-level, comptage scenes+nodes, chemin `?replace=true` réutilisant la ligne existante (id stable, pas de doublon), non-régression upload nominal.

**Out of scope :**
- Frontend (`ConfirmModal` d'impact + envoi `?replace=true`) = Story 2.3 (`UploadDropZone`).
- Comptage des références dans `Character.sprites` (voir limitation).
- `DELETE /api/assets/{id}` (Epic 2).

### Limitation connue (documentée, conforme à l'AC)

Le comptage ne couvre PAS `Character.sprites`. L'AC ne demande que `scenes` + `nodes`. Remplacer un fichier utilisé uniquement comme sprite de personnage affichera `{scenes: 0, nodes: 0}` alors que des personnages l'utilisent. C'est conforme à l'AC et au message d'impact prévu (Story 2.3) ; à réévaluer si un besoin produit émerge. NFR-2 reste respecté : le remplacement de fichier ne casse aucune `AssetRef` (url identique), donc même non comptés, les sprites pointent automatiquement vers le nouveau fichier.

### Project Structure Notes

- `JSONResponse` : import standard FastAPI (`fastapi.responses`) — pas de dépendance nouvelle. `json` est stdlib.
- Le `response_model=schemas.Asset` reste sur la route ; FastAPI n'applique pas le model quand on retourne un `Response` explicite (le 409).
- Le comptage `db.query(Scene).all()` / `db.query(Node).all()` charge toutes les lignes : acceptable pour ce prototype SQLite mono-utilisateur.

### References

- Architecture : `_bmad-output/planning-artifacts/architecture.md` — "Process Patterns → Substitution same-name" (SELECT (folder,filename) → 409 → `?replace=true` → écrase fichier + maj url), D6 (substitution même nom avec impact N scènes/M nœuds), NFR-3 (impact réel avant confirmation), NFR-2 (rétrocompatibilité `AssetRef`).
- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 1.5 (AC), FR-2.8, FR additionnel "Substitution same-name : 409 Conflict { existing_id, references } → POST ?replace=true".
- Project context : `_bmad-output/project-context.md` — SQLAlchemy sync, logique dans `routers/`, HTTPException(409) métier, resolveAsset/AssetRef inchangés.
- Code existant : `backend/routers/assets.py` (état complet ci-dessus), `backend/models.py` (`Scene.background_asset`/`bg_custom_uploads`, `Node.data`, `Character.sprites`), `backend/schemas.py` (`AssetRef` = `{type, url, ...}`, `SceneUpdate.background_asset`), `backend/tests/test_assets.py` (`_upload`, `MINIMAL_PNG`, `MINIMAL_JPEG`), `backend/tests/test_scenes.py` & `test_nodes.py` (fixtures story/scene/node via HTTP).
- Stories précédentes : `1-3-upload-dun-asset-dans-un-dossier.md`, `1-4-renommage-de-dossier-et-de-fichier.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- TDD : 4 tests écrits d'abord (RED confirmé : 3 échecs sur collision/replace + 1 vert "nouveau nom"), puis implémentation (GREEN).
- T1 : `import json` ajouté ; helper `_count_references(db, url)` — compte les scènes (`background_asset.url` ou url dans `bg_custom_uploads`) et les nœuds (url dans `json.dumps(data)`). Comptage global toutes stories confondues.
- T2 : `create_asset` modifié — paramètre `replace: bool = Query(default=False)`, détection collision `(folder, filename)` AVANT toute écriture, `409` via `JSONResponse` (body top-level `{existing_id, references}`, pas sous `detail`), chemin `replace=true` réutilise la ligne existante (id stable, maj `content_type`/`url`, pas de doublon). `from fastapi.responses import JSONResponse` ajouté.
- Décision documentée respectée : `JSONResponse` plutôt que `HTTPException(detail=...)` pour le body top-level attendu par Story 2.3.
- Limitation conforme à l'AC : `Character.sprites` non compté (scenes + nodes uniquement) — NFR-2 préservé (url identique au remplacement, aucune `AssetRef` cassée).
- Régression silencieuse corrigée : un re-upload de même nom créait auparavant un doublon DB + écrasait le fichier sans avertir.
- Suite complète : 111/111 tests passent (107 préexistants + 4 nouveaux), aucune régression. Warnings `datetime.utcnow` préexistants, non liés.

### File List

- `backend/routers/assets.py` — `import json` + `from fastapi.responses import JSONResponse` + helper `_count_references` + détection collision/replace dans `create_asset` ; (review) helper `_normalize_folder` (anti path-traversal) + guard `409` collision dans `rename_file`
- `backend/tests/test_assets.py` — 4 tests Story 1.5 + 3 tests review (collision rename, 2× path-traversal)

## Change Log

- 2026-06-14 — Implémentation Story 1.5 : détection collision `(folder, filename)` sur `POST /api/assets` → `409 { existing_id, references: { scenes, nodes } }` ; chemin `?replace=true` réutilisant la ligne existante (id stable). Helper `_count_references`. 4 tests ajoutés, 111/111 verts. Status → review.
- 2026-06-14 — Code review Epic 1 : 2 patchs appliqués (P1 guard `409` collision dans `rename_file` ; P2 helper `_normalize_folder` anti path-traversal sur `create_asset`/`rename_folder`). 3 tests ajoutés, 114/114 verts. 4 findings reportés (`deferred-work.md`). Status → done.
