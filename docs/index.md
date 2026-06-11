# Index de documentation — Tellana

> Généré le 2026-06-11 · Scan : quick · Mode : initial_scan

---

## Vue d'ensemble du projet

- **Type :** Multi-part (backend + frontend)
- **Langage principal :** Python (backend) / TypeScript (frontend)
- **Architecture :** Resource-based API (FastAPI) + App Router Next.js

---

## Référence rapide

### Backend (`backend/`)
- **Type :** `backend` — FastAPI 0.115 + SQLAlchemy 2.0 + SQLite
- **Entrée :** `backend/main.py`
- **Port :** 8000

### Frontend (`frontend/`)
- **Type :** `web` — Next.js 16.2 + React 19 + Tailwind v4 + SWR
- **Entrée :** `frontend/app/layout.tsx`
- **Port :** 3000

---

## Documentation générée

### Vue globale
- [Vue d'ensemble du projet](./project-overview.md)
- [Arborescence source annotée](./source-tree-analysis.md)
- [Architecture d'intégration](./integration-architecture.md)

### Backend
- [Architecture Backend](./architecture-backend.md)
- [Modèles de données](./data-models-backend.md)
- [Contrats API](./api-contracts-backend.md)

### Frontend
- [Architecture Frontend](./architecture-frontend.md)
- [Inventaire des composants](./component-inventory-frontend.md)

### Guides
- [Guide de développement](./development-guide.md)

---

## Documentation existante

- [README.md](../README.md) — Installation et démarrage rapide
- [CLAUDE.md](../CLAUDE.md) — Conventions et points d'attention Claude Code
- [Spec Media Creator Integration](./superpowers/specs/2026-04-07-media-creator-integration-design.md)
- [Spec Story/Scene Refactor](./superpowers/specs/2026-04-07-story-scene-refactor-design.md)
- [Spec TEL-15 Preview uniforme](./superpowers/specs/2026-04-10-tel15-preview-uniforme-vignettes-design.md)

---

## Démarrage rapide

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000

# Frontend
cd frontend && npm install
npm run dev                  # http://localhost:3000

# Player standalone (requis pour export/publication)
cd frontend && npm run build:player
```

---

## Utilisation avec les workflows BMAD

Quand tu crées un PRD brownfield pour une nouvelle feature, fournis ce fichier comme contexte d'entrée.

- Feature frontend uniquement → référencer `architecture-frontend.md`
- Feature backend uniquement → référencer `architecture-backend.md`
- Feature fullstack → référencer les deux architectures + `integration-architecture.md`
