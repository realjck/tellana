---
project_name: 'tellana'
user_name: 'jck'
date: '2026-06-12'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 58
optimized_for_llm: true
---

# Project Context for AI Agents

_Règles et patterns critiques pour l'implémentation de code dans le projet Tellana. Focus sur les détails non-évidents que les agents pourraient manquer._

---

## Technology Stack & Versions

### Backend
- FastAPI 0.115 · Uvicorn 0.30.6 · Python 3.10+
- SQLAlchemy 2.0 (**sync délibéré** — pas d'AsyncSession) · Pydantic 2.9.2 · SQLite
- aiofiles 24.1.0 · python-multipart 0.0.12
- Tests : pytest ≥8.0 + httpx ≥0.27

### Frontend
- Next.js 16.2.2 (App Router) · React 19.2.4 · TypeScript 5 strict
- Tailwind CSS v4 (tokens `@theme` dans `globals.css` — **pas de `tailwind.config.js`**)
- SWR 2.4.1 · react-markdown 10.1 + remark-gfm 4.0.1
- Vite 8.0.9 — build player standalone IIFE séparé (`npm run build:player`)
- Tests : Jest 30 + React Testing Library 16 + Playwright 1.59

### Configs clés
- TypeScript : `strict: true`, `moduleResolution: "bundler"`, alias `@/*` → `frontend/`
- React Compiler : `reactCompiler: true` dans `next.config.ts`
- ESLint : next/core-web-vitals + next/typescript
- Jest transformer : `next/jest.js` · `testMatch`: `__tests__/**/*.test.(ts|tsx)` uniquement

---

## Critical Implementation Rules

### Language-Specific Rules

#### TypeScript (Frontend)
- Alias `@/` → racine de `frontend/` (pas `src/`) — ex : `@/components/ScenePlayer`
- Double cast obligatoire : `as unknown as TargetType` (entre `Record<string,unknown>` et types union NodeData)
- `"use client"` requis sur tous les composants interactifs — aucun composant dans `components/` n'est server-only
- `resolveAsset(ref)` depuis `@/lib/api` pour toute URL d'asset — **jamais `ref.url` directement**
- Pas de `<button>` imbriqués — utiliser `<div role="button" tabIndex={0} onKeyDown={...}>`

#### Python (Backend)
- Pas de couche service ni repository — logique métier directement dans `routers/`
- `exclude_unset=True` obligatoire sur tous les PATCH Pydantic
- **`_touch_story(story_id, db)`** avant chaque `db.commit()` dans scenes.py, nodes.py, characters.py — seul mécanisme de détection des modifications non publiées
- `character_ids` sur Scene = tableau **ordonné** (ordre = index Z, dernier = avant-plan) — ne pas traiter comme un set
- `sprites` sur Character : `dict[str, AssetRef]` — clé = nom de pose (ex : `"default"`), pas un ID
- Migrations : `try/except ALTER TABLE ADD COLUMN` dans `main.py` uniquement — ne pas introduire Alembic
- Slug : `unicodedata.normalize("NFKD")` + `.encode("ascii", "ignore")` avant regex

### Framework-Specific Rules

#### Next.js 16 App Router
- **`params` est une `Promise`** — `await params` (server component), `use(params)` (client component) — casse silencieusement si oublié
- `PageProps` disponible globalement via `next-env.d.ts` — pas d'import nécessaire
- App Router à la racine `frontend/app/` — pas de dossier `src/`

#### React 19 + React Compiler
- **Ne pas ajouter `useMemo`/`useCallback` manuellement** — React Compiler optimise automatiquement
- Ne pas muter d'objets React directement (`obj.field = x` prohibé)
- `useLayoutEffect` (pas `useEffect`) pour les mesures DOM — évite le flash au premier render
- SWR : utiliser le retour de `await mutate()` — les closures peuvent être périmées

#### FastAPI
- Préfixe `/api/` sur tous les routeurs
- Pydantic génère les 422 automatiquement — pas de `HTTPException` pour ça
- `HTTPException(400)` pour les erreurs métier (IDs inconnus, dépassement limites)
- Reorder : valider **tous** les IDs avant toute modification DB

#### ScenePlayer — conventions visuelles
- Canvas fixe 1920×1080 scalé via `transform: scale(containerWidth / 1920)`, `transformOrigin: "top left"`
- Ratio mesuré par `useLayoutEffect` + `ResizeObserver` sur `containerRef`
- Positions personnages : `DEFAULT_POSITIONS` et `FALLBACK_POSITION` depuis `@/lib/scenePositions`
- Styles player uniquement dans `app/styles/player.css` — jamais de Tailwind inline sur ces éléments

### Testing Rules

#### Backend (pytest)
- Lancer depuis `backend/` : `python -m pytest`
- Fixture `client` : SQLite in-memory + `StaticPool` + override `get_db` — ne pas contourner
- Tests export-zip/publish : monkeypatcher `_PLAYER_DIST_DIR` et `_PUBLISHED_DIR` dans `routers.stories`

#### Frontend — Jest
- `testMatch` : `__tests__/**/*.test.(ts|tsx)` — tout test hors de ce dossier est silencieusement ignoré
- `jest.setup.ts` mock `ResizeObserver` — obligatoire pour ScenePlayer et ScenePreviewThumbnail
- Mock `@/lib/api` dans chaque test — inclure `randomCharacterColor: () => "#FF6B6B"` (requis par CharacterBasicForm)
- Mocks ESM dans `moduleNameMapper` : `react-markdown` → `__mocks__/react-markdown.tsx`

#### Frontend — Playwright E2E
- Backend actif sur `:8000` requis · Playwright démarre `npm run dev` automatiquement
- Tests dans `e2e/` uniquement (exclus de Jest via `testPathIgnorePatterns`)

### Code Quality & Style Rules

#### Organisation des fichiers
- Composants : `frontend/components/` (partagés) ou colocalisés dans `app/` (page-specific)
- Utilitaires : `frontend/lib/` uniquement — pas de `utils/`, `helpers/`, `services/`, `stores/`, `hooks/`
- Types : `frontend/types/index.ts` (globaux) · `frontend/lib/api.ts` (types API)
- Architecture volontairement plate — ne pas créer de nouvelles couches d'abstraction

#### Commentaires
- Commenter uniquement les invariants non-évidents, workarounds, contraintes cachées
- Langue : **anglais uniquement**
- Pas de JSDoc sauf sur les exports publics non-évidents (1 ligne max)

#### UI — Design system
**Tokens (jamais `slate-*`, `zinc-*` hardcodés) :**
- Fonds : `bg-bg` < `bg-surface` < `bg-sidebar` < `bg-elevated` (dropdowns) < `bg-raised` (modales)
- Texte : `text-fore` / `text-muted` / `text-subtle`
- Actions : `bg-primary hover:bg-primary-hover text-white`

**Typographie :** Space Grotesk via `--font-space-grotesk` — ne jamais importer d'autre font

**Border radius :** `rounded-lg` (cards) · `rounded-md` (interactifs) · `rounded` (petits) — pas de `rounded-xl`/`rounded-2xl`

**États interactifs :** focus `ring-2 ring-primary/60 outline-none` · disabled `opacity-50 cursor-not-allowed pointer-events-none`

**Espacement :** cards `p-4` · listes `gap-2` · blocs `gap-4` · sections `mb-6`

**Player :** styles dans `player.css` uniquement — classes `.player-box`, `.player-next-btn`, `.player-option*`, `.player-confirm-btn`

**Modales :** `ConfirmModal` (remplace `confirm()`) · `AlertModal` (remplace `alert()`)

### Development Workflow Rules

- Branches : `feat/tel-{id}` · `fix/tel-{id}`
- Commits : `type: TEL-{id} — description`
- Avant commit : `python -m pytest` (backend) + `npm test` (frontend)
- Player bundle : `npm run build:player` requis avant export ZIP ou publication
- Dev : deux serveurs — backend `:8000` + frontend `:3000` (`NEXT_PUBLIC_API_URL=http://localhost:8000`)

### Critical Don't-Miss Rules

**Frontend :**
- `resolveAsset(ref)` obligatoire — jamais `.url` directement
- NodeData Literal ouvert — `"image"`, `"video"`, `"image_text"` réservés (spec Media Creator), en commentaire seulement
- Player CSS isolé — jamais de Tailwind inline sur les éléments `.player-*`
- Pas de `useMemo`/`useCallback` manuels — React Compiler gère
- `useLayoutEffect` pour toute mesure DOM critique au rendu

**Backend :**
- SQLAlchemy sync uniquement — jamais `AsyncSession`
- Pas de couche service — logique dans `routers/` uniquement
- `_touch_story()` avant chaque `db.commit()` dans scenes/nodes/characters
- `character_ids` = tableau ordonné (index Z) — pas un set
- Reorder : valider tous les IDs avant toute écriture DB

**Limites métier :**
- `character_ids` : max 4, doivent appartenir à la story
- `CharacterPosition` : `scale` [0.1–2.5] · `x` [-1–1] · `y` [-3–1]
- Suppression personnage : backend nettoie `character_ids`/`character_positions` dans toutes les scènes (déjà dans `routers/characters.py`)

**Prototype — pas d'auth, SQLite, content_type client non validé**

---

## Usage Guidelines

**Pour les agents IA :**
- Lire ce fichier avant toute implémentation
- Suivre toutes les règles telles que documentées
- En cas de doute, choisir l'option la plus restrictive
- Référencer `docs/index.md` pour l'architecture détaillée

**Pour les humains :**
- Maintenir ce fichier lean — uniquement les règles non-évidentes
- Mettre à jour lors de changements de stack ou de conventions
- Supprimer les règles devenues évidentes au fil du temps

_Dernière mise à jour : 2026-06-12_
