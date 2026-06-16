---
baseline_commit: f1e353c
---

# Story 1.3 : Upload d'un asset dans un dossier

Status: review

## Story

En tant qu'auteur,
je veux uploader une image dans un dossier spécifique,
afin de l'organiser dès l'upload sans manipulation supplémentaire.

## Acceptance Criteria

1. **Given** un fichier à uploader avec `folder=characters/alice` en multipart
   **When** `POST /api/assets` est appelé
   **Then** le fichier est sauvegardé dans `uploads/characters/alice/{filename}` (sous-dossier créé si absent)
   **And** l'asset en base a `folder = 'characters/alice'` et `url = '/uploads/characters/alice/{filename}'`
   **And** la réponse est un objet `schemas.Asset` complet (id, filename, url, content_type, folder, is_seed)

2. **Given** un `POST /api/assets` sans champ `folder`
   **When** l'upload est traité
   **Then** le dossier par défaut `backgrounds` est utilisé
   **And** le fichier est sauvegardé dans `uploads/backgrounds/{filename}`

3. **Given** un `folder` avec des backslashes Windows (`characters\alice`)
   **When** l'upload est traité
   **Then** le champ `folder` est normalisé en POSIX slash (`characters/alice`) avant la sauvegarde et l'insertion DB

4. **Given** des assets existants avec une URL plate `/uploads/filename` (anciens assets uploadés via `POST /api/assets/upload`)
   **When** l'application sert ces URLs
   **Then** ils restent accessibles sans migration — `StaticFiles` sert `uploads/` récursivement

## Tasks / Subtasks

- [x] **T1** — Ajouter `Form` aux imports FastAPI dans `backend/routers/assets.py` (AC: 1, 2, 3)
  - [x] Modifier la ligne import : `from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile`

- [x] **T2** — Extraire la validation magic bytes en helper privé dans `backend/routers/assets.py` (AC: 1)
  - [x] Créer `def _validate_image(content: bytes) -> str` qui retourne `kind.mime` ou lève `HTTPException(400)`
  - [x] Mettre à jour `upload_asset` pour appeler ce helper (comportement identique, pas de régression)

- [x] **T3** — Implémenter `POST /api/assets` dans `backend/routers/assets.py` (AC: 1, 2, 3)
  - [x] Route `@router.post("/", response_model=schemas.Asset)` — déclarée AVANT `POST /upload`
  - [x] Paramètres : `file: UploadFile = File(...)`, `folder: str = Form(default="backgrounds")`, `db: Session = Depends(get_db)`
  - [x] Normalisation POSIX : `folder = folder.replace('\\', '/')`
  - [x] Lire contenu : `content = await file.read()`
  - [x] Validation magic bytes : appeler `_validate_image(content)`
  - [x] Créer sous-dossier : `(UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)`
  - [x] Nom de fichier : `filename = Path(file.filename or "upload").name` (basename uniquement — prévient path traversal)
  - [x] Écrire sur disque : `(UPLOAD_DIR / folder / filename).write_bytes(content)`
  - [x] Insérer en DB : créer `models.Asset(filename, url, content_type, folder)`
  - [x] Retourner l'asset créé (db.refresh puis return)

- [x] **T4** — Ajouter les tests dans `backend/tests/test_assets.py` (AC: 1, 2, 3, 4)
  - [x] Test upload avec `folder` → champs corrects en réponse + fichier sur disque au bon chemin
  - [x] Test upload sans `folder` → dossier par défaut `backgrounds`
  - [x] Test normalisation backslash → `folder` stocké avec POSIX slash
  - [x] Test `GET /api/assets?folder=X` retrouve l'asset uploadé (persistance DB vérifiée)
  - [x] Tests upload existants (`test_upload_*`) toujours verts — pas de régression

## Dev Notes

### État actuel de `routers/assets.py` AVANT cette story

```python
import uuid
from pathlib import Path
from typing import List

import filetype
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/assets", tags=["assets"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/folders", response_model=List[str])
def list_folders(db: Session = Depends(get_db)):
    rows = db.query(models.Asset.folder).distinct().order_by(models.Asset.folder).all()
    return [row[0] for row in rows]


@router.get("/", response_model=List[schemas.Asset])
def list_assets(folder: str = Query(...), db: Session = Depends(get_db)):
    return db.query(models.Asset).filter(models.Asset.folder == folder).all()


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")
    kind = filetype.guess(content)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier invalide. Seules les images PNG, JPEG, WebP et GIF sont acceptées.",
        )
    ext = Path(file.filename or "upload").suffix or f".{kind.extension}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
```

### Ordre des routes APRÈS cette story — CRITIQUE

```
GET  /folders    ← Story 1.2 — statique, premier
GET  /           ← Story 1.2 — query param
POST /           ← Story 1.3 — nouveau endpoint média library (AVANT /upload)
POST /upload     ← existant — legacy, rétrocompatibilité frontend
```

FastAPI résout les routes dans l'ordre de déclaration. `POST /` et `POST /upload` sont différents, pas de conflit. Pour le futur `GET /{id}` (Story 1.4+), il devra venir après `GET /folders` et `GET /`.

### Implémentation complète de T2 + T3

```python
def _validate_image(content: bytes) -> str:
    """Validate image via magic bytes. Returns mime type or raises 400."""
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")
    kind = filetype.guess(content)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Type de fichier invalide. Seules les images PNG, JPEG, WebP et GIF sont acceptées.",
        )
    return kind.mime


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


@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    mime = _validate_image(content)
    ext = Path(file.filename or "upload").suffix or f".{filetype.guess(content).extension}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
```

**Notes sur `/upload` refactorisé :**
- Appelle maintenant `_validate_image(content)` — comportement identique
- Le `ext = ...` a besoin du `kind.extension` → `filetype.guess(content).extension`. Mais attention : on a déjà validé via `_validate_image`, donc `filetype.guess(content)` ne sera jamais `None` à ce stade. On peut aussi stocker le retour de `_validate_image` et recalculer l'extension depuis le mime : `ext = Path(file.filename or "upload").suffix or f".{mime.split('/')[1]}"`. À toi de choisir la forme la plus claire.

**Forme alternative plus propre pour upload_asset :**
```python
@router.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    content = await file.read()
    mime = _validate_image(content)
    ext = Path(file.filename or "upload").suffix or f".{mime.split('/')[1]}"
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}
```

### Pattern de test pour `POST /api/assets`

Pour cette story, les tests utilisent directement l'endpoint HTTP (pas `_create_asset` helper) — c'est le but de 1.3 de vérifier la persistance DB via l'endpoint.

La fixture `client` monkeypatch `UPLOAD_DIR` → `tmp_path`. Donc :
- `(UPLOAD_DIR / folder / filename)` en prod → `(tmp_path / folder / filename)` en test
- Pour vérifier l'existence du fichier sur disque, recevoir `tmp_path` en fixture

```python
# ── Story 1.3 — Upload d'un asset dans un dossier ─────────────────────────

def test_create_asset_with_folder(client, tmp_path):
    res = client.post(
        "/api/assets",
        files={"file": ("portrait.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "characters/alice"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "characters/alice"
    assert data["filename"] == "portrait.png"
    assert data["url"] == "/uploads/characters/alice/portrait.png"
    assert data["content_type"] == "image/png"
    assert data["is_seed"] is False
    assert "id" in data
    # Fichier sur disque au bon chemin
    assert (tmp_path / "characters" / "alice" / "portrait.png").exists()


def test_create_asset_default_folder(client, tmp_path):
    res = client.post(
        "/api/assets",
        files={"file": ("bg.png", io.BytesIO(MINIMAL_PNG), "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "backgrounds"
    assert data["url"] == "/uploads/backgrounds/bg.png"
    assert (tmp_path / "backgrounds" / "bg.png").exists()


def test_create_asset_normalizes_backslash_folder(client):
    res = client.post(
        "/api/assets",
        files={"file": ("img.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": r"characters\alice"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["folder"] == "characters/alice"
    assert data["url"] == "/uploads/characters/alice/img.png"


def test_create_asset_persists_in_db(client):
    """Asset uploaded via POST /api/assets must be retrievable via GET."""
    res = client.post(
        "/api/assets",
        files={"file": ("test.png", io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": "backgrounds"},
    )
    assert res.status_code == 200
    asset_id = res.json()["id"]

    # Retrieve via GET /api/assets?folder=backgrounds
    res2 = client.get("/api/assets?folder=backgrounds")
    assert res2.status_code == 200
    ids = [a["id"] for a in res2.json()]
    assert asset_id in ids


def test_create_asset_invalid_type_rejected(client):
    """Invalid file type must be rejected with 400."""
    res = client.post(
        "/api/assets",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        data={"folder": "backgrounds"},
    )
    assert res.status_code == 400
```

**Note sur `data=` vs `files=` dans httpx TestClient :**
`client.post("/api/assets", files={...}, data={...})` envoie les deux en multipart — c'est le bon pattern pour mélanger `Form` et `File` dans un même endpoint FastAPI.

### StaticFiles — rétrocompatibilité (AC: 4)

`StaticFiles(directory="uploads")` sert TOUS les fichiers dans `uploads/` et ses sous-dossiers récursivement — pas de test nécessaire, c'est le comportement par défaut de Starlette. Les anciens assets à URL plate `/uploads/{uuid}.ext` restent accessibles.

### Fixtures de test utilisées

- `client` (de `conftest.py`) — monkeypatch `UPLOAD_DIR` → `tmp_path`, DB in-memory
- `tmp_path` — fixture pytest standard, reçue directement dans les tests qui vérifient les fichiers sur disque
- Les deux peuvent être utilisées ensemble dans la même fonction de test

### Intelligence des stories précédentes (1.1 + 1.2)

- **Modèle `models.Asset`** : colonnes `id, filename, url, content_type, folder (default='backgrounds'), is_seed (default=False)` — déjà créé
- **Schéma `schemas.Asset`** : `from_attributes = True` — déjà créé
- **Pattern import DB** : absolus (`import models`, `from database import get_db`, etc.) — pas d'import relatif
- **Ordre des routes** : `/folders` AVANT `/{id}` futur — respecter l'ordre GET /folders, GET /, POST /, POST /upload
- **Pattern query** : sync SQLAlchemy, pas d'async
- **`_create_asset` helper** dans tests — reste utile pour les tests GET qui ne passent pas par l'endpoint upload (stories 1.2)
- **Magic bytes validation** : déjà présente dans `upload_asset` — à extraire en helper `_validate_image`

### Fichiers à toucher

| Fichier | Action | Quoi |
|---------|--------|------|
| `backend/routers/assets.py` | MODIFIER | Ajouter `Form` aux imports, extraire `_validate_image`, ajouter `POST /` avant `/upload` |
| `backend/tests/test_assets.py` | MODIFIER | Ajouter 5 tests pour `POST /api/assets` |

**Ne pas toucher :**
- `backend/models.py` — `Asset` déjà complet
- `backend/schemas.py` — `Asset` déjà complet
- `backend/main.py` — aucun changement requis (StaticFiles, migrations déjà en place)
- `frontend/` — hors scope de cette story
- `POST /api/assets/upload` — comportement final identique, uniquement refactorisé via `_validate_image`

### Périmètre de la story — bornes claires

**In scope :**
- Nouveau endpoint `POST /api/assets` avec `folder` multipart + persistance DB
- Extraction du helper `_validate_image` (refactor interne)
- Tests pour les 4 ACs

**Out of scope (stories suivantes) :**
- Story 1.4 : `PATCH /api/assets/folders` (rename dossier) + `PATCH /api/assets/{id}/rename` (rename fichier)
- Story 1.5 : détection same-name (`409 Conflict { existing_id, references }`) + `?replace=true`
- Pas de `GET /api/assets/{id}` dans cette story
- Pas de `DELETE /api/assets/{id}` dans cette story
- Pas de modification du frontend `api.assets.upload()` — reste sur `/upload`

### Project Structure Notes

- Router prefix `"/assets"` → `POST /api/assets/` (avec `/api` ajouté par `main.py`)
- `Form` disponible sans dépendance supplémentaire — `python-multipart==0.0.12` déjà dans `requirements.txt`
- `pathlib.Path.mkdir(parents=True, exist_ok=True)` — pas besoin d'importer `os`
- `UPLOAD_DIR` monkeypatché dans les tests → les sous-dossiers sont créés dans `tmp_path` (nettoyé automatiquement)

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — section "Naming Patterns" (`POST /api/assets`), "Format Patterns" (upload multipart), "D6 — Stockage disque miroir"
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.3 (AC complets)
- Stories précédentes: `_bmad-output/implementation-artifacts/1-1-migration-modele-asset.md`, `1-2-listing-des-assets-par-dossier.md`
- Code existant: `backend/routers/assets.py` — état actuel complet fourni dans Dev Notes
- Conftest: `backend/tests/conftest.py` — fixture `client` + monkeypatch `UPLOAD_DIR`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `Form` ajouté aux imports FastAPI de `routers/assets.py`.
- Helper `_validate_image(content: bytes) -> str` extrait — partagé par `create_asset` et `upload_asset`.
- `upload_asset` refactorisé pour appeler `_validate_image` — comportement identique, pas de régression.
- `POST /api/assets` (`@router.post("/")`) ajouté : `folder: str = Form(default="backgrounds")`, normalisation POSIX, `mkdir(parents=True, exist_ok=True)`, persistance DB, retourne `schemas.Asset`.
- 5 nouveaux tests : folder explicite + disque, dossier par défaut, normalisation backslash, persistance DB, type invalide rejeté.
- 101/101 tests passent (Python 3.12).

### File List

- `backend/routers/assets.py` — ajout `Form`, helper `_validate_image`, endpoint `POST /`
- `backend/tests/test_assets.py` — ajout 5 tests story 1.3
