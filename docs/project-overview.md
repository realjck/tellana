# Vue d'ensemble du projet — Tellana

> Généré le 2026-06-11

---

## Description

**Tellana** est une plateforme de création et partage de stories au format **Visual Novel**. L'éditeur permet de composer des histoires interactives (dialogues, textes narratifs, quiz), de placer et animer des personnages sur des décors, et de publier le résultat sous forme de page web standalone.

---

## Architecture

**Type :** Multi-part (backend API + frontend web)

| Composant | Technologie | Port |
|-----------|------------|------|
| Backend API | FastAPI 0.115 + SQLAlchemy 2.0 + SQLite | 8000 |
| Frontend | Next.js 16.2 + React 19 + Tailwind CSS v4 | 3000 |
| Player standalone | Vite IIFE bundle | (statique) |

---

## Stack résumée

```
Backend  : Python 3.10+ · FastAPI · SQLAlchemy · SQLite · Uvicorn
Frontend : TypeScript · Next.js 16 App Router · React 19 · Tailwind v4 · SWR
Tests    : pytest (60) · Jest/RTL (39) · Playwright (E2E)
Build    : npm (Next.js) · Vite (player standalone)
```

---

## Fonctionnalités principales

- Création et gestion de stories multi-scènes
- Éditeur de scène : script (dialogues, textes, quiz), fond, personnages
- Éditeur graphique de positionnement des personnages (drag/resize/miroir)
- Gestion des personnages avec poses (sprites multiples) et couleur de nom
- Player 1920×1080 scalé, embarquable dans l'éditeur et en page publique
- Export ZIP standalone et publication statique servie par FastAPI
- Prévisualisation temps réel pendant l'édition (patch live)

---

## Liens vers la documentation

- [Architecture Backend](./architecture-backend.md)
- [Architecture Frontend](./architecture-frontend.md)
- [Intégration inter-parties](./integration-architecture.md)
- [Arborescence source](./source-tree-analysis.md)
- [Composants Frontend](./component-inventory-frontend.md)
- [Modèles de données](./data-models-backend.md)
- [Contrats API](./api-contracts-backend.md)
- [Guide de développement](./development-guide.md)

---

## Intégration prévue

**Media Creator** (projet compagnon) : génération/édition d'images et vidéos par IA.  
Phase 1 : import d'assets. Spec : `docs/superpowers/specs/2026-04-07-media-creator-integration-design.md`.

Types de nœuds futurs prévus : `"image"`, `"video"`, `"image_text"`.
