---
baseline_commit: 3ace81f
---

# Story 1.4 : Renommage de dossier et de fichier

Status: review

## Story

En tant qu'auteur,
je veux renommer un dossier ou un fichier asset,
afin de corriger une erreur de nommage sans perdre mes références.

## Acceptance Criteria

1. **Given** un dossier `characters/alice` avec des assets en base et sur disque
   **When** `PATCH /api/assets/folders` avec body `{ "from": "characters/alice", "to": "characters/alice-v2" }` est appelé
   **Then** `os.rename` du dossier disque (`uploads/characters/alice` → `uploads/characters/alice-v2`) est exécuté EN PREMIER
   **And** si le rename disque réussit, les assets dont `folder = "characters/alice"` OU `folder LIKE "characters/alice/%"` voient leur `folder` ET leur `url` mis à jour
   **And** si le rename disque échoue, aucune écriture SQL n'est effectuée
   **And** la réponse est `200` avec la liste des assets mis à jour (ou un objet `{ "updated": N }`)

2. **Given** un dossier cible qui existe déjà sur disque (`uploads/characters/bob`)
   **When** `PATCH /api/assets/folders` avec `{ "from": "characters/alice", "to": "characters/bob" }` est appelé
   **Then** la réponse est `409 Conflict` AVANT toute mutation disque ou DB

3. **Given** un dossier `characters/alice` contenant aussi un sous-dossier `characters/alice/poses`
   **When** le dossier `characters/alice` est renommé en `characters/anna`
   **Then** les assets de `characters/alice` ET de `characters/alice/poses` sont mis à jour (`characters/anna` et `characters/anna/poses`)
   **And** les `url` correspondantes pointent vers les nouveaux chemins

4. **Given** un `from` ou `to` avec des backslashes Windows (`characters\alice`)
   **When** le rename est traité
   **Then** les deux valeurs sont normalisées en POSIX slash avant tout traitement

5. **Given** un asset avec `id=5`, `filename="portrait.png"`, `folder="characters/alice"`
   **When** `PATCH /api/assets/5/rename` avec body `{ "filename": "portrait-v2.png" }` est appelé
   **Then** le fichier physique est renommé sur disque (`uploads/characters/alice/portrait.png` → `.../portrait-v2.png`)
   **And** `filename` ET `url` sont mis à jour en base (`url = "/uploads/characters/alice/portrait-v2.png"`)
   **And** la réponse est l'objet `schemas.Asset` complet mis à jour

6. **Given** un `PATCH /api/assets/{id}/rename` sur un `id` inexistant
   **When** l'endpoint est appelé
   **Then** la réponse est `404 Not Found`

## Tasks / Subtasks

- [x] **T1** — Ajouter les schémas de requête dans `backend/schemas.py` (AC: 1, 5)
  - [x] Ajouter `Field` à l'import pydantic : `from pydantic import BaseModel, Field`
  - [x] `class FolderRename(BaseModel)` avec `from_: str = Field(alias="from")` et `to: str` (alias requis car `from` est un mot-clé Python)
  - [x] `class FileRename(BaseModel)` avec `filename: str`
  - [x] Placé juste après le schéma `Asset`

- [x] **T2** — Implémenter `PATCH /api/assets/folders` dans `backend/routers/assets.py` (AC: 1, 2, 3, 4)
  - [x] Déclarer la route AVANT `PATCH /{id}/rename` (cohérence avec l'ordre `/folders` puis `/{id}`)
  - [x] Signature : `def rename_folder(payload: schemas.FolderRename, db: Session = Depends(get_db))`
  - [x] Normaliser : `src = payload.from_.replace("\\", "/")`, `dst = payload.to.replace("\\", "/")`
  - [x] `src_path = UPLOAD_DIR / src`, `dst_path = UPLOAD_DIR / dst`
  - [x] Si `dst_path.exists()` → `HTTPException(409, "Le dossier cible existe déjà")` (AVANT toute mutation)
  - [x] `dst_path.parent.mkdir(parents=True, exist_ok=True)` puis `os.rename(src_path, dst_path)` (rename disque EN PREMIER)
  - [x] Requêter les assets affectés : `folder == src` OU `folder.like(f"{src}/%")`
  - [x] Pour chaque asset : `new_folder = dst + asset.folder[len(src):]` ; mettre à jour `asset.folder` ET `asset.url`
  - [x] `db.commit()` puis retourner `{"updated": len(affected)}`
  - [x] Ajouter `import os` en tête de fichier

- [x] **T3** — Implémenter `PATCH /api/assets/{id}/rename` dans `backend/routers/assets.py` (AC: 5, 6)
  - [x] Signature : `def rename_file(asset_id: int, payload: schemas.FileRename, db: Session = Depends(get_db))` avec `@router.patch("/{asset_id}/rename", response_model=schemas.Asset)`
  - [x] Récupérer l'asset par id ; si `None` → `HTTPException(404, "Asset introuvable")`
  - [x] `new_filename = Path(payload.filename).name` (basename uniquement — prévient le path traversal, même pattern que `create_asset`)
  - [x] `old_path.rename(new_path)` (rename disque)
  - [x] `asset.filename = new_filename` ; `asset.url = f"/uploads/{asset.folder}/{new_filename}"`
  - [x] `db.commit()` ; `db.refresh(asset)` ; retourner l'asset

- [x] **T4** — Ajouter les tests dans `backend/tests/test_assets.py` (AC: 1, 2, 3, 5, 6)
  - [x] Test rename dossier : assets créés via `POST` (disque + DB), PATCH folders → `folder` + `url` mis à jour, dossier disque renommé
  - [x] Test 409 si dossier cible existe (créer assets dans `from` et `to`, vérifier aucune mutation)
  - [x] Test rename dossier avec sous-dossier → les deux niveaux mis à jour
  - [x] Test normalisation backslash sur `from`/`to`
  - [x] Test rename fichier : PATCH `/{id}/rename` → `filename` + `url` mis à jour, fichier disque renommé (ancien absent, nouveau présent)
  - [x] Test rename fichier sur id inexistant → 404
  - [x] Tous les tests existants (101) restent verts

## Dev Notes

### CRITIQUE — `url` DOIT être mis à jour, pas seulement `folder`

L'architecture (D2) et l'AC d'origine de l'epic ne mentionnent que `folder = REPLACE(...)`. **C'est insuffisant et casserait les assets.** Le champ `url` est stocké en base (pas dérivé) sous la forme `/uploads/{folder}/{filename}`. Si le dossier change sur disque mais que `url` reste l'ancien chemin, l'image devient inaccessible (404 sur `StaticFiles`). Le système doit rester fonctionnel end-to-end : **mettre à jour `folder` ET `url` ensemble** pour le rename dossier comme pour le rename fichier.

C'est pourquoi cette story recommande une boucle Python (mise à jour cohérente des deux champs) plutôt que le `UPDATE ... REPLACE(folder, from, to)` SQL brut de la décision d'architecture. La boucle a un bénéfice secondaire : un remplacement par préfixe (`new_folder = dst + asset.folder[len(src):]`) évite le bug multi-occurrence de `REPLACE` (qui remplacerait toutes les occurrences de la sous-chaîne, pas seulement le préfixe).

### État actuel de `routers/assets.py` (baseline 3ace81f)

```python
import uuid
from pathlib import Path
from typing import List

import filetype
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db

router = APIRouter(prefix="/assets", tags=["assets"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _validate_image(content: bytes) -> str: ...   # déjà présent

@router.get("/folders", response_model=List[str]) ...     # Story 1.2
@router.get("/", response_model=List[schemas.Asset]) ...   # Story 1.2
@router.post("/", response_model=schemas.Asset) ...        # Story 1.3
@router.post("/upload") ...                                # legacy
```

### Ordre des routes APRÈS cette story — IMPORTANT

```
GET    /folders            ← Story 1.2 (statique)
GET    /                   ← Story 1.2
POST   /                   ← Story 1.3
POST   /upload             ← legacy
PATCH  /folders            ← Story 1.4 (statique, AVANT /{id}/rename)
PATCH  /{asset_id}/rename  ← Story 1.4 (path param, 2 segments)
```

`PATCH /folders` (1 segment) et `PATCH /{asset_id}/rename` (2 segments) ne se chevauchent pas structurellement, mais on déclare `/folders` en premier par cohérence avec le pattern GET établi (statique avant paramétré).

### Implémentation de référence — T2 + T3

```python
import os  # ajouter en tête

@router.patch("/folders")
def rename_folder(payload: schemas.FolderRename, db: Session = Depends(get_db)):
    src = payload.from_.replace("\\", "/")
    dst = payload.to.replace("\\", "/")
    src_path = UPLOAD_DIR / src
    dst_path = UPLOAD_DIR / dst
    if dst_path.exists():
        raise HTTPException(status_code=409, detail="Le dossier cible existe déjà")
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    os.rename(src_path, dst_path)  # disque EN PREMIER — rollback implicite (SQL non exécuté si échec)
    affected = (
        db.query(models.Asset)
        .filter(
            (models.Asset.folder == src) | (models.Asset.folder.like(f"{src}/%"))
        )
        .all()
    )
    for asset in affected:
        new_folder = dst + asset.folder[len(src):]
        asset.folder = new_folder
        asset.url = f"/uploads/{new_folder}/{asset.filename}"
    db.commit()
    return {"updated": len(affected)}


@router.patch("/{asset_id}/rename", response_model=schemas.Asset)
def rename_file(asset_id: int, payload: schemas.FileRename, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset introuvable")
    new_filename = Path(payload.filename).name
    old_path = UPLOAD_DIR / asset.folder / asset.filename
    new_path = UPLOAD_DIR / asset.folder / new_filename
    old_path.rename(new_path)
    asset.filename = new_filename
    asset.url = f"/uploads/{asset.folder}/{new_filename}"
    db.commit()
    db.refresh(asset)
    return asset
```

### Schémas de requête — T1

`from` est un mot-clé réservé Python → alias obligatoire (Pydantic v2) :

```python
from pydantic import BaseModel, Field   # ajouter Field

class FolderRename(BaseModel):
    from_: str = Field(alias="from")
    to: str

class FileRename(BaseModel):
    filename: str
```

`Field(alias="from")` permet de parser le JSON `{"from": ...}` vers `payload.from_`. FastAPI utilise l'alias dans le schéma OpenAPI exposé. Pas besoin de `populate_by_name` (on parse uniquement par alias).

### `os.rename` vs `Path.rename`

- Dossier (T2) : l'AC dit explicitement `os.rename` → `import os` + `os.rename(src_path, dst_path)`. `os.rename` accepte des objets `Path`.
- Fichier (T3) : `Path.rename` est suffisant et reste cohérent avec l'usage `pathlib` du fichier (Story 1.3). Les deux sont acceptables.
- `dst_path.parent.mkdir(parents=True, exist_ok=True)` avant le rename dossier : nécessaire si le dossier parent du `to` n'existe pas encore (ex. `to="archive/alice"` alors que `archive/` n'existe pas).

### Pattern de test — disque réel requis

`os.rename` opère sur le disque : les tests doivent créer les assets via l'endpoint `POST /api/assets` (écrit fichier + DB), PAS via le helper `_create_asset` (DB seulement, pas de fichier disque). La fixture `client` monkeypatche `UPLOAD_DIR` → `tmp_path`.

```python
# ── Story 1.4 — Renommage de dossier et de fichier ────────────────────────

def _upload(client, filename, folder):
    return client.post(
        "/api/assets",
        files={"file": (filename, io.BytesIO(MINIMAL_PNG), "image/png")},
        data={"folder": folder},
    )


def test_rename_folder_updates_folder_and_url(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/alice-v2"},
    )
    assert res.status_code == 200

    listing = client.get("/api/assets?folder=characters/alice-v2").json()
    assert len(listing) == 1
    assert listing[0]["id"] == asset_id
    assert listing[0]["url"] == "/uploads/characters/alice-v2/portrait.png"
    # Disque renommé
    assert (tmp_path / "characters" / "alice-v2" / "portrait.png").exists()
    assert not (tmp_path / "characters" / "alice").exists()
    # Ancien dossier vide en DB
    assert client.get("/api/assets?folder=characters/alice").json() == []


def test_rename_folder_target_exists_conflict(client):
    _upload(client, "a.png", "characters/alice")
    _upload(client, "b.png", "characters/bob")

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/bob"},
    )
    assert res.status_code == 409
    # Aucune mutation : alice intacte
    assert len(client.get("/api/assets?folder=characters/alice").json()) == 1


def test_rename_folder_renames_subfolders(client):
    _upload(client, "main.png", "characters/alice")
    _upload(client, "pose.png", "characters/alice/poses")

    res = client.patch(
        "/api/assets/folders",
        json={"from": "characters/alice", "to": "characters/anna"},
    )
    assert res.status_code == 200
    assert len(client.get("/api/assets?folder=characters/anna").json()) == 1
    sub = client.get("/api/assets?folder=characters/anna/poses").json()
    assert len(sub) == 1
    assert sub[0]["url"] == "/uploads/characters/anna/poses/pose.png"


def test_rename_file_updates_db_and_disk(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]

    res = client.patch(
        f"/api/assets/{asset_id}/rename",
        json={"filename": "portrait-v2.png"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "portrait-v2.png"
    assert data["url"] == "/uploads/characters/alice/portrait-v2.png"
    assert (tmp_path / "characters" / "alice" / "portrait-v2.png").exists()
    assert not (tmp_path / "characters" / "alice" / "portrait.png").exists()


def test_rename_file_not_found(client):
    res = client.patch("/api/assets/999/rename", json={"filename": "x.png"})
    assert res.status_code == 404
```

**Note `json=` vs `data=`** : `PATCH /folders` et `/{id}/rename` consomment un body JSON (Pydantic), donc `client.patch(..., json={...})`. À ne pas confondre avec `POST /api/assets` qui est multipart (`files=` + `data=`).

### Intelligence des stories précédentes (1.1 → 1.3)

- **Modèle `Asset`** (`models.py:112`) : `id, filename, url, content_type, folder (default "backgrounds"), is_seed (default False)` — complet, ne pas toucher.
- **Schéma `Asset`** (`schemas.py:15`) : `model_config = {"from_attributes": True}` — déjà OK pour retourner les ORM.
- **`_validate_image` helper** + `create_asset` (`POST /`) déjà en place — réutilisés par les tests pour écrire sur disque.
- **Pattern path traversal** : `Path(...).name` pour ne garder que le basename (utilisé dans `create_asset` ligne 56) — réappliquer dans `rename_file`.
- **Imports absolus** : `import models`, `import schemas`, `from database import get_db`.
- **Normalisation POSIX** : `value.replace("\\", "/")` (Story 1.3) — réappliquer à `from`/`to`.
- **Fixture `client`** monkeypatche `UPLOAD_DIR` → `tmp_path` ; `tmp_path` injectable en parallèle dans la même fonction de test.

### Fichiers à toucher

| Fichier | Action | Quoi |
|---------|--------|------|
| `backend/schemas.py` | MODIFIER | Ajouter `Field` à l'import + `FolderRename` + `FileRename` |
| `backend/routers/assets.py` | MODIFIER | `import os` + `PATCH /folders` + `PATCH /{asset_id}/rename` |
| `backend/tests/test_assets.py` | MODIFIER | Ajouter ~5 tests Story 1.4 |

**Ne pas toucher :** `models.py` (Asset complet), `main.py` (migrations/StaticFiles déjà en place), `frontend/` (hors scope — les composants média consommeront ces endpoints en Epic 2), `POST /` et `POST /upload` (inchangés).

### Périmètre — bornes claires

**In scope :** les deux endpoints de rename (dossier + fichier), mise à jour cohérente `folder` + `url`, garde 409 dossier cible existant, garde 404 asset inexistant, normalisation POSIX, tests.

**Out of scope :**
- Story 1.5 : détection same-name (`409 { existing_id, references }`) + `?replace=true`.
- `DELETE /api/assets/{id}` (Epic 2).
- Frontend (renommage inline UI = Story 2.4, rename dossier UI dérivé de FolderTree en Epic 2).
- Pas de garde sur les assets legacy à URL plate (`/uploads/{uuid}.ext`, `folder="backgrounds"`) : leur fichier est à la racine de `uploads/`, pas dans `uploads/backgrounds/` — un rename du dossier `backgrounds` ou d'un de ces assets ne les retrouverait pas sur disque. Cas marginal pré-existant (assets antérieurs à la structure dossier), non traité dans cette story de prototype.

### Project Structure Notes

- Router prefix `"/assets"` → endpoints exposés sous `/api/assets/...` (`/api` ajouté dans `main.py`).
- `os` est dans la stdlib — pas de dépendance nouvelle. `python-multipart` déjà présent (non requis ici, body JSON).
- Réponse de `PATCH /folders` : `{"updated": N}` choisi pour sa simplicité (le frontend re-fetchera via `mutate(["assets", folder])` + `mutate("asset-folders")` en Epic 2). Renvoyer la liste des assets est une alternative valable si jugée plus utile.

### References

- Architecture : `_bmad-output/planning-artifacts/architecture.md` — D2 (rename dossier, `os.rename` avant SQL), section "Naming Patterns" (`PATCH /api/assets/folders`, `PATCH /api/assets/{id}/rename`), "Process Patterns" (rename dossier : `os.rename` si `from != to` et `to` absent → 409 sinon), gap "Atomicité rename dossier" (os.rename en premier, rollback SQL si échec OS).
- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 1.4 (AC complets), FR additionnels (PATCH /folders rename masse, PATCH /{id}/rename).
- Project context : `_bmad-output/project-context.md` — SQLAlchemy sync, pas de couche service (logique dans `routers/`), HTTPException(400/404/409) pour erreurs métier, reorder valide avant écriture.
- Code existant : `backend/routers/assets.py` (état complet ci-dessus), `backend/schemas.py:15` (Asset), `backend/schemas.py:189` (ReorderRequest, pattern body), `backend/models.py:112` (Asset), `backend/tests/conftest.py` (fixture client + monkeypatch UPLOAD_DIR), `backend/tests/test_assets.py` (MINIMAL_PNG, _create_asset, pattern POST multipart).
- Stories précédentes : `1-1-migration-modele-asset.md`, `1-2-listing-des-assets-par-dossier.md`, `1-3-upload-dun-asset-dans-un-dossier.md`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

### Completion Notes List

- TDD : 6 tests écrits d'abord (RED confirmé, 5 échecs + 1 faux-positif 404 sur route absente), puis implémentation (GREEN).
- T1 : `Field` ajouté à l'import pydantic ; `FolderRename` (`from_` aliasé `from`) + `FileRename` ajoutés après le schéma `Asset`.
- T2 : `PATCH /api/assets/folders` — garde `409` AVANT mutation si dossier cible existe, `os.rename` disque en premier, puis boucle de mise à jour cohérente `folder` + `url` (remplacement par préfixe couvrant le dossier exact et ses sous-dossiers). Normalisation POSIX sur `from`/`to`. Retourne `{"updated": N}`.
- T3 : `PATCH /api/assets/{asset_id}/rename` — garde `404`, basename via `Path(...).name` (anti path-traversal), rename disque + mise à jour `filename` + `url`. Déclaré après `/folders`.
- `import os` ajouté en tête de `routers/assets.py`.
- Décision documentée respectée : `url` mis à jour en plus de `folder` (sinon assets cassés) — la boucle Python plutôt que `REPLACE` SQL évite le bug multi-occurrence.
- Suite complète : 107/107 tests passent (101 préexistants + 6 nouveaux), aucune régression. Warnings `datetime.utcnow` préexistants, non liés.

### File List

- `backend/schemas.py` — import `Field` + schémas `FolderRename`, `FileRename`
- `backend/routers/assets.py` — `import os` + endpoints `PATCH /folders` et `PATCH /{asset_id}/rename`
- `backend/tests/test_assets.py` — helper `_upload` + 6 tests Story 1.4

## Change Log

- 2026-06-14 — Implémentation Story 1.4 : endpoints `PATCH /api/assets/folders` (rename dossier, os.rename + maj folder/url, garde 409) et `PATCH /api/assets/{id}/rename` (rename fichier, garde 404). 6 tests ajoutés, 107/107 verts. Status → review.
