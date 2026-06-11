# Architecture — Backend Tellana

> Généré le 2026-06-11 · Scan : quick

---

## Résumé exécutif

API REST FastAPI pour la plateforme Visual Novel Tellana. Gère la persistance des stories, scènes, nœuds, personnages et assets. Génère des exports ZIP et publie des versions standalone statiques.

---

## Stack technologique

| Catégorie | Technologie | Version |
|-----------|------------|---------|
| Framework web | FastAPI | 0.115 |
| Serveur ASGI | Uvicorn | 0.30.6 |
| ORM | SQLAlchemy | 2.0 |
| Validation | Pydantic | 2.9.2 |
| Base de données | SQLite | — |
| Fichiers async | aiofiles | 24.1.0 |
| Upload multipart | python-multipart | 0.0.12 |
| Tests | pytest + httpx | 8.0 / 0.27 |
| Langage | Python | 3.10+ |

---

## Pattern d'architecture

**Routeur par ressource (Resource-based Routing)**

Chaque entité métier dispose de son propre routeur FastAPI. La logique business est directement dans les routeurs (pas de couche service séparée — projet prototype).

```
main.py                    → montage des routeurs + StaticFiles + migrations
├── routers/stories.py     → CRUD Story + publish/unpublish/export-zip
├── routers/scenes.py      → CRUD Scene + reorder
├── routers/nodes.py       → CRUD Node + reorder
├── routers/characters.py  → CRUD Character
└── routers/assets.py      → upload + liste assets
```

---

## Modèles de données

Voir [data-models-backend.md](./data-models-backend.md) pour le détail complet.

Hiérarchie : `Story → Scene → Node` / `Story → Character`

---

## API Design

Voir [api-contracts-backend.md](./api-contracts-backend.md) pour tous les endpoints.

Conventions :
- Préfixe `/api/`
- PATCH avec `exclude_unset=True` (mise à jour partielle)
- Reorder : valide tous les IDs avant commit
- `_touch_story()` helper appelé avant chaque `db.commit()` dans scenes/nodes/characters

---

## Architecture de persistance

```
SQLite (tellana.db)
  ├── Table stories     (id, title, slug, published, published_at, updated_at)
  ├── Table scenes      (id, story_id, title, order, background_json, character_ids_json, character_positions_json)
  ├── Table nodes       (id, scene_id, type, order, data_json)
  ├── Table characters  (id, story_id, name, color, sprites_json)
  └── Table assets      (id, filename, content_type, created_at)
```

Migrations : `main.py` utilise `create_all()` pour les DB fraîches + `try/except ALTER TABLE` pour les DB existantes.

---

## Système de fichiers

```
backend/
├── uploads/           # Assets uploadés (images, sprites de personnages)
└── published/         # Stories publiées (un dossier par story)
    └── {slug}/
        ├── index.html
        ├── assets/
        │   ├── js/player-bundle.js
        │   ├── css/player.css
        │   ├── images/
        │   └── data/story.json
```

---

## Export standalone

1. Lecture de `frontend/player-dist/` (bundle Vite pré-compilé)
2. Sérialisation JSON complète de la story
3. Copie des assets depuis `uploads/` vers `assets/images/`
4. Réécriture des URLs `/uploads/` → `assets/images/`
5. Génération de `index.html` qui charge le bundle
6. Packaging ZIP ou extraction directe dans `published/{slug}/`

---

## Tests

```
backend/tests/
├── conftest.py          # SQLite in-memory + StaticPool + override get_db
├── test_stories.py
├── test_scenes.py
├── test_nodes.py
├── test_characters.py
├── test_assets.py
├── test_export_json.py
└── test_export_zip.py   # monkeypatche _PLAYER_DIST_DIR et _PUBLISHED_DIR
```

60 tests. Lancer depuis `backend/` : `python -m pytest`.

---

## Limitations (prototype)

- Pas d'authentification — toutes les routes sont publiques
- SQLite — pas adapté à la production multi-utilisateurs
- `content_type` de l'upload vient du client (pas de validation magic bytes)
- Pas de timeout sur les opérations de génération ZIP
