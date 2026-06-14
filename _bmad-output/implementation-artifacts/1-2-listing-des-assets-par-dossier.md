---
baseline_commit: 75848d6faca098495b4e664c1cdaff9d92241824
---

# Story 1.2 : Listing des assets par dossier

Status: review

## Story

En tant qu'auteur,
je veux filtrer les assets par dossier et lister tous les dossiers existants,
afin de naviguer dans ma bibliothèque de médias.

## Acceptance Criteria

1. **Given** des assets avec des dossiers variés en base
   **When** `GET /api/assets?folder=backgrounds` est appelé
   **Then** seuls les assets dont `folder = 'backgrounds'` sont retournés (exact match, sans récursion)

2. **Given** des assets dans `characters/alice`, `characters/bob`, `backgrounds`
   **When** `GET /api/assets/folders` est appelé
   **Then** la réponse est une liste plate triée `["backgrounds", "characters/alice", "characters/bob"]`
   **And** pas d'objet wrapper — tableau JSON direct

3. **Given** aucun asset en base
   **When** `GET /api/assets/folders` est appelé
   **Then** la réponse est `[]`

## Tasks / Subtasks

- [x] **T1** — Ajouter les imports DB dans `backend/routers/assets.py` (AC: 1, 2)
  - [x] Imports : `Depends`, `List`, `Query` depuis `fastapi` ; `Session` depuis `sqlalchemy.orm` ; `models`, `schemas`, `get_db`

- [x] **T2** — Implémenter `GET /api/assets/folders` dans `backend/routers/assets.py` (AC: 2, 3)
  - [x] Route `@router.get("/folders", response_model=List[str])` — déclarée EN PREMIER dans le fichier
  - [x] Query : `db.query(models.Asset.folder).distinct().order_by(models.Asset.folder).all()`
  - [x] Retourner `[row[0] for row in rows]` — liste plate de strings

- [x] **T3** — Implémenter `GET /api/assets` dans `backend/routers/assets.py` (AC: 1)
  - [x] Route `@router.get("/", response_model=List[schemas.Asset])`
  - [x] Paramètre `folder: str = Query(...)` — obligatoire
  - [x] Query : `db.query(models.Asset).filter(models.Asset.folder == folder).all()`

- [x] **T4** — Ajouter les tests dans `backend/tests/test_assets.py` (AC: 1, 2, 3)
  - [x] Test `GET /api/assets?folder=X` retourne exact match uniquement
  - [x] Test `GET /api/assets/folders` retourne liste plate triée
  - [x] Test `GET /api/assets/folders` retourne `[]` si aucun asset

## Dev Notes

### Contexte critique — état actuel de `routers/assets.py`

Le fichier actuel contient UNIQUEMENT :
```python
router = APIRouter(prefix="/assets", tags=["assets"])
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_MIME_TYPES = {...}
MAX_SIZE = 10 * 1024 * 1024

@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    # ... sauvegarde sur disque, retourne {"url": "..."}
    # PAS de persistance DB
```

Les endpoints GET de cette story sont les PREMIERS à toucher la DB dans ce router. Il faut ajouter tous les imports nécessaires.

### Imports à ajouter en tête de `routers/assets.py`

```python
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
```

**Pattern d'import exact de `characters.py` :** `import models`, `import schemas`, `from database import get_db`, `from sqlalchemy.orm import Session`. Pas d'import relatif — imports absolus (voir `pytest.ini` : `pythonpath = .`).

### Ordre de déclaration des routes — CRITIQUE

```python
# ORDRE OBLIGATOIRE dans le fichier :
@router.get("/folders", ...)      # 1. Routes statiques d'abord
def list_folders(...): ...

@router.get("/", ...)             # 2. Route avec query param
def list_assets(...): ...

@router.post("/upload", ...)      # 3. Route existante — déplacer si nécessaire
async def upload_asset(...): ...
```

Pourquoi ? FastAPI résout les routes dans l'ordre de déclaration. Si un futur `GET /{id}` est ajouté (Story 1.x), il devra être après `/folders` pour que FastAPI ne traite pas "folders" comme un ID. Établir le bon ordre dès maintenant.

### Implémentation complète des deux endpoints

**`GET /api/assets/folders`** :
```python
@router.get("/folders", response_model=List[str])
def list_folders(db: Session = Depends(get_db)):
    rows = db.query(models.Asset.folder).distinct().order_by(models.Asset.folder).all()
    return [row[0] for row in rows]
```

Note : `.all()` retourne une liste de tuples `(folder_value,)` → `row[0]` extrait la string.

**`GET /api/assets`** :
```python
@router.get("/", response_model=List[schemas.Asset])
def list_assets(folder: str = Query(...), db: Session = Depends(get_db)):
    return db.query(models.Asset).filter(models.Asset.folder == folder).all()
```

- `Query(...)` = paramètre **obligatoire** (pas de valeur par défaut)
- Exact match uniquement — pas de `LIKE`, pas de startswith
- Retourne `[]` si aucun asset dans ce dossier (pas de 404)

### Pattern de test — création directe en DB

`POST /api/assets/upload` ne persiste PAS en DB (ce sera Story 1.3). Pour tester les GET, insérer des assets directement via la session surchargée (pattern établi en Story 1.1) :

```python
def _create_asset(client, filename, folder, content_type="image/png"):
    """Helper — insert Asset directly in test DB."""
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
```

Utiliser ce helper dans chaque test pour éviter la répétition.

### Tests à ajouter

```python
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
    # Vérifie que characters/alice n'est PAS inclus (no recursion)
    filenames = [a["filename"] for a in data]
    assert "alice.png" not in filenames


def test_list_assets_includes_schema_fields(client):
    _create_asset(client, "portrait.png", "characters/alice")

    res = client.get("/api/assets?folder=characters/alice")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    asset = data[0]
    assert "id" in asset
    assert "filename" in asset
    assert "url" in asset
    assert "content_type" in asset
    assert "folder" in asset
    assert "is_seed" in asset


def test_list_assets_empty_folder(client):
    res = client.get("/api/assets?folder=backgrounds")
    assert res.status_code == 200
    assert res.json() == []


def test_list_assets_missing_folder_param(client):
    res = client.get("/api/assets")
    assert res.status_code == 422  # FastAPI — Query(...) obligatoire


def test_list_folders_sorted(client):
    _create_asset(client, "bob.png", "characters/bob")
    _create_asset(client, "bg.png", "backgrounds")
    _create_asset(client, "alice.png", "characters/alice")

    res = client.get("/api/assets/folders")
    assert res.status_code == 200
    data = res.json()
    assert data == ["backgrounds", "characters/alice", "characters/bob"]


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
```

### Intelligence de la Story précédente (1.1)

- **Pattern import DB** : `import models`, `import schemas`, `from database import get_db`, `from sqlalchemy.orm import Session` — exactement comme `characters.py`
- **Pattern query SQLAlchemy** : `db.query(models.Asset).filter(models.Asset.folder == folder).all()` — sync, pas d'async
- **Schéma Pydantic `Asset`** existe dans `schemas.py` avec `from_attributes = True`
- **Interface TypeScript `Asset`** existe dans `frontend/types/index.ts` — non modifiée par cette story
- **`POST /api/assets/upload`** reste intact — ne pas toucher
- **Python 3.12** (`python3.12.exe` dans `C:\Users\realjck\AppData\Local\Python\bin\`) pour les tests

### Fichiers à toucher

| Fichier | Action | Quoi |
|---------|--------|------|
| `backend/routers/assets.py` | MODIFIER | Ajouter imports DB + 2 nouveaux endpoints GET |
| `backend/tests/test_assets.py` | MODIFIER | Ajouter helper `_create_asset` + 7 tests |

**Ne pas toucher :**
- `backend/models.py` — `Asset` déjà créé en 1.1
- `backend/schemas.py` — `Asset` schéma déjà créé en 1.1
- `frontend/types/index.ts` — non concerné par cette story
- `backend/main.py` — aucun changement requis

### Périmètre de la story — bornes claires

**In scope :** deux endpoints GET + tests.

**Out of scope (stories suivantes) :**
- Story 1.3 : `POST /api/assets` avec `folder` multipart + persistance DB
- Story 1.4 : rename dossier/fichier
- Story 1.5 : détection same-name / 409

### Project Structure Notes

- Router prefix `"/assets"` → `GET /api/assets/folders` et `GET /api/assets/` (avec `/api` ajouté par `main.py`)
- Pas de couche service — logique directement dans la fonction router (convention du projet)
- Pas de `try/except` autour des queries — SQLAlchemy lève des exceptions uniquement sur erreur DB, pas sur empty result

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — "Naming Patterns", "Format Patterns"
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.2 (AC complets)
- Story précédente: `_bmad-output/implementation-artifacts/1-1-migration-modele-asset.md`
- Pattern router existant: `backend/routers/characters.py`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Imports DB ajoutés dans `routers/assets.py` : `Depends`, `List`, `Query`, `Session`, `models`, `schemas`, `get_db`.
- `GET /api/assets/folders` déclaré EN PREMIER (avant `/` et `/upload`) pour éviter tout conflit futur avec `/{id}`.
- `GET /api/assets` avec `folder: str = Query(...)` obligatoire — retourne 422 si absent.
- Helper `_create_asset()` ajouté dans `test_assets.py` — insère directement via la session surchargée (POST /upload n'a pas encore de persistance DB).
- 7 nouveaux tests : exact match, champs schema, dossier vide, param manquant, tri, dédupliquation, liste vide.
- 96/96 tests passent (Python 3.12).

### File List

- `backend/routers/assets.py` — ajout imports DB + endpoints GET /folders et GET /
- `backend/tests/test_assets.py` — ajout helper `_create_asset` + 7 tests story 1.2
