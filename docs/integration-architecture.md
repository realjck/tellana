# Architecture d'intégration — Tellana

> Généré le 2026-06-11 · Scan : quick

---

## Vue d'ensemble

```
┌─────────────────────────────┐          ┌──────────────────────────────┐
│   Frontend (Next.js :3000)  │          │   Backend (FastAPI :8000)    │
│                             │          │                              │
│  App Router (SSR + client)  │ ──REST── │  /api/*  (FastAPI routers)  │
│  SWR (data fetching)        │          │  /uploads/* (StaticFiles)   │
│  ScenePlayer (1920×1080)    │          │  /published/* (StaticFiles) │
│  Vite Player Bundle         │          │  SQLite (tellana.db)        │
└─────────────────────────────┘          └──────────────────────────────┘
          │                                          │
          │ NEXT_PUBLIC_API_URL=http://localhost:8000 │
          └──────────────────────────────────────────┘
```

---

## Points d'intégration

### 1. API REST frontend → backend

- **Type :** REST/JSON (HTTP)
- **Depuis :** `frontend/lib/api.ts` (toutes les fonctions fetch)
- **Vers :** `backend/routers/*.py`
- **Variable :** `NEXT_PUBLIC_API_URL` (défaut `http://localhost:8000`)
- **Format :** JSON pour les corps de requête, `multipart/form-data` pour les uploads

### 2. Assets statiques

- **Depuis :** Frontend (via `resolveAsset(ref)` dans `lib/api.ts`)
- **Vers :** `GET /uploads/{filename}` (FastAPI StaticFiles)
- **Chemin physique :** `backend/uploads/`

### 3. Player bundle → packaging ZIP

- **Depuis :** `frontend/player-dist/` (compilé par `npm run build:player`)
- **Vers :** `backend/routers/stories.py` (lit `_PLAYER_DIST_DIR` pour assembler le ZIP)
- **Déclencheur :** `GET /api/stories/{id}/export-zip` ou `POST /api/stories/{id}/publish`

### 4. Stories publiées

- **Depuis :** `POST /api/stories/{id}/publish` (backend extrait le ZIP)
- **Servi sur :** `/published/{slug}/` (FastAPI StaticFiles `html=True`)
- **Chemin physique :** `backend/published/{slug}/`
- **URL finale :** `http://localhost:8000/published/{slug}/index.html`

### 5. Page publique SSR

- **Depuis :** `frontend/app/s/[slug]/page.tsx` (SSR Next.js)
- **Vers :** `GET /api/stories/{slug}` (fetch serveur)
- **Rendu :** `PublicPlayer.tsx` monte `MultiScenePlayer`

---

## Flux de données principaux

### Édition d'une story

```
Navigateur
  → GET /api/stories/{id}          (chargement initial via SWR)
  → PATCH /api/stories/{id}        (modification titre)
  → POST /api/stories/{id}/scenes  (ajout scène)
  → PATCH /api/scenes/{id}         (modifier fond, personnages)
  → POST /api/scenes/{id}/nodes    (ajout nœud)
  → PATCH /api/nodes/{id}          (auto-save 1s)
```

### Publication

```
1. npm run build:player
   → frontend/player-dist/ (player-bundle.js, player-bundle.css, custom.css)

2. POST /api/stories/{id}/publish
   → lit frontend/player-dist/
   → construit story.json (toutes scènes + nœuds + personnages)
   → assemble ZIP (index.html + assets/ + data/)
   → extrait dans backend/published/{slug}/
   → story.published = True, story.published_at = now()

3. GET /published/{slug}/index.html (StaticFiles)
   → player-bundle.js charge data/story.json
   → ScenePlayer démarre
```

---

## Pas d'authentification (prototype)

Aucun middleware d'auth. L'éditeur est accessible sans login. Toutes les routes API sont publiques.
