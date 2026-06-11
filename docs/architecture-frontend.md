# Architecture — Frontend Tellana

> Généré le 2026-06-11 · Scan : quick

---

## Résumé exécutif

Application Next.js 16 (App Router) pour l'édition et la lecture de stories Visual Novel. Interface d'édition complète (scripts, personnages, positions graphiques) et player HTML5 embarquable + standalone.

---

## Stack technologique

| Catégorie | Technologie | Version |
|-----------|------------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Langage | TypeScript | 5 |
| Styling | Tailwind CSS | v4 |
| Data fetching | SWR | 2.4.1 |
| Markdown | react-markdown + remark-gfm | 10.1 / 4.0.1 |
| Player bundle | Vite (IIFE) | 8.0.9 |
| Tests unitaires | Jest + React Testing Library | 30 / 16 |
| Tests E2E | Playwright | 1.59 |
| Police | Space Grotesk (next/font) | — |

---

## Pattern d'architecture

**App Router Next.js 16** avec composants client interactifs et Server Components pour les pages publiques.

```
app/
├── page.tsx                        → Home (liste stories, Server Component)
├── layout.tsx                      → Layout racine (police, méta)
├── stories/[id]/                   → Zone éditeur
│   ├── page.tsx                    → Vue story (scènes, personnages)
│   ├── edit/page.tsx               → Éditeur de scène (resizable panel)
│   └── play/page.tsx               → Lecteur interne
└── s/[slug]/                       → Zone publique
    ├── page.tsx                    → SSR (fetch story + render)
    └── PublicPlayer.tsx            → Lecteur public
```

---

## Routing et navigation

| Route | Page | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Accueil — liste des stories avec vignettes |
| `/stories/[id]` | `app/stories/[id]/page.tsx` | Story : scènes + personnages + navbar |
| `/stories/[id]/edit` | `app/stories/[id]/edit/page.tsx` | Éditeur de scène actuelle |
| `/stories/[id]/play` | `app/stories/[id]/play/page.tsx` | Preview complète de la story |
| `/s/[slug]` | `app/s/[slug]/page.tsx` | Page publique standalone |

**Attention Next.js 16** : les `params` sont des `Promise`.
- Server component : `const { id } = await params`
- Client component : `const { id } = use(params)`

---

## Gestion de l'état

- **Pas de store global** (pas de Redux/Zustand)
- **SWR** pour le cache serveur — `mutate()` déclenche le rechargement
- **useState/useRef** pour l'état local des composants
- `await mutate()` retourne la donnée fraîche — utiliser son retour

---

## Composants

Voir [component-inventory-frontend.md](./component-inventory-frontend.md) pour l'inventaire complet.

### Architecture du player

`ScenePlayer` rend un inner div fixe **1920×1080 px** scalé :
```
containerRef (outer div, aspect-ratio 16/9)
  └── inner div (1920×1080, transform: scale(ratio))
      ├── background image
      ├── character sprites (positioned via CSS)
      └── dialogue/text/quiz overlay (.player-box)
```

`ratio = containerWidth / 1920` — mesuré par `useLayoutEffect` + `ResizeObserver`.

### Positionnement personnages

Constantes dans `lib/scenePositions.ts`. Formule CSS :
```
height: 100%
bottom: calc(-10% + y*50%)
left: ((x+1)/2)*100%
transform: translateX(-50%) scale(s) scaleX(flip ? -1 : 1)
```

---

## Design system

### Tokens Tailwind v4 (`@theme` dans `globals.css`)

| Token | Usage |
|-------|-------|
| `bg-bg` / `bg-surface` / `bg-sidebar` | Fonds (du + sombre au + clair) |
| `bg-elevated` / `bg-raised` | Surfaces surélevées |
| `text-fore` / `text-muted` / `text-subtle` | Hiérarchie typographique |
| `bg-primary` / `bg-primary-hover` | Boutons d'action |

### Styles player

Isolés dans `app/styles/player.css` :
- `.player-box` — zone de texte
- `.player-next-btn` — bouton suivant
- `.player-option*` — options quiz
- `.player-confirm-btn` — confirmation

---

## Player standalone (Vite)

En parallèle de l'app Next.js, un bundle IIFE autonome est compilé :

```
player-entry.tsx
  ↓ vite build --config vite.player.config.ts
player-dist/
  ├── player-bundle.js    (React + ScenePlayer inclus)
  ├── player-bundle.css
  └── custom.css
```

Ce bundle est lu par le backend pour assembler les ZIPs d'export.

---

## Tests

```
frontend/__tests__/
├── ScenePlayer.test.tsx
├── ScenePreviewThumbnail.test.tsx
├── NodeForm.test.tsx
└── CharacterManager.test.tsx

frontend/e2e/
└── (tests Playwright)
```

39 tests Jest. Config : `jest.config.ts` avec `next/jest.js`.  
`jest.setup.ts` : mock `ResizeObserver`.  
Mock `@/lib/api` requis dans chaque test (inclure `randomCharacterColor`).
