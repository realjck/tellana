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

## Tests

### Backend (pytest)

```bash
cd backend
python -m pytest
# ou avec détails :
python -m pytest -v
```


### Frontend — Tests unitaires (Jest + React Testing Library)

```bash
cd frontend
npm test
# mode watch :
npm run test:watch
```

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
