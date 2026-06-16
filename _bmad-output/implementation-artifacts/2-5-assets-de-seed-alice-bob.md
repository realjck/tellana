---
baseline_commit: "5612fd1"
---

# Story 2.5 : Assets de seed Alice & Bob

Status: done

## Story

En tant qu'auteur débutant sur Tellana,
je veux trouver des assets de démonstration prêts à l'emploi au premier lancement,
afin de pouvoir tester l'application sans uploader mes propres images.

## Acceptance Criteria

1. **Given** les fichiers `backend/seed_assets/characters/alice/default.png`, `happy.png`, `surprised.png` et `backend/seed_assets/characters/bob/default.png`, `happy.png`, `surprised.png` sont commités dans le repo
   **When** l'application démarre (lifespan)
   **Then** chaque fichier est copié dans `uploads/characters/alice/` (ou `bob/`) si absent via `shutil.copy2`
   **And** chaque asset est inséré en base avec `folder="characters/alice"` (ou `bob/`) et `is_seed=True` si le couple `(folder, filename)` n'existe pas déjà

2. **Given** l'application redémarre avec les seeds déjà présents
   **When** le lifespan s'exécute
   **Then** aucune copie ni insertion supplémentaire n'est effectuée (idempotence)

3. **Given** l'utilisateur ouvre la médiathèque et navigue dans `characters/alice`
   **When** `AssetGrid` affiche les assets
   **Then** les 3 poses sont visibles avec un badge "seed" sur chaque vignette

## Tasks / Subtasks

- [x] **T1** — Créer les images de seed dans `backend/seed_assets/` (AC: 1)
  - [x] Créer `backend/seed_assets/characters/alice/default.png` (PNG valide, placeholder 1×1)
  - [x] Créer `backend/seed_assets/characters/alice/happy.png`
  - [x] Créer `backend/seed_assets/characters/alice/surprised.png`
  - [x] Créer `backend/seed_assets/characters/bob/default.png`
  - [x] Créer `backend/seed_assets/characters/bob/happy.png`
  - [x] Créer `backend/seed_assets/characters/bob/surprised.png`
  - [x] Vérifier que ces fichiers ne sont pas couverts par `.gitignore` (les commiter)

- [x] **T2** — Modifier `backend/main.py` : ajouter le seed loader et le lifespan (AC: 1, 2)
  - [x] Ajouter les imports en haut : `import shutil`, `from contextlib import asynccontextmanager`
  - [x] Définir `SEED_ASSETS_DIR = Path("seed_assets")` après les autres `Path(...)` au niveau module
  - [x] Ajouter la fonction `_load_seeds(db, upload_dir: Path, seed_dir: Path) -> None` (voir Dev Notes)
  - [x] Ajouter le `@asynccontextmanager async def lifespan(app)` qui appelle `_load_seeds` (voir Dev Notes)
  - [x] Passer `lifespan=lifespan` dans `FastAPI(...)` — remplacer `app = FastAPI(title="Tellana API", version="0.1.0")`

- [x] **T3** — Créer `backend/tests/test_seed.py` avec 5 tests (AC: 1, 2)
  - [x] `test_seed_copies_files_to_uploads` : vérifie les 6 fichiers copiés
  - [x] `test_seed_inserts_db_with_is_seed_true` : vérifie 6 assets en base, `is_seed=True`, bons dossiers
  - [x] `test_seed_is_idempotent` : appel double → toujours 6 assets, pas de doublons
  - [x] `test_seed_skips_if_no_seed_dir` : `seed_dir` absent → 0 asset, pas d'erreur
  - [x] `test_seed_does_not_overwrite_existing_file` : fichier déjà présent → non écrasé

## Dev Notes

### Périmètre — bornes strictes

**In scope :**
- `backend/seed_assets/characters/alice/` — 3 PNGs
- `backend/seed_assets/characters/bob/` — 3 PNGs
- `backend/main.py` — ajout `_load_seeds`, `SEED_ASSETS_DIR`, `lifespan`, imports `shutil`/`asynccontextmanager`
- `backend/tests/test_seed.py` — 5 nouveaux tests (NOUVEAU fichier)

**Out of scope :**
- Frontend — le badge `is_seed` est déjà implémenté dans `AssetGrid` (story 2.2, `AssetGrid.tsx`)
- Aucune modification d'endpoint API (le seed loader ne passe pas par `POST /api/assets`)
- Pas d'ajout de colonne DB (déjà présentes : `folder` et `is_seed` depuis story 1.1)
- Ne pas modifier `schemas.py`, `models.py`, `database.py`, `routers/assets.py` ni aucun test existant

### T1 — Création des fichiers PNG de seed

Les images de seed sont des **placeholders** valides (1×1 pixel PNG). Elles sont destinées à être remplacées par de vraies illustrations ultérieurement. Le projet étant un prototype, des images minimales sont acceptables.

**Script Python pour générer les 6 fichiers** (à exécuter depuis `backend/`) :

```python
import struct, zlib, os

MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)

for persona in ["alice", "bob"]:
    for pose in ["default", "happy", "surprised"]:
        path = f"seed_assets/characters/{persona}/{pose}.png"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(MINIMAL_PNG)
print("6 seed PNGs created.")
```

Le même `MINIMAL_PNG` est déjà utilisé dans `backend/tests/test_assets.py` — c'est un PNG valide reconnu par `filetype.guess()` et `_validate_image()`.

**IMPORTANT** : vérifier que `backend/seed_assets/` n'est pas inclus dans `.gitignore`. Le fichier `.gitignore` au niveau projet exclut `backend/published/` — `seed_assets/` doit être commité.

### T2 — Implémentation dans `main.py`

**Position des ajouts dans le fichier existant :**
- Imports à ajouter en haut (ligne 1–7) : `import shutil` + `from contextlib import asynccontextmanager`
- `SEED_ASSETS_DIR` : après `Path("published").mkdir(exist_ok=True)` (ligne ~59)
- `_load_seeds` + `lifespan` : avant `app = FastAPI(...)` (ligne ~61)
- Modifier `app = FastAPI(...)` pour passer `lifespan=lifespan`

**Imports à ajouter :**
```python
import shutil
from contextlib import asynccontextmanager
```

**Constante à ajouter après `Path("published").mkdir(exist_ok=True)` :**
```python
SEED_ASSETS_DIR = Path("seed_assets")
```

**Fonction `_load_seeds` :**
```python
def _load_seeds(db, upload_dir: Path, seed_dir: Path) -> None:
    """Copy seed PNGs to upload_dir and register in DB. Idempotent."""
    if not seed_dir.exists():
        return
    for src_file in sorted(seed_dir.rglob("*.png")):
        rel = src_file.relative_to(seed_dir)
        folder = rel.parent.as_posix()
        filename = src_file.name
        dest_dir = upload_dir / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / filename
        if not dest_file.exists():
            shutil.copy2(src_file, dest_file)
        existing = (
            db.query(models.Asset)
            .filter(models.Asset.folder == folder, models.Asset.filename == filename)
            .first()
        )
        if not existing:
            db.add(
                models.Asset(
                    filename=filename,
                    url=f"/uploads/{folder}/{filename}",
                    content_type="image/png",
                    folder=folder,
                    is_seed=True,
                )
            )
    db.commit()
```

**`lifespan` :**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    import routers.assets as _assets_router
    db = SessionLocal()
    try:
        _load_seeds(db, _assets_router.UPLOAD_DIR, SEED_ASSETS_DIR)
    finally:
        db.close()
    yield
```

**Pourquoi `import routers.assets as _assets_router` DANS le corps de la fonction ?**
Le conftest monkeypatch `routers.assets.UPLOAD_DIR` AVANT l'entrée dans le lifespan. Si l'import est au niveau module (en haut de `main.py`), il capture la valeur initiale `Path("uploads")` et non la valeur patchée `tmp_path`. En important dynamiquement dans la fonction, on obtient la valeur courante de l'attribut — qui sera `tmp_path` dans les tests.

**Modification de la ligne `app = FastAPI(...)` :**
```python
# Avant :
app = FastAPI(title="Tellana API", version="0.1.0")

# Après :
app = FastAPI(title="Tellana API", version="0.1.0", lifespan=lifespan)
```

**Import `SessionLocal` à ajouter** (ligne 8, avec les autres imports depuis `database`) :
```python
from database import engine, SessionLocal
```

### T3 — Tests dans `backend/tests/test_seed.py`

Les tests appellent `_load_seeds()` **directement** — pas via le lifespan. Cela permet d'injecter une session in-memory et un `tmp_path` comme `upload_dir`.

**Fixture `seed_dir`** : crée une structure `seed_assets/` temporaire avec 6 PNGs valides.

```python
import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import Base
from main import _load_seeds

# Même bytes que test_assets.py
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def seed_dir(tmp_path):
    """Fake seed_assets/ with 6 minimal PNGs."""
    for persona in ["alice", "bob"]:
        for pose in ["default", "happy", "surprised"]:
            p = tmp_path / "seed_assets" / "characters" / persona
            p.mkdir(parents=True, exist_ok=True)
            (p / f"{pose}.png").write_bytes(MINIMAL_PNG)
    return tmp_path / "seed_assets"


def test_seed_copies_files_to_uploads(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    for persona in ["alice", "bob"]:
        for pose in ["default", "happy", "surprised"]:
            assert (upload_dir / "characters" / persona / f"{pose}.png").exists()


def test_seed_inserts_db_with_is_seed_true(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    assets = db_session.query(models.Asset).all()
    assert len(assets) == 6
    assert all(a.is_seed for a in assets)
    folders = {a.folder for a in assets}
    assert folders == {"characters/alice", "characters/bob"}


def test_seed_is_idempotent(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, seed_dir)
    _load_seeds(db_session, upload_dir, seed_dir)
    assert db_session.query(models.Asset).count() == 6


def test_seed_skips_if_no_seed_dir(db_session, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    _load_seeds(db_session, upload_dir, tmp_path / "nonexistent")
    assert db_session.query(models.Asset).count() == 0


def test_seed_does_not_overwrite_existing_file(db_session, seed_dir, tmp_path):
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    dest = upload_dir / "characters" / "alice"
    dest.mkdir(parents=True)
    existing_content = b"existing content"
    (dest / "default.png").write_bytes(existing_content)
    _load_seeds(db_session, upload_dir, seed_dir)
    assert (dest / "default.png").read_bytes() == existing_content
```

### Pourquoi les tests existants ne cassent pas

Quand le lifespan s'exécute pendant les tests existants :
1. `seed_assets/` existe sur disque → le lifespan copie les 6 PNGs dans `tmp_path/` (UPLOAD_DIR patchée) — inoffensif
2. `SessionLocal()` ouvre la DB réelle `tellana.db`, pas la DB in-memory de test → les inserts n'affectent pas les assertions des tests existants
3. Aucun endpoint API n'est appelé → aucune interaction avec la fixture `client`

Les tests de seed (`test_seed.py`) appellent `_load_seeds()` directement, sans passer par le lifespan ni `TestClient`.

### Comportement attendu au démarrage (non-test)

```
$ uvicorn main:app --reload
INFO:  Started reloader process
INFO:  Started server process
# lifespan s'exécute : 6 copies + 6 inserts au 1er lancement
# Au 2ème lancement : aucune copie, aucun insert (idempotence)
```

Après démarrage, `GET /api/assets/folders` inclut `characters/alice` et `characters/bob`. La médiathèque affiche les 6 assets avec badge "seed" (déjà géré dans AssetGrid depuis story 2.2).

### Invariants à respecter

1. `shutil.copy2` uniquement si `dest_file` absent — jamais d'écrasement
2. INSERT en base uniquement si `(folder, filename)` absent — pas de doublon
3. `db.commit()` une seule fois après la boucle (pas par fichier)
4. `_load_seeds` retourne silencieusement si `seed_dir` absent — ne jamais lever d'exception
5. `folder` extrait via `.as_posix()` — toujours `/`, jamais `\` (Windows-safe)
6. `content_type="image/png"` hardcodé — les seeds sont toujours des PNG

### Vérification de non-régression

Après implémentation :
- `python -m pytest` (depuis `backend/`) : 120 tests existants + 5 nouveaux seed — tous verts
- `npm test` (depuis `frontend/`) : 107 tests existants — tous verts (aucune modification frontend)
- Lancer `uvicorn main:app --reload` depuis `backend/` : vérifier que `GET /api/assets?folder=characters/alice` retourne 3 assets avec `is_seed=true`

### Project Structure Notes

**Nouveaux fichiers :**
- `backend/seed_assets/characters/alice/default.png`
- `backend/seed_assets/characters/alice/happy.png`
- `backend/seed_assets/characters/alice/surprised.png`
- `backend/seed_assets/characters/bob/default.png`
- `backend/seed_assets/characters/bob/happy.png`
- `backend/seed_assets/characters/bob/surprised.png`
- `backend/tests/test_seed.py`

**Fichier modifié :**
- `backend/main.py` — ajout `import shutil`, `from contextlib import asynccontextmanager`, `from database import engine, SessionLocal`, `SEED_ASSETS_DIR`, `_load_seeds()`, `lifespan`, paramètre `lifespan=lifespan` sur `FastAPI()`

**Aucune modification frontend.** Le badge `is_seed` est déjà implémenté dans `frontend/components/media-library/AssetGrid.tsx` (story 2.2).

### References

- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 2.5 ACs + FR-3.1 à FR-3.5
- Story 2.2 : `_bmad-output/implementation-artifacts/` — AssetGrid.tsx avec badge `is_seed` déjà implémenté
- Code existant :
  - `backend/main.py` — structure actuelle à modifier (migrations module-level, app sans lifespan)
  - `backend/database.py` — `SessionLocal` à importer dans `main.py`
  - `backend/models.py` — `Asset` avec colonnes `folder`, `is_seed` déjà présentes
  - `backend/tests/test_assets.py` — `MINIMAL_PNG` (bytes réutilisables) + patterns de test existants
  - `backend/tests/conftest.py` — monkeypatch `UPLOAD_DIR` sur `routers.assets`, pattern `with TestClient(app)`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- T1 — 6 PNGs créés via script Python dans `backend/seed_assets/characters/{alice,bob}/{default,happy,surprised}.png` (67 bytes chacun, PNG 1×1 valide). Confirmé absent du `.gitignore`.
- T2 — `main.py` modifié : imports `shutil` + `asynccontextmanager` ajoutés, `SessionLocal` importé depuis `database`, `SEED_ASSETS_DIR = Path("seed_assets")` défini, `_load_seeds(db, upload_dir, seed_dir)` implémentée (rglob("*.png"), idempotence copie + INSERT), `lifespan` avec import dynamique `routers.assets` pour compatibilité monkeypatch tests, `app = FastAPI(..., lifespan=lifespan)`.
- T3 — `backend/tests/test_seed.py` créé avec 5 tests : copies fichiers, inserts is_seed=True, idempotence (appel double), skip si seed_dir absent, non-écrasement fichier existant. 5/5 verts.
- Suite complète : 125/125 tests verts. Aucune régression. Warnings `utcnow()` préexistants, hors scope.
- AC3 couvert par `AssetGrid.tsx` déjà implémenté (story 2.2) — badge `is_seed` affiché, aucune modification frontend nécessaire.

### File List

- `backend/seed_assets/characters/alice/default.png` — CRÉÉ
- `backend/seed_assets/characters/alice/happy.png` — CRÉÉ
- `backend/seed_assets/characters/alice/surprised.png` — CRÉÉ
- `backend/seed_assets/characters/bob/default.png` — CRÉÉ
- `backend/seed_assets/characters/bob/happy.png` — CRÉÉ
- `backend/seed_assets/characters/bob/surprised.png` — CRÉÉ
- `backend/main.py` — MODIFIÉ : imports shutil/asynccontextmanager/SessionLocal, SEED_ASSETS_DIR, _load_seeds(), lifespan, FastAPI(lifespan=)
- `backend/tests/test_seed.py` — CRÉÉ : 5 tests seed loader

### Review Findings

- [x] [Review][Defer] `db.commit()` sans try/except — désync fichier/DB auto-guérissante au prochain restart [backend/main.py] — deferred, prototype SQLite, self-healing
- [x] [Review][Defer] Race condition démarrage multi-worker — deux processus peuvent copier/insérer simultanément [backend/main.py] — deferred, prototype single-worker (uvicorn sans --workers)
- [x] [Review][Defer] `folder="."` si un PNG est placé à la racine de `seed_dir` — URL `/uploads/./foo.png` invalide [backend/main.py] — deferred, impossible avec la structure `seed_assets/characters/{persona}/` actuelle
- [x] [Review][Defer] N requêtes SELECT séparées dans `_load_seeds` — une par fichier au lieu d'un batch [backend/main.py] — deferred, 6 fichiers, négligeable
- [x] [Review][Defer] `db_session` fixture : `drop_all` après `close()` [backend/tests/test_seed.py] — deferred, fonctionne avec StaticPool SQLite
- [x] [Review][Defer] Tests : contenu du fichier copié non vérifié (`exists()` seulement, pas les bytes) [backend/tests/test_seed.py] — deferred, couverture acceptable prototype
- [x] [Review][Defer] `is_seed=False` pour les assets non-seed non testé [backend/tests/test_seed.py] — deferred, couverture acceptable
- [x] [Review][Defer] Docstring `_load_seeds` dit "Idempotent" — inexact en cas d'échec partiel [backend/main.py] — deferred, nitpick
- [x] [Review][Defer] `seed_dir` est un fichier (pas un dossier) — `rglob` comportement non défini [backend/main.py] — deferred, improbable

## Change Log

- 2026-06-15 — Story 2.5 créée (create-story workflow). Status → ready-for-dev.
- 2026-06-15 — Story 2.5 implémentée : 6 PNGs seed, _load_seeds() + lifespan dans main.py (5 tests). 125/125 backend verts. Status → review.
