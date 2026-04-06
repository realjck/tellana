# CLAUDE.md — Tellana

Instructions et contexte pour Claude Code sur ce projet.

## Projet

Plateforme Visual Novel : éditeur de stories (dialogues, textes, quiz) avec personnages et décors. Backend FastAPI + SQLite, frontend Next.js 16 App Router.

## Structure

```
backend/    FastAPI (port 8000)
frontend/   Next.js (port 3000)
```

## Commandes essentielles

```bash
# Backend
cd backend && uvicorn main:app --reload
cd backend && python -m pytest

# Frontend
cd frontend && npm run dev
cd frontend && npm test
cd frontend && npm run test:e2e   # nécessite backend sur :8000
```

## Points d'attention Next.js 16

- Les `params` sont des `Promise` dans les server components et les client components.  
  Server component : `const { id } = await params`  
  Client component : `const { id } = use(params)`
- Le type `PageProps` est disponible globalement via `next-env.d.ts`.
- `next/jest.js` est le transformer Jest à utiliser (pas babel-jest directement).

## Conventions de code

### Frontend
- Composants `"use client"` — tous les composants interactifs.
- Fetch de données via **SWR** avec `mutate()` pour les rechargements. `await mutate()` retourne la donnée fraîche — utiliser son retour plutôt que les closures périmées.
- Résolution d'URL d'images : toujours utiliser `resolveImage()` importé depuis `@/lib/api` (gère `/uploads/` → URL complète backend).
- Types `NodeData` : double cast `as unknown as TargetType` pour passer entre `Record<string,unknown>` et les types union.
- Pas de `<button>` imbriqués — utiliser `<div role="button" tabIndex={0} onKeyDown={...}>` pour les items de liste cliquables.

### Backend
- Schémas Pydantic : `position: Literal["left","right"]`, `type: Literal["dialogue","text","quiz"]` — ne pas élargir en `str`.
- `exclude_unset=True` sur tous les PATCH pour n'écraser que les champs fournis.
- Reorder : valider tous les IDs avant de committer (lever `HTTPException(400)` si ID inconnu).
- Slug : `unicodedata.normalize("NFKD")` + encode ASCII avant le regex pour translittérer les accents.

## Architecture ScenePlayer

`ScenePlayer.tsx` est le moteur de rendu VN. Props clés :
- `showMode?: "normal" | "characters-only" | "background-only"` — pour les previews de l'éditeur.
- `onIndexChange?: (index: number) => void` — callback pour synchroniser la sidebar. Implémenté via ref pattern (pas de dep array supprimé).
- Positionnement personnages : 1 perso dialogue → `left:36%`, 2 persos → `left/right:16%`, 3+ → `left:4%+22%×i`.
- Outline blanc sur perso actif : filtre SVG `feMorphology operator="dilate"` (pas `drop-shadow`).
- Écran de fin : `index >= nodes.length` → affiche bouton Recommencer.

## Tests

### Backend
- Fixture `client` dans `tests/conftest.py` : SQLite in-memory avec `StaticPool` + override `get_db`.
- Uploads redirigés vers `tmp_path` via `monkeypatch`.
- Lancer depuis `backend/` : `python -m pytest`.

### Frontend Jest
- Config dans `jest.config.ts` avec `next/jest.js`.
- `testMatch` limité à `__tests__/` pour exclure les fichiers Playwright `e2e/`.
- Mocker `@/lib/api` dans chaque fichier de test.

### Playwright E2E
- Config dans `playwright.config.ts` — lance `npm run dev` automatiquement.
- Tests dans `e2e/` — nécessite le backend actif sur `:8000`.

## Limitations connues (prototype)

- Pas d'authentification — éditeur accessible sans login.
- SQLite — pas adapté à la production multi-utilisateurs.
- `content_type` de l'upload vient du client (pas de validation magic bytes).
- `bgCustomUploads` non persisté entre sessions (état React uniquement).
- Pas de timeout sur le fetch SSR de la page publique `/s/[slug]`.
