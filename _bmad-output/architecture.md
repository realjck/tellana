# Architecture — Tellana

> Généré le 2026-06-11 · Scan quick · Initial scan

---

## Vue d'ensemble

**Tellana** est une plateforme de création Visual Novel : éditeur de stories composées de scènes (dialogues, textes, quiz) avec personnages positionnés graphiquement et décors. Le projet est structuré en **deux parties distinctes** communicant via REST.

```
┌─────────────────────────────┐    REST/JSON    ┌──────────────────────────────┐
│   Frontend — Next.js :3000  │ ─────────────► │   Backend — FastAPI :8000    │
│   App Router + React 19     │                 │   SQLAlchemy + SQLite         │
│   Tailwind v4 + SWR         │ ◄─ /uploads/*  │   /api/* + /published/*      │
│   Vite player bundle        │ ◄─ /published/* │   StaticFiles                │
└─────────────────────────────┘                 └──────────────────────────────┘
```

---

## 1. Stack technologique

### Backend

| Catégorie | Technologie | Version |
|-----------|------------|---------|
| Framework web | FastAPI | 0.115 |
| Serveur ASGI | Uvicorn | 0.30.6 |
| ORM | SQLAlchemy | 2.0 |
| Validation | Pydantic | 2.9.2 |
| Base de données | SQLite | — |
| Fichiers async | aiofiles | 24.1.0 |
| Tests | pytest + httpx | ≥8.0 |
| Langage | Python | 3.10+ |

### Frontend

| Catégorie | Technologie | Version |
|-----------|------------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Langage | TypeScript | 5 |
| Styling | Tailwind CSS | v4 |
| Data fetching | SWR | 2.4.1 |
| Player bundle | Vite (IIFE) | 8.0.9 |
| Tests unitaires | Jest + React Testing Library | 30 |
| Tests E2E | Playwright | 1.59 |

---

## 2. Modèles de données

### Hiérarchie

```
Story ──< Scene ──< Node
  │
  └──< Character
```

### Entités principales

**Story** : `id`, `title`, `slug` (unique, translittéré), `published` (bool), `published_at` (DateTime?), `updated_at` (DateTime)

**Scene** : `id`, `story_id` (FK), `title`, `order`, `background` (AssetRef?), `character_ids` (list[int], max 4, ordonnés = index Z), `character_positions` (dict[str, CharacterPosition])

**Node** : `id`, `scene_id` (FK), `type` (Literal["dialogue","text","quiz"]), `order`, `data` (JSON)

- `dialogue` → `{ character_id: int|null, text: str }`
- `text` → `{ content: str }` (Markdown)
- `quiz` → `{ question: str, options: list[str], correct_index: int }`

**Character** : `id`, `story_id` (FK), `name`, `color` (str hex?, ex. `#FF6B6B`), `sprites` (dict[str, AssetRef])

**CharacterPosition** : `{ x: float[-1,1], y: float[-3,1], scale: float[0.1,2.5], flip_x: bool }`

### Migrations

Pattern safe au démarrage dans `main.py` : `create_all()` + `try/except ALTER TABLE ADD COLUMN` pour les colonnes ajoutées progressivement.

---

## 3. Architecture backend

### Pattern : Routeur par ressource

```
backend/
├── main.py              # Montage routeurs + StaticFiles + migrations
├── models.py            # Modèles SQLAlchemy
├── schemas.py           # Schémas Pydantic (request/response)
├── database.py          # Connexion SQLite, get_db() dependency
└── routers/
    ├── stories.py       # CRUD + publish/unpublish/export-zip
    ├── scenes.py        # CRUD + reorder
    ├── nodes.py         # CRUD + reorder
    ├── characters.py    # CRUD
    └── assets.py        # Upload + liste
```

### Endpoints clés

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/stories` | Liste stories (avec `first_scene_character_ids`, `characters`) |
| PATCH | `/api/stories/{id}` | Mise à jour partielle (`exclude_unset=True`) |
| GET | `/api/stories/{id}/export-zip` | Génère ZIP standalone |
| POST | `/api/stories/{id}/publish` | Publie → `published/{slug}/` |
| POST | `/api/stories/{id}/unpublish` | Dépublie → supprime le dossier |
| PATCH | `/api/scenes/{id}` | Fond, character_ids, character_positions |
| PATCH | `/api/nodes/{id}` | Contenu `data` |
| POST | `/api/assets/upload` | Upload multipart |

### Conventions backend

- `exclude_unset=True` sur tous les PATCH
- `_touch_story(story_id, db)` avant chaque `db.commit()` (scenes, nodes, characters)
- Reorder : valide tous les IDs avant commit (HTTP 400 si inconnu)
- Suppression personnage : nettoie `character_ids` et `character_positions` dans toutes les scènes

---

## 4. Architecture frontend

### Structure App Router

```
frontend/app/
├── page.tsx                        # Accueil — liste stories
├── layout.tsx                      # Layout racine (Space Grotesk)
├── globals.css                     # Tokens @theme Tailwind v4
├── stories/[id]/
│   ├── page.tsx                    # Vue story (scènes + personnages)
│   ├── edit/page.tsx               # Éditeur de scène
│   └── play/page.tsx               # Lecteur interne
└── s/[slug]/
    ├── page.tsx                    # Page publique (SSR)
    └── PublicPlayer.tsx            # Player public
```

**Attention Next.js 16** : `params` est une `Promise`.
- Server component : `const { id } = await params`
- Client component : `const { id } = use(params)`

### Gestion de l'état

- Pas de store global — état local (useState/useRef) + SWR
- SWR + `mutate()` pour le cache serveur ; utiliser `await mutate()` pour la donnée fraîche

### Player ScenePlayer — Rendu 1920×1080

```
containerRef (outer div, aspect-ratio 16/9)
  └── inner div (1920×1080 px)
      transform: scale(containerWidth / 1920)   ← useLayoutEffect + ResizeObserver
      ├── background image
      ├── character sprites
      │   bottom: calc(-10% + y*50%)
      │   left: ((x+1)/2)*100%
      │   transform: translateX(-50%) scale(s) scaleX(flip)
      └── dialogue/text/quiz overlay
```

### Composants principaux

| Composant | Rôle |
|-----------|------|
| `ScenePlayer` | Player principal (1920×1080 scalé, tous types de nœuds) |
| `MultiScenePlayer` | Enchaîne plusieurs ScenePlayer |
| `ScenePreviewThumbnail` | Aperçu statique (sans interaction) |
| `SceneCharacterEditorOverlay` | Overlay drag/resize/miroir personnages |
| `SceneCharacterSelector` | Sidebar sélection + réordonnement Z personnages |
| `CharacterManager` | Gestion complète personnages (modes list/add/edit/poses) |
| `NodeForm` | Édition nœud avec auto-save 1s |
| `ConfirmModal` / `AlertModal` | Modales UI |

### Design system — Tailwind v4

Tokens dans `globals.css` via `@theme` :

| Token | Usage |
|-------|-------|
| `bg-bg` / `bg-surface` / `bg-sidebar` | Fonds (du + sombre au + clair) |
| `bg-elevated` / `bg-raised` | Surfaces surélevées |
| `text-fore` / `text-muted` / `text-subtle` | Hiérarchie typographique |
| `bg-primary` / `bg-primary-hover` | Boutons d'action |

Styles player isolés dans `app/styles/player.css`.

---

## 5. Intégration entre parties

### Points d'intégration

| # | Depuis | Vers | Type | Détail |
|---|--------|------|------|--------|
| 1 | Frontend (`lib/api.ts`) | Backend `/api/*` | REST/JSON | Toutes les opérations CRUD |
| 2 | Frontend (`resolveAsset()`) | Backend `/uploads/*` | StaticFiles | Assets (images, sprites) |
| 3 | Backend (`routers/stories.py`) | `frontend/player-dist/` | Lecture fichier | Packaging ZIP export |
| 4 | Backend | `backend/published/{slug}/` | StaticFiles | Stories publiées |
| 5 | Frontend SSR (`s/[slug]`) | Backend `/api/stories/{slug}` | REST | Fetch page publique |

**Variable d'environnement :** `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Flux de publication

```
1. npm run build:player  →  frontend/player-dist/
2. POST /api/stories/{id}/publish
   └── lit player-dist/ + sérialise story JSON + copie assets
   └── génère ZIP → extrait dans backend/published/{slug}/
   └── story.published = True, published_at = now()
3. GET /published/{slug}/index.html  →  player-bundle.js charge story.json
```

---

## 6. Tests

| Partie | Framework | Nb tests | Commande |
|--------|-----------|---------|----------|
| Backend | pytest + httpx | 60 | `cd backend && python -m pytest` |
| Frontend unitaire | Jest + RTL | 39 | `cd frontend && npm test` |
| Frontend E2E | Playwright | variable | `cd frontend && npm run test:e2e` |

**Fixtures backend :** SQLite in-memory + `StaticPool` + override `get_db`.  
**Setup frontend :** mock `ResizeObserver` dans `jest.setup.ts` ; mock `@/lib/api` dans chaque test.

---

## 7. Limitations connues (prototype)

- Pas d'authentification — éditeur accessible sans login
- SQLite — pas adapté à la production multi-utilisateurs
- `content_type` de l'upload vient du client (pas de validation magic bytes)
- Pas de timeout sur les opérations de génération ZIP

---

## 8. Évolutions prévues

- **Media Creator** (projet compagnon) : intégration import d'assets IA (Phase 1)
- Types de nœuds futurs : `"image"`, `"video"`, `"image_text"`
- Spec détaillée : `docs/superpowers/specs/2026-04-07-media-creator-integration-design.md`
