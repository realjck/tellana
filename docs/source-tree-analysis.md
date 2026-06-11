# Analyse de l'arborescence source — Tellana

> Généré le 2026-06-11 · Scan : quick

---

## Structure globale

```
tellana/                          # Racine du projet
├── backend/                      # API FastAPI (port 8000)
│   ├── main.py                   # Point d'entrée, migrations au démarrage
│   ├── models.py                 # Modèles SQLAlchemy (Story, Scene, Node, Character, Asset)
│   ├── schemas.py                # Schémas Pydantic (request/response)
│   ├── database.py               # Connexion SQLite, get_db() dependency
│   ├── routers/                  # Routeurs FastAPI par entité
│   │   ├── stories.py            # CRUD stories + publish/unpublish/export-zip
│   │   ├── scenes.py             # CRUD scènes + reorder
│   │   ├── nodes.py              # CRUD nœuds + reorder
│   │   ├── characters.py         # CRUD personnages
│   │   └── assets.py             # Upload et liste des assets
│   ├── tests/                    # Tests pytest (60 tests)
│   │   ├── conftest.py           # Fixtures SQLite in-memory
│   │   ├── test_stories.py
│   │   ├── test_scenes.py
│   │   ├── test_nodes.py
│   │   ├── test_characters.py
│   │   ├── test_assets.py
│   │   ├── test_export_json.py
│   │   └── test_export_zip.py
│   ├── uploads/                  # Fichiers uploadés (images, sprites)
│   ├── published/                # Stories publiées (servi via StaticFiles)
│   ├── requirements.txt          # Dépendances Python
│   └── tellana.db                # Base de données SQLite
│
├── frontend/                     # Application Next.js (port 3000)
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Layout racine (police Space Grotesk)
│   │   ├── page.tsx              # Page d'accueil (liste des stories)
│   │   ├── globals.css           # Tokens CSS (@theme Tailwind v4)
│   │   ├── stories/[id]/         # Pages de la story
│   │   │   ├── page.tsx          # Vue story + gestion scènes/personnages
│   │   │   ├── edit/             # Éditeur de scène (page.tsx)
│   │   │   ├── play/             # Lecteur interne (page.tsx)
│   │   │   └── scenes/[sceneId]/edit/ # Éditeur scène alternative
│   │   ├── s/[slug]/             # Pages publiques (SSR)
│   │   │   ├── page.tsx          # Page publique story
│   │   │   └── PublicPlayer.tsx  # Player en mode public
│   │   └── styles/
│   │       └── player.css        # Variables CSS isolées du player
│   │
│   ├── components/               # Composants réutilisables
│   │   ├── ScenePlayer.tsx       # Player principal 1920×1080 scalé
│   │   ├── MultiScenePlayer.tsx  # Enchaînement de ScenePlayer
│   │   ├── ScenePreviewThumbnail.tsx  # Aperçu statique de scène
│   │   ├── SceneCharacterEditorOverlay.tsx # Overlay drag/resize personnages
│   │   ├── SceneCharacterSelector.tsx # Sidebar sélection personnages
│   │   ├── CharacterManager.tsx  # Gestionnaire personnages (modes list/add/edit/poses)
│   │   ├── CharacterBasicForm.tsx # Formulaire personnage + color picker
│   │   ├── CharacterPosesManager.tsx # Gestion des poses/sprites
│   │   ├── CharacterPosesDrawer.tsx  # Preview sprites (z-30)
│   │   ├── NodeForm.tsx          # Formulaire édition de nœud (auto-save 1s)
│   │   ├── ConfirmModal.tsx      # Modal de confirmation
│   │   └── AlertModal.tsx        # Modal d'alerte
│   │
│   ├── lib/
│   │   ├── api.ts                # Fonctions fetch, types TS, resolveAsset(), RAINBOW_COLORS
│   │   └── scenePositions.ts     # DEFAULT_POSITIONS[], FALLBACK_POSITION
│   │
│   ├── types/
│   │   └── index.ts              # Types TypeScript globaux
│   │
│   ├── player-entry.tsx          # Entrypoint Vite standalone (ScenePlayer isolé)
│   ├── vite.player.config.ts     # Config Vite IIFE → player-dist/
│   ├── player-dist/              # Bundle compilé (player-bundle.js, player-bundle.css)
│   │
│   ├── __tests__/                # Tests Jest (39 tests)
│   │   ├── ScenePlayer.test.tsx
│   │   ├── ScenePreviewThumbnail.test.tsx
│   │   ├── NodeForm.test.tsx
│   │   └── CharacterManager.test.tsx
│   ├── e2e/                      # Tests Playwright
│   ├── public/                   # Assets statiques Next.js
│   └── package.json
│
├── docs/                         # Documentation projet (knowledge base)
│   └── superpowers/specs/        # Specs de design (Media Creator, etc.)
├── _bmad-output/                 # Artefacts BMAD (PRDs, plans)
├── assets/                       # Assets projet globaux
├── README.md
└── CLAUDE.md                     # Instructions Claude Code
```

---

## Points d'entrée critiques

| Rôle | Fichier |
|------|---------|
| API backend | `backend/main.py` |
| App frontend | `frontend/app/layout.tsx` + `frontend/app/page.tsx` |
| Player standalone | `frontend/player-entry.tsx` |
| Connexion DB | `backend/database.py` |
| Types TypeScript | `frontend/types/index.ts` + `frontend/lib/api.ts` |
| Tokens CSS | `frontend/app/globals.css` |
| Positions personnages | `frontend/lib/scenePositions.ts` |

---

## Répertoires d'intégration

- `backend/uploads/` ↔ `NEXT_PUBLIC_API_URL/uploads/` — assets servis par FastAPI
- `backend/published/` ↔ `/published/{slug}/` — stories publiées StaticFiles
- `frontend/player-dist/` → lu par `backend/routers/stories.py` pour le packaging ZIP
