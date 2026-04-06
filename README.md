# Tellana

Plateforme de création et partage de stories au format **Visual Novel** — dialogues, textes narratifs, quiz interactifs, personnages et décors.

---

## Architecture

```
tellana/
├── backend/      FastAPI + SQLAlchemy (SQLite)
└── frontend/     Next.js 16 (App Router) + Tailwind CSS
```

| Composant | Technologie | Port |
|-----------|-------------|------|
| Backend API | FastAPI + Uvicorn | `8000` |
| Frontend | Next.js | `3000` |

---

## Prérequis

- **Python** 3.10+
- **Node.js** 18+

---

## Installation & démarrage

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API disponible sur `http://localhost:8000`  
Documentation Swagger : `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Application disponible sur `http://localhost:3000`

---

## Fonctionnalités

### Éditeur (`/stories/[id]/edit`)

- **Onglet Nœuds** — création et réordonnancement de nœuds (dialogue, texte narratif, quiz QCU/QCM), aperçu en temps réel synchronisé avec la liste
- **Onglet Perso.** — ajout/édition/suppression de personnages (max 4), sprites par défaut ou uploadés
- **Onglet Décor** — sélection ou upload d'un décor de fond

### Lecteur Visual Novel (`ScenePlayer`)

- Avance au clic ou touches `Espace` / `Entrée` / `→`
- Personnage actif mis en évidence (contour blanc SVG)
- Positionnement adaptatif : 1 perso centré, 2 persos rapprochés, 3+ en grille
- Écran de fin avec bouton **Recommencer**
- Mode plein écran

### Types de nœuds

| Type | Description |
|------|-------------|
| **Dialogue** | Un personnage parle — boîte de dialogue en bas |
| **Texte narratif** | Écran sombre, texte centré, personnage optionnel à gauche |
| **Quiz QCU/QCM** | Question + réponses + feedback affiché après validation |

### Publication

- Bouton **Publier** dans l'éditeur → génère un slug unique partageable
- Page publique : `/s/[slug]` (accessible sans authentification)

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard — liste des stories |
| `/stories/[id]/edit` | Éditeur |
| `/stories/[id]/play` | Prévisualisation plein écran |
| `/s/[slug]` | Page publique partageable |

---

## API REST

Base URL : `http://localhost:8000/api`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/stories/` | Liste des stories |
| `POST` | `/stories/` | Créer une story |
| `GET` | `/stories/{id}` | Détail (avec nœuds et personnages) |
| `PATCH` | `/stories/{id}` | Modifier (titre, décor, publication) |
| `DELETE` | `/stories/{id}` | Supprimer |
| `GET` | `/stories/by-slug/{slug}` | Accès public (published only) |
| `POST` | `/stories/{id}/nodes/` | Créer un nœud |
| `PATCH` | `/stories/{id}/nodes/{nid}` | Modifier un nœud |
| `DELETE` | `/stories/{id}/nodes/{nid}` | Supprimer un nœud |
| `POST` | `/stories/{id}/nodes/reorder` | Réordonner `{"order": [id1, id2, ...]}` |
| `POST` | `/stories/{id}/characters/` | Créer un personnage |
| `PATCH` | `/stories/{id}/characters/{cid}` | Modifier un personnage |
| `DELETE` | `/stories/{id}/characters/{cid}` | Supprimer un personnage |
| `POST` | `/assets/upload` | Upload image (max 10 Mo, images uniquement) |

---

## Tests

### Backend (pytest)

```bash
cd backend
python -m pytest
# ou avec détails :
python -m pytest -v
```

28 tests couvrant : stories CRUD, slugs, publication, nœuds, reorder, personnages, upload assets.  
Fixture SQLite in-memory avec `StaticPool` — isolation totale par test.

### Frontend — Tests unitaires (Jest + React Testing Library)

```bash
cd frontend
npm test
# mode watch :
npm run test:watch
```

28 tests couvrant : `ScenePlayer`, `NodeForm`, `CharacterManager`.

### Frontend — Tests E2E (Playwright)

Le backend doit tourner sur `:8000`. Playwright lance le frontend automatiquement.

```bash
cd frontend
npm run test:e2e
```

---

## Variables d'environnement

### Frontend

Créer `frontend/.env.local` si le backend n'est pas sur `localhost:8000` :

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Structure des fichiers clés

```
backend/
├── main.py              Point d'entrée FastAPI, CORS, routes
├── models.py            Modèles SQLAlchemy (Story, Node, Character)
├── schemas.py           Schémas Pydantic (validation stricte Literal)
├── database.py          Engine SQLite, SessionLocal, get_db
├── routers/
│   ├── stories.py       CRUD stories + slug + publication
│   ├── nodes.py         CRUD nœuds + reorder
│   ├── characters.py    CRUD personnages
│   └── assets.py        Upload images
└── tests/               pytest (28 tests)

frontend/
├── app/
│   ├── page.tsx                    Dashboard
│   ├── stories/[id]/edit/page.tsx  Éditeur principal
│   ├── stories/[id]/play/page.tsx  Lecteur preview
│   └── s/[slug]/page.tsx           Page publique (SSR)
├── components/
│   ├── ScenePlayer.tsx   Moteur de rendu Visual Novel
│   ├── NodeForm.tsx      Formulaire d'édition de nœud
│   └── CharacterManager.tsx  Gestion personnages (list/edit/add)
├── lib/api.ts            Client HTTP, resolveImage, DEFAULT_SPRITES/BACKGROUNDS
├── types/index.ts        Types TypeScript partagés
├── __tests__/            Jest tests (28 tests)
└── e2e/                  Playwright tests
```
