# Guide de développement — Tellana

> Généré le 2026-06-11

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Installation

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Démarrage en développement

Les deux serveurs doivent tourner simultanément.

```bash
# Terminal 1 — Backend (port 8000)
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

- API : `http://localhost:8000`
- Swagger UI : `http://localhost:8000/docs`
- App : `http://localhost:3000`

---

## Variables d'environnement

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Créer ce fichier si le backend n'est pas sur `localhost:8000`.

---

## Tests

### Backend (pytest)

```bash
cd backend
python -m pytest
python -m pytest -v        # avec détails
```

- 60 tests au total
- Fixture `client` dans `tests/conftest.py` : SQLite in-memory + `StaticPool`
- Uploads redirigés via `monkeypatch` vers `tmp_path`
- Pour les tests export-zip/publish : monkeypatcher aussi `_PLAYER_DIST_DIR` et `_PUBLISHED_DIR` dans `routers.stories`

### Frontend — Tests unitaires (Jest)

```bash
cd frontend
npm test
npm run test:watch          # mode watch
```

- 39 tests (Jest + React Testing Library)
- Config dans `jest.config.ts` avec `next/jest.js`
- `jest.setup.ts` : mock `ResizeObserver` (requis pour ScenePlayer)
- Mock `@/lib/api` dans chaque fichier de test (inclure `randomCharacterColor: () => "#FF6B6B"`)

### Frontend — Tests E2E (Playwright)

```bash
# Backend doit tourner sur :8000
cd frontend
npm run test:e2e
```

- Playwright lance `npm run dev` automatiquement
- Tests dans `e2e/`

---

## Build

### Player standalone

```bash
cd frontend
npm run build:player
```

Génère `frontend/player-dist/` (`player-bundle.js`, `player-bundle.css`, `custom.css`) via Vite IIFE.  
**Requis avant export ZIP ou publication.**

### Application Next.js

```bash
cd frontend
npm run build
npm run start
```

---

## Conventions de code

### Frontend

- Composants `"use client"` pour tout composant interactif
- Fetch via SWR + `mutate()` ; utiliser le retour de `await mutate()` plutôt que les closures
- `resolveAsset(ref)` depuis `@/lib/api` pour les URLs d'assets (ne jamais utiliser `ref.url` directement)
- Types `NodeData` : double cast `as unknown as TargetType`
- Pas de `<button>` imbriqués → utiliser `<div role="button" tabIndex={0}>`
- CSS : tokens sémantiques Tailwind v4 (`bg-bg`, `bg-surface`, `text-fore`, etc.)

### Backend

- `exclude_unset=True` sur tous les PATCH
- Migrations safe : `try/except` sur `ALTER TABLE ADD COLUMN`
- `_touch_story(story_id, db)` à appeler avant chaque `db.commit()` dans scenes, nodes, characters
- Slug : `unicodedata.normalize("NFKD")` + encode ASCII

---

## Flux de publication

1. `npm run build:player` → génère `frontend/player-dist/`
2. Clic "Publier" dans l'UI → `POST /api/stories/{id}/publish`
3. Le backend génère le ZIP, extrait dans `backend/published/{slug}/`
4. Story accessible sur `http://localhost:8000/published/{slug}/index.html`
