# CLAUDE.md — Tellana

Instructions et contexte pour Claude Code sur ce projet.

## Projet

Plateforme Visual Novel : éditeur de stories composées de scènes (dialogues, textes, quiz) avec personnages et décors. Backend FastAPI + SQLite, frontend Next.js 16 App Router.

**Intégration prévue** avec **Media Creator** (projet compagnon : génération/édition d'images et vidéos par IA, local-first + cloud). Phase 1 : import d'assets. Spec : `docs/superpowers/specs/2026-04-07-media-creator-integration-design.md`.

### Hiérarchie des objets

- **Story** : titre, slug, published, personnages — une story = plusieurs scènes ordonnées
- **Scene** : séquence de nœuds avec son propre décor, titre, `character_ids` (persos visibles, ordonnés, max 4), `character_positions`
- **Character** : attaché à la Story (partagé entre toutes les scènes), sans champ `position` (positionné dynamiquement par ScenePlayer). Champ `color` (hex string, ex. `#FF6B6B`) pour la couleur du nom dans le player.
- **Node** : attaché à une Scene via `scene_id`

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
- Résolution d'URL d'assets : toujours utiliser `resolveAsset(ref: string | AssetRef)` importé depuis `@/lib/api` (gère `/uploads/` → URL complète backend, rétrocompatible `string`). Ne jamais utiliser `ref.url` directement pour afficher une image.
- **Types de nœuds** : ne pas fermer le `Literal` à `"dialogue"|"text"|"quiz"` — les types `"image"`, `"video"`, `"image_text"` sont prévus (spec Media Creator).
- **Sprites personnages** : `sprites: Record<string, AssetRef>` sur `Character` — `Object.values(c.sprites)[0]` pour le sprite par défaut.
- **Couleur personnage** : `color?: string | null` sur `Character`. `RAINBOW_COLORS` + `randomCharacterColor()` exportés depuis `@/lib/api` pour la valeur par défaut aléatoire.
- Types `NodeData` : double cast `as unknown as TargetType` pour passer entre `Record<string,unknown>` et les types union.
- Pas de `<button>` imbriqués — utiliser `<div role="button" tabIndex={0} onKeyDown={...}>` pour les items de liste cliquables.

### Backend
- Schémas Pydantic : `type: Literal["dialogue","text","quiz"]` — ne pas élargir en `str`, mais documenter les types futurs prévus (`"image"`, `"video"`, `"image_text"`) en commentaire.
- `Character` n'a pas de champ `position` (positionnement dynamique dans ScenePlayer). `sprites: dict[str, AssetRef]`. `color: Optional[str]` (hex, nullable).
- Migrations safe au démarrage dans `main.py` : pattern `ALTER TABLE ... ADD COLUMN` dans un `try/except` (voir `character_positions` et `color`). `create_all` gère les DB fraîches, le bloc ALTER gère les DB existantes.
- `Scene` hérite de `SceneSummary` — ne pas dupliquer les champs. `SceneSummary` inclut `character_ids: list[int]` et `character_positions: Dict[str, CharacterPosition]`.
- `StorySummary` inclut `first_scene_character_ids`, `first_scene_character_positions`, `characters: list[Character]` — construits manuellement dans `list_stories` avec `selectinload(Story.scenes)` + `selectinload(Story.characters)`.
- `exclude_unset=True` sur tous les PATCH pour n'écraser que les champs fournis.
- Reorder : valider tous les IDs avant de committer (lever `HTTPException(400)` si ID inconnu).
- Slug : `unicodedata.normalize("NFKD")` + encode ASCII avant le regex pour translittérer les accents.
- `character_ids` sur Scene : max 4, doivent appartenir à la story (validé dans PATCH scenes).
- Suppression d'un personnage story : le backend nettoie `character_ids` et `character_positions` dans toutes les scènes de la story.

## UI — Palette et style global

### Palette sémantique (Tailwind v4 `@theme`)

Tokens définis dans `frontend/app/globals.css` via `@theme { --color-* }` :

- `bg-bg` / `bg-surface` / `bg-sidebar` — fonds principaux (du plus sombre au plus clair)
- `bg-elevated` / `bg-raised` — surfaces surélevées
- `text-fore` / `text-muted` / `text-subtle` — hiérarchie typographique

Utiliser **toujours ces tokens** plutôt que des couleurs hardcodées (`slate-*`, `zinc-*`, etc.).

### Police

**Space Grotesk** via `next/font/google` dans `app/layout.tsx`, variable CSS `--font-space-grotesk` sur `<html>`.

### Boutons primaires

`bg-primary hover:bg-primary-hover text-white` — couleur définie par `--color-primary` / `--color-primary-hover` dans `globals.css @theme`. Modifier ces variables pour rethémer tous les boutons d'action.

### Border radius

Convention : `rounded-lg` (cards), `rounded-md` (éléments interactifs), `rounded` (petits éléments). Éviter `rounded-2xl` et `rounded-xl`.

### Styles du player

Isolés dans `frontend/app/styles/player.css` (importé dans `globals.css`). Variables CSS : `--player-box-bg`, `--player-name-color`, etc. Classes : `.player-box`, `.player-next-btn`, `.player-option*`, `.player-confirm-btn`. Permet un override par story à terme.

**Ne pas mettre de styles player inline dans les composants** — passer par ces classes CSS.

## Architecture ScenePlayer / rendu visuel

### Scale uniforme 1920×1080

`ScenePlayer.tsx` rend un inner div fixe 1920×1080 px, scalé via `transform: scale(ratio)` avec `transformOrigin: "top left"`. `ratio = containerWidth / 1920` mesuré par `useLayoutEffect` + `ResizeObserver` (sur `containerRef`). L'outer div maintient `aspectRatio: 16/9`. **Utiliser `useLayoutEffect` (pas `useEffect`) pour éviter le flash au premier render.**

Les tailles de texte et icônes dans le inner div sont définies pour 1920px base (~48-52px pour le corps de texte, ~20px pour les icônes).

### ScenePlayer props

- `characters` : liste pré-filtrée par l'appelant depuis `scene.character_ids`.
- `characterPositions?: Record<string, CharacterPosition>` — positions par perso (clé = `string(id)`).
- `showMode?: "normal" | "characters-only" | "background-only"` — pour les previews de l'éditeur.
- `onIndexChange?: (index: number) => void` — callback sidebar, via ref pattern.
- Pas de raccourcis clavier. Écran de fin : `index >= nodes.length` → bouton Recommencer.

### Positionnement personnages

Constantes partagées dans `frontend/lib/scenePositions.ts` : `DEFAULT_POSITIONS[0..3]` + `FALLBACK_POSITION`. Importées par `ScenePlayer` et `ScenePreviewThumbnail`.

CSS : `height:100%`, `bottom: calc(-10% + y*50%)`, `left: ((x+1)/2)*100%`, `transform: translateX(-50%) scale(s) scaleX(flip)`.

`CharacterPosition` : `{ x: float [-1,1], y: float [-3,1], scale: float [0.1,2.5], flip_x: bool }`. Clé = `str(character_id)`.

### ScenePreviewThumbnail

`frontend/components/ScenePreviewThumbnail.tsx` — composant statique (pas d'interaction) affichant fond + sprites positionnés. Même logique de scale 1920×1080 que `ScenePlayer`. Props : `backgroundAsset`, `characters`, `characterPositions`, `className`. Utilisé dans la page story (`w-40 h-[90px]`) et la page d'accueil (`w-full aspect-video`).

### MultiScenePlayer

`MultiScenePlayer.tsx` enchaîne plusieurs `ScenePlayer` (`key={scene.id}` force le remontage). Avance automatiquement sur `onEnd`. Passe `characterPositions={scene.character_positions}`.

### SceneCharacterSelector

Onglet Perso de l'éditeur : toggle des persos visibles (max 4), sliders de position (X, Y, Échelle) et toggle orientation. Callbacks : `onChange(ids, positions)` (persist), `onPositionChange(charId, pos)` (real-time), `onPositionCommit(charId, pos)` (persist au relâchement).

## Éditeur de scène (page edit)

- Panneau resizable : la zone principale (`mainAreaRef`) est divisée en preview (hauteur `previewPct`%, défaut 42%) + divider + formulaire. Drag vertical par pointer capture, limité à [15%, 82%]. État : `previewPct` (useState), `dragState` (useRef).
- Tab "Script" : liste des nœuds + formulaire d'édition.
- Ajout de nœud : sous-menu (Dialogue / Texte narratif / Quiz). Type fixé à la création. Nœud inséré après le nœud courant.
- `NodeForm` : `DialogueFields` (personnage + texte), `TextFields` (Markdown), `QuizFields`.
  - `DialogueFields` : clic sur un bloc personnage le sélectionne ; re-clic sur le même le désélectionne (`character_id → null`).
  - Auto-save 1 s avec spinner affiché à droite du titre "Édition du nœud". Pas de bouton Enregistrer.
- Preview (tab "nodes") : wrapper `height: previewPct% + aspectRatio: 16/9 + maxWidth: 100%` — hauteur fixe, largeur calculée automatiquement (height-driven). Pour les autres tabs, padding `1rem` et `max-w-2xl`.
- `previewPatch` : patch live pour la preview lors de l'édition. Réinitialisé à `null` dans `onIndexChange` pour éviter la contamination lors de l'avance dans la preview.
- `sceneCharacters` passé à `NodeForm` (persos de la scène uniquement).
- Root div : `h-screen overflow-hidden`. Liste des nœuds scrollable (`flex-1 min-h-0 overflow-y-auto`), bouton Ajouter fixe (`flex-shrink-0`).
- `onEditingCharacter` callback → masque la navbar story (`opacity-20 pointer-events-none`) pendant l'édition.

## Personnages et poses

- `CharacterManager` : modes list / add / edit / poses. `onEditingCharacter?(editing: boolean)` remonte l'état.
- `CharacterBasicForm` : grille sprites 3 colonnes, bouton "Gérer les poses" amber. Color picker inline à droite du champ nom (bouton carré `w-9 h-9`, `<input type="color">` caché via `sr-only`). Couleur initialisée depuis `initial?.color ?? randomCharacterColor()`.
- `CharacterPosesManager` : gestion des poses (add, rename, delete, change image). Overlay modale pour noms dupliqués. Badge "défaut" non renommable.
- `CharacterPosesDrawer` : preview des sprites à droite (z-30).
- Overlay backdrop `fixed left-[36rem] inset-y-0 right-0` avec `bg-black/50 backdrop-blur-sm`.

## UI générale

- `ConfirmModal` : remplace tous les `confirm()` natifs.
- Story page navbar : libellé "Éditer votre story" (petit, grisé) + titre éditable.
- Story publiée : bouton "Voir la page publique" dans la navbar + bouton copier le lien (coche verte 2 s).
- Limite 4 personnages : s'applique uniquement à la scène (`character_ids`), pas à la story.

## Tests

### Backend (45 tests)
- Fixture `client` dans `tests/conftest.py` : SQLite in-memory avec `StaticPool` + override `get_db`.
- Uploads redirigés vers `tmp_path` via `monkeypatch`.
- Lancer depuis `backend/` : `python -m pytest`.

### Frontend Jest (39 tests)
- Mock `@/lib/api` : inclure `randomCharacterColor: () => "#FF6B6B"` dans tout mock de ce module (requis par `CharacterBasicForm`).
- Config dans `jest.config.ts` avec `next/jest.js`.
- `testMatch` limité à `__tests__/` pour exclure les fichiers Playwright `e2e/`.
- `jest.setup.ts` : mock `ResizeObserver` (requis pour ScenePlayer et ScenePreviewThumbnail).
- Mocker `@/lib/api` dans chaque fichier de test.

### Playwright E2E
- Config dans `playwright.config.ts` — lance `npm run dev` automatiquement.
- Tests dans `e2e/` — nécessite le backend actif sur `:8000`.

## Limitations connues (prototype)

- Pas d'authentification — éditeur accessible sans login.
- SQLite — pas adapté à la production multi-utilisateurs.
- `content_type` de l'upload vient du client (pas de validation magic bytes).
- Pas de timeout sur le fetch SSR de la page publique `/s/[slug]`.
