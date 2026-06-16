---
baseline_commit: bb83937e04793820c8ff2935f8ac805e346e87ee
---

# Story 1.1 : Migration modèle Asset

Status: review

## Story

En tant qu'auteur,
je veux que les assets soient associés à un dossier sémantique,
afin de les retrouver organisés par catégorie.

## Acceptance Criteria

1. **Given** une base de données existante avec des assets sans dossier
   **When** l'application démarre
   **Then** la colonne `folder TEXT DEFAULT 'backgrounds'` est ajoutée à la table `assets` via `ALTER TABLE` dans un `try/except` (pas d'erreur si elle existe déjà)
   **And** la colonne `is_seed BOOLEAN DEFAULT FALSE` est ajoutée de la même façon
   **And** les assets existants ont `folder = 'backgrounds'` et `is_seed = False`

2. **Given** le schéma Pydantic `Asset`
   **When** un endpoint retourne un asset
   **Then** la réponse JSON inclut les champs `folder: str` et `is_seed: bool`

3. **Given** le type TypeScript `Asset` dans `frontend/lib/api.ts` (ou `frontend/types/index.ts`)
   **When** le frontend consomme l'API
   **Then** `Asset` expose `folder: string` et `is_seed: boolean`
   **And** `AssetRef` reste inchangé (`{ type, url, opfs_key, job_id, mime_type, width, height }`) — aucune breaking change

## Tasks / Subtasks

- [x] **T1** — Ajouter le modèle SQLAlchemy `Asset` dans `backend/models.py` (AC: 1, 2)
  - [x] Colonnes : `id`, `filename`, `url`, `content_type`, `folder` (default `'backgrounds'`), `is_seed` (default `False`)

- [x] **T2** — Ajouter les migrations safe dans `backend/main.py` (AC: 1)
  - [x] `ALTER TABLE assets ADD COLUMN folder TEXT DEFAULT 'backgrounds'` dans `try/except`
  - [x] `ALTER TABLE assets ADD COLUMN is_seed BOOLEAN DEFAULT FALSE` dans `try/except`
  - [x] Placer après les migrations existantes, avant `app = FastAPI(...)`

- [x] **T3** — Ajouter le schéma Pydantic `Asset` dans `backend/schemas.py` (AC: 2)
  - [x] Classe `Asset(BaseModel)` avec tous les champs (y.c. `folder: str`, `is_seed: bool`)
  - [x] `model_config = {"from_attributes": True}`

- [x] **T4** — Ajouter l'interface TypeScript `Asset` dans `frontend/types/index.ts` (AC: 3)
  - [x] `id: number`, `filename: string`, `url: string`, `content_type: string`, `folder: string`, `is_seed: boolean`

- [x] **T5** — Mettre à jour les tests dans `backend/tests/test_assets.py` (AC: 1, 2)
  - [x] Test : le modèle `Asset` peut être créé en DB et la sérialisation Pydantic inclut `folder` et `is_seed`
  - [x] Tests existants `test_upload_*` doivent continuer à passer sans modification

## Dev Notes

### Contexte critique — ce qui EXISTE déjà

**Aucun modèle `Asset` dans le codebase actuel.** Le router `backend/routers/assets.py` possède uniquement `POST /api/assets/upload` qui :
- Valide par magic bytes (librairie `filetype`)
- Sauvegarde sur disque dans `uploads/{uuid}.ext`
- Retourne `{"url": "/uploads/{filename}"}` — **aucune persistance DB**

Le frontend `lib/api.ts` `assets.upload()` consomme ce retour et construit un `AssetRef` avec `data.url`. **Ce endpoint ne doit PAS être modifié dans cette story.**

**`AssetRef` (dans `types/index.ts` et `schemas.py`) est une chose différente de `Asset`.** `AssetRef` = référence embarquée dans les JSONs des scènes/personnages (structure immuable `{type, url, opfs_key, ...}`). `Asset` = enregistrement DB de la médiathèque (nouveau, avec `folder` et `is_seed`). Ne pas confondre, ne pas fusionner.

### Pattern de migration à reproduire exactement

Regarder `backend/main.py` lignes 15-40 pour le pattern exact. Chaque migration est un bloc indépendant :

```python
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE assets ADD COLUMN folder TEXT DEFAULT 'backgrounds'"))
    except Exception:
        pass  # Column already exists

with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE assets ADD COLUMN is_seed BOOLEAN DEFAULT FALSE"))
    except Exception:
        pass  # Column already exists
```

**Pourquoi deux blocs séparés ?** Si le premier `ALTER TABLE` échoue (colonne existe), le second doit quand même s'exécuter.

**Pourquoi `try/except` si la table `assets` n'existe pas encore ?** La table `assets` sera créée par `models.Base.metadata.create_all(bind=engine)` (déjà en début de `main.py`) avec TOUTES les colonnes, y.c. `folder` et `is_seed`. Les `ALTER TABLE` ne s'exécutent que sur des DBs existantes qui auraient une table `assets` sans ces colonnes — guard de rétrocompatibilité.

### Modèle SQLAlchemy `Asset` à créer

```python
class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    url = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    folder = Column(String, nullable=False, default="backgrounds")
    is_seed = Column(Boolean, nullable=False, default=False)
```

Pas de `created_at` / `updated_at` — non requis par les specs. Pas de relationship pour l'instant.

### Schéma Pydantic `Asset` à créer dans `schemas.py`

```python
class Asset(BaseModel):
    id: int
    filename: str
    url: str
    content_type: str
    folder: str
    is_seed: bool

    model_config = {"from_attributes": True}
```

Pas de `AssetCreate` ni `AssetUpdate` dans cette story — les endpoints CRUD seront dans Story 1.3+.

### Interface TypeScript `Asset` à ajouter dans `frontend/types/index.ts`

Ajouter après `AssetRef` (ne pas modifier `AssetRef`) :

```typescript
export interface Asset {
  id: number;
  filename: string;
  url: string;
  content_type: string;
  folder: string;
  is_seed: boolean;
}
```

**`AssetRef` n'est pas modifié.** `resolveAsset(ref: AssetRef)` dans `lib/api.ts` n'est pas modifié.

### Tests backend

La fixture `client` dans `tests/conftest.py` utilise SQLite in-memory avec `StaticPool` et `create_all` — la table `assets` sera créée automatiquement avec les nouvelles colonnes. Les migrations `ALTER TABLE` ne s'exécutent pas dans les tests (elles sont dans `main.py` au démarrage applicatif, pas appelées par les tests).

**Tests à ajouter dans `test_assets.py` :**
- Vérifier que les tests d'upload existants passent toujours (aucune modification de l'endpoint)
- Ajouter un test de création directe d'un `Asset` en DB et sérialisation via le schéma Pydantic :

```python
def test_asset_schema_includes_folder_and_is_seed(client):
    """Asset schema must expose folder and is_seed fields."""
    from models import Asset as AssetModel
    from schemas import Asset as AssetSchema
    from database import SessionLocal

    db = SessionLocal()
    asset = AssetModel(
        filename="test.png",
        url="/uploads/backgrounds/test.png",
        content_type="image/png",
        folder="backgrounds",
        is_seed=False,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    schema = AssetSchema.model_validate(asset)
    assert schema.folder == "backgrounds"
    assert schema.is_seed is False
    db.close()
```

**Attention** : utiliser `SessionLocal` directement (importé de `database`), pas le `client` HTTP, car il n'y a pas encore d'endpoint GET pour récupérer un asset.

### Fichiers à toucher

| Fichier | Action | Quoi |
|---------|--------|------|
| `backend/models.py` | MODIFIER | Ajouter classe `Asset` |
| `backend/main.py` | MODIFIER | Ajouter 2 migrations `ALTER TABLE assets` |
| `backend/schemas.py` | MODIFIER | Ajouter classe `Asset` |
| `frontend/types/index.ts` | MODIFIER | Ajouter interface `Asset` |
| `backend/tests/test_assets.py` | MODIFIER | Ajouter test schéma |

**Ne pas toucher :**
- `backend/routers/assets.py` — le endpoint upload reste inchangé
- `frontend/lib/api.ts` — `assets.upload()` et `resolveAsset()` restent inchangés
- `frontend/types/index.ts` → `AssetRef` — structure immuable

### Périmètre de la story — bornes claires

**In scope :** modèle DB + schéma Pydantic + type TypeScript + migrations + tests schéma.

**Out of scope (stories suivantes) :**
- Story 1.2 : `GET /api/assets?folder=X` et `GET /api/assets/folders`
- Story 1.3 : `POST /api/assets` avec `folder` multipart + persistance DB au moment de l'upload
- Story 1.4 : rename dossier/fichier
- Story 1.5 : détection same-name / 409 Conflict

### Project Structure Notes

- `backend/models.py` : ajouter `Asset` après `GraphEdge` (fin de fichier)
- `backend/schemas.py` : ajouter section `# ── Asset ──` après `# ── AssetRef ──`, avant `# ── Character ──`
- `frontend/types/index.ts` : ajouter `export interface Asset` après `export interface AssetRef`
- `backend/main.py` : ajouter les deux blocs migrations APRÈS le bloc `source_handle` existant (ligne ~40), AVANT `Path("uploads").mkdir(...)`

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — section "Patterns d'implémentation", sous-section "Format Patterns" (schéma `Asset`)
- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.1 (AC complets)
- Code existant migration pattern: `backend/main.py` lignes 16-40
- Code existant endpoint upload: `backend/routers/assets.py`
- Code existant AssetRef: `frontend/types/index.ts` lignes 6-14

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Modèle SQLAlchemy `Asset` ajouté dans `models.py` avec 6 colonnes (`id`, `filename`, `url`, `content_type`, `folder` default `backgrounds`, `is_seed` default `False`).
- Deux migrations safe `try/except ALTER TABLE assets ADD COLUMN` ajoutées dans `main.py` (après le bloc `source_handle`, avant `Path("uploads").mkdir`).
- Schéma Pydantic `Asset` ajouté dans `schemas.py` avec `from_attributes = True`.
- Interface TypeScript `Asset` ajoutée dans `frontend/types/index.ts` après `AssetRef` (inchangé).
- 4 nouveaux tests ajoutés dans `test_assets.py` : schéma Pydantic, colonnes modèle, création DB + PRAGMA, defaults. 89/89 tests passent (Python 3.12).

### File List

- `backend/models.py` — ajout classe `Asset`
- `backend/main.py` — ajout 2 migrations `ALTER TABLE assets ADD COLUMN`
- `backend/schemas.py` — ajout classe `Asset`
- `frontend/types/index.ts` — ajout interface `Asset`
- `backend/tests/test_assets.py` — ajout 4 tests (import + unused `pytest`)
- `_bmad-output/implementation-artifacts/1-1-migration-modele-asset.md` — story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut mis à jour
