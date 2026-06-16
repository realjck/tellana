# CLAUDE.md — Tellana

Instructions et contexte pour Claude Code sur ce projet.

## Projet

Plateforme Visual Novel : éditeur de stories composées de scènes (dialogues, textes, quiz) avec personnages et décors. Backend FastAPI + SQLite, frontend Next.js 16 App Router.

**Intégration prévue** avec **Media Creator** (projet compagnon : génération/édition d'images et vidéos par IA, local-first + cloud). Phase 1 : import d'assets. Spec : `docs/superpowers/specs/2026-04-07-media-creator-integration-design.md`.

### Hiérarchie des objets

- **Story** : titre, slug, published, `published_at` (DateTime nullable — horodatage de la dernière publication), personnages — une story = plusieurs scènes ordonnées
- **Scene** : séquence de nœuds avec son propre décor, titre, `character_ids` (persos visibles, ordonnés, max 4), `character_positions`
- **Character** : attaché à la Story (partagé entre toutes les scènes), sans champ `position` (positionné dynamiquement par ScenePlayer). Champ `color` (hex string, ex. `#FF6B6B`) pour la couleur du nom dans le player.
- **Node** : attaché à une Scene via `scene_id`
- **GraphNode** : nœud du graphe narratif — types `start | scene | branch | end`, `data` JSON typé par type, `position_x/y` (layout canvas). Un seul `start` par story.
- **GraphEdge** : lien entre deux GraphNodes — `source_node_id`, `target_node_id`, `source_handle` (id du choix sur un nœud branch), `order` (tri des sorties branch).

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
cd frontend && npm run test:e2e       # nécessite backend sur :8000
cd frontend && npm run build:player   # compile le player bundle standalone (player-dist/)
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
- **Cache-busting des assets remplacés** : tout composant qui affiche un asset remplaçable doit appeler `useAssetBust()` (depuis `@/lib/assetBust`) et passer son retour à `resolveAsset(ref, bust)`. Le `bust` DOIT être un **argument explicite** — sinon React Compiler mémoïse l'ancienne URL et l'image reste périmée après un remplacement de fichier (même nom = même URL). `bustAssetCache()` (appelé après un remplacement réussi dans `UploadDropZone`) incrémente une version globale → re-render des abonnés → `?v=N` ajouté aux URLs `/uploads/`.
- **Types de nœuds** : ne pas fermer le `Literal` à `"dialogue"|"text"|"quiz"` — les types `"image"`, `"video"`, `"image_text"` sont prévus (spec Media Creator).
- **Sprites personnages** : `sprites: Record<string, AssetRef>` sur `Character` — `Object.values(c.sprites)[0]` pour le sprite par défaut.
- **Couleur personnage** : `color?: string | null` sur `Character`. `RAINBOW_COLORS` + `randomCharacterColor()` exportés depuis `@/lib/api` pour la valeur par défaut aléatoire.
- Types `NodeData` : double cast `as unknown as TargetType` pour passer entre `Record<string,unknown>` et les types union.
- Pas de `<button>` imbriqués — utiliser `<div role="button" tabIndex={0} onKeyDown={...}>` pour les items de liste cliquables.

### Backend
- Schémas Pydantic : `type: Literal["dialogue","text","quiz"]` — ne pas élargir en `str`, mais documenter les types futurs prévus (`"image"`, `"video"`, `"image_text"`) en commentaire.
- `Character` n'a pas de champ `position` (positionnement dynamique dans ScenePlayer). `sprites: dict[str, AssetRef]`. `color: Optional[str]` (hex, nullable).
- Migrations safe au démarrage dans `main.py` : pattern `ALTER TABLE ... ADD COLUMN` dans un `try/except` (voir `character_positions`, `color`, `published_at`). `create_all` gère les DB fraîches, le bloc ALTER gère les DB existantes.
- `Scene` hérite de `SceneSummary` — ne pas dupliquer les champs. `SceneSummary` inclut `character_ids: list[int]` et `character_positions: Dict[str, CharacterPosition]`.
- `StorySummary` inclut `first_scene_character_ids`, `first_scene_character_positions`, `characters: list[Character]` — construits manuellement dans `list_stories` avec `selectinload(Story.scenes)` + `selectinload(Story.characters)`.
- `exclude_unset=True` sur tous les PATCH pour n'écraser que les champs fournis.
- Reorder : valider tous les IDs avant de committer (lever `HTTPException(400)` si ID inconnu).
- Slug : `unicodedata.normalize("NFKD")` + encode ASCII avant le regex pour translittérer les accents.
- `character_ids` sur Scene : max 4, doivent appartenir à la story (validé dans PATCH scenes).
- Suppression d'un personnage story : le backend nettoie `character_ids` et `character_positions` dans toutes les scènes de la story.
- **`_touch_story(story_id, db)`** : helper présent dans `routers/scenes.py`, `nodes.py`, `characters.py` — bumpe `story.updated_at = datetime.utcnow()` sur toute mutation de contenu. Permet la détection des modifications non publiées. À appeler avant chaque `db.commit()` dans ces routers.

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

Isolés dans `frontend/app/styles/player.css` (importé dans `globals.css`). Variables CSS : `--player-box-bg`, `--player-name-color`, etc. Classes : `.player-box`, `.player-next-btn`, `.player-option*`, `.player-confirm-btn`, `.player-branch-overlay`. Permet un override par story à terme.

**Ne pas mettre de styles player inline dans les composants** — passer par ces classes CSS.

**`.player-next-btn` inclut `cursor: pointer` directement en CSS** (pas via la classe Tailwind `cursor-pointer`) — la classe Tailwind peut être écrasée par le reset `cursor: default` des `<button>` dans le bundle standalone.

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

Onglet Perso de l'éditeur : liste des personnages visibles (max 4) avec boutons ▲/▼ pour réordonner l'index Z (ordre = `character_ids`, dernier = avant-plan). Liste affichée inversée (premier affiché = avant-plan). État actif synchronisé avec `selectedCharId`. Callbacks : `onChange(ids, positions)` (persist add/remove), `onSelectCharacter(id | null)` (sélection), `onReorder(newIds)` (réordonnement Z, PATCH `character_ids` uniquement sans positions).

### SceneCharacterEditorOverlay

`frontend/components/SceneCharacterEditorOverlay.tsx` — overlay `absolute inset-0` sur le ScenePlayer, actif uniquement en tab "Perso.". Mesure sa propre largeur via `ResizeObserver` pour `scale = width / 1920`.

- Clic sur un personnage → sélection ; clic en dehors → désélection
- Personnage sélectionné : cadre pointillé (`border-white/90`) + 8 handles de resize + bouton miroir central circulaire
- Drag sur le personnage → déplacement (delta CSS / scale → delta scène)
- Drag sur un handle → scale uniforme : `new_scale = start_scale * dist / startDist` (distances en coordonnées viewport)
- Bouton miroir → toggle `flip_x`, commit immédiat
- `hasMoved` flag sur le DragState : évite un commit spurieux si l'utilisateur clique sans bouger
- Formule `cy` (pivot vertical, scale-invariant) : `cy = (0.6 - pos.y * 0.5) * containerH` — correspond au `transform-origin: 50% 50%` de l'img 1080px dans ScenePlayer
- **Fallback de position** : quand `characterPositions[id]` est absent, utiliser `DEFAULT_POSITIONS[slotIndex] ?? FALLBACK_POSITION` (même logique que `ScenePlayer.getCharPosition`) — ne pas utiliser `{ x: 0, y: 0 }` directement.

## Canvas (React Flow — `@xyflow/react`)

Page : `frontend/app/stories/[id]/canvas/page.tsx`. Point d'entrée principal d'une story (remplace la vue liste linéaire).

### Types de nœuds et arêtes

| Type | Composant | Rôle |
|------|-----------|------|
| `scene` | `SceneNode` | Miniature ScenePreviewThumbnail + titre + handles top/bottom |
| `branch` | `BranchNode` | Liste des choix numérotés + handles sortants dynamiques |
| `end` | `EndNode` | Écran de fin (good/bad/neutral) |
| `start` | `StartNode` | Point d'entrée unique |
| `smoothstep` | `DeleteEdge` | Arête avec bouton × au survol pour supprimer |

- `NODE_TYPES` et `EDGE_TYPES` enregistrés sur `<ReactFlow>` — ne jamais passer les composants en inline.
- `deleteKeyCode={null}` sur `<ReactFlow>` — la suppression native est désactivée, gérée manuellement via `onKeyDown` + `ConfirmModal`.
- Un seul trait par point de sortie (`source` + `sourceHandle`) : dans `onConnect`, supprimer l'arête existante avant d'en créer une nouvelle.
- Handles : `!w-4 !h-4` (taille doublée via `!important` Tailwind).
- `BranchNode` : numéros affichés au-dessus de chaque handle sortant + dans la liste des choix.

### Gestion des personnages dans le canvas

- `SceneInfo` (interface locale) porte `backgroundAsset`, `characterIds`, `characterPositions` par scene.
- Les données de personnage (`characters`) viennent du SWR `story-{id}` — passées via `charactersRef` (useRef) pour éviter les closures périmées dans les callbacks React Flow.
- `useEffect` sur le prop `characters` met à jour les `SceneNode` existants quand les données changent.

### Modale de paramètres branch (double-clic)

`BranchSettingsModal` — configure les choix (1–5), leurs labels, `show_visited` et `replay`. Fermée uniquement via les boutons (pas de clic extérieur). `source_handle` = id du choix (string UUID) — lien entre `GraphEdge.source_handle` et `choice.id` dans le nœud branch.

## GraphPlayer / Lecteur de graphe

`frontend/components/GraphPlayer.tsx` — lecteur qui traverse le graphe narratif. Utilisé dans la page publique et le player standalone.

### Architecture fullscreen

Le `containerRef` (div racine de `GraphPlayer`) est **l'élément fullscreen persistant** — il ne démonte jamais. `ScenePlayer` reçoit `isFullscreen` + `onToggleFullscreen` en props (contrôle externe) pour ne pas gérer le fullscreen lui-même. L'état fullscreen est géré dans `GraphPlayer` via `document.fullscreenchange`.

### ScaledScreen

Composant interne de `GraphPlayer` — même mécanique 1920×1080 que `ScenePlayer` (ResizeObserver + `transform: scale`). Utilisé pour tous les écrans non-scène : branch, end, pendingResume, storyComplete. Tailles de texte dans ces écrans : `text-[80px]` (titres), `text-[64px]` (messages), `text-[44px]` (boutons), `text-[28px]` (mentions). Boutons : `px-20 py-8 rounded-xl`.

### Navigation

- `navigate(targetNodeId, edgeId?)` : change le nœud courant + met à jour `visitedEdgeIds` + sauvegarde localStorage.
- `pendingResume` : si une progression est sauvegardée et différente du nœud start, proposer de reprendre avant de démarrer.
- `lastReplayNodeId` : dernier nœud branch avec `replay: true` traversé — utilisé pour le bouton "Rejouer depuis le dernier choix" sur l'écran de fin.
- `show_visited` sur un nœud branch : si `false`, masquer les choix déjà visités (basé sur `visitedEdgeIds`).
- `BranchOverlay` : les options sont filtrées + triées par `order`. Le nœud branch affiche le fond de la dernière scène visitée (`lastScene`).

### BranchOverlay (1920×1080 scale)

`frontend/components/BranchOverlay.tsx` — overlay centré sur le fond de la dernière scène. Boutons : `max-w-[1100px]`, `px-12 py-8 rounded-xl text-[44px]`. Classe `.player-branch-overlay` sur le conteneur.

## Éditeur de scène (page edit)

- Panneau resizable : la zone principale (`mainAreaRef`) est divisée en preview (hauteur `previewPct`%, défaut 42%) + divider + formulaire. Drag vertical par pointer capture, limité à [15%, 82%]. État : `previewPct` (useState), `dragState` (useRef).
- Tab "Script" : liste des nœuds + formulaire d'édition.
- Ajout de nœud : sous-menu (Dialogue / Texte narratif / Quiz). Type fixé à la création. Nœud inséré après le nœud courant. Pour un nœud dialogue, `character_id` et `sprite_keys` sont copiés depuis le nœud courant si celui-ci est aussi un dialogue.
- `NodeForm` : `DialogueFields` (personnage + texte), `TextFields` (Markdown), `QuizFields`.
  - `DialogueFields` : clic sur un bloc personnage le sélectionne ; re-clic sur le même le désélectionne (`character_id → null`).
  - Auto-save 1 s avec spinner affiché à droite du titre "Édition du nœud". Pas de bouton Enregistrer.
- Preview (tab "nodes") : wrapper `height: previewPct% + aspectRatio: 16/9 + maxWidth: 100%` — hauteur fixe, largeur calculée automatiquement (height-driven). Pour les autres tabs, padding `1rem` et `max-w-2xl`.
- `previewPatch` : patch live pour la preview lors de l'édition. Réinitialisé à `null` dans `onIndexChange` pour éviter la contamination lors de l'avance dans la preview.
- `sceneCharacters` passé à `NodeForm` (persos de la scène uniquement).
- Root div : `h-screen overflow-hidden`. Liste des nœuds scrollable (`flex-1 min-h-0 overflow-y-auto`), bouton Ajouter fixe (`flex-shrink-0`).
- `onEditingCharacter` callback → masque la navbar story (`opacity-20 pointer-events-none`) pendant l'édition.

## Médiathèque

`MediaLibraryModal` — modale avec `FolderTree` (gauche) + `AssetGrid` (droite). Configurée via `MediaLibraryConfig` :

- `{ mode: "navigation" }` — gestion (upload, rename, delete dossier/fichier). Pas de sélection.
- `{ mode: "selector", filter?: "images", allowedFolders?, onSelect? }` — sélectionner un fichier → `onSelect(asset)`.
- `{ mode: "folder-selector", allowedFolders?, initialFolder?, onSelectFolderWithSprites? }` — sélectionner un dossier entier → `onSelectFolderWithSprites(folder, sprites)`. Bouton "Choisir ce dossier personnage" en bas de grille si des images sont présentes.

`UploadDropZone` : upload par clic ou drag-and-drop, disponible dans **tous les modes** (y compris `folder-selector`). Gestion des conflits de nom via `ConfirmModal` (bouton "Remplacer", message incluant les références scènes/nœuds/personnages).

`AssetGrid` — actions fichier/dossier via **menu contextuel clic droit** (`ContextMenu.tsx`) : Renommer (input inline) / Supprimer. Remplace les anciens boutons × et le double-clic. Renommage inline de dossier avec gestion 409 via `AlertModal`.

**Intégrité référentielle (backend `routers/assets.py`)** : `rename_folder` réécrit et `delete_folder` purge les références dans `Character.sprites` / `Scene.background_asset` (helpers `_rewrite_asset_references` / `_purge_asset_references`, même esprit que `delete_asset`). `/uploads` est servi avec `Cache-Control: no-cache` (`NoCacheStaticFiles` dans `main.py`) pour éviter le cache navigateur sur les fichiers remplacés.

`mapSpritesFromAssets` (dans `AssetGrid`) : construit `Record<string, AssetRef>` depuis les images d'un dossier. La clé `"default"` est toujours insérée en premier (fichier `default.*` en priorité, sinon premier fichier). Clé = stem du filename (sans extension).

Modèle `Asset` : `{ id, folder, filename, url, content_type, is_seed }`. `folder` = chemin relatif (`characters/alice`). `is_seed` = badge amber dans la grille.

## Personnages et poses

- `CharacterManager` : modes `list | add | edit` (plus de mode `poses`). `onEditingCharacter?(editing: boolean)` remonte l'état.
  - Mode **add** : `CharacterPosesDrawer` visible dès import des sprites (`addPendingSprites`).
  - Mode **edit** : `CharacterPosesManager` inline (`showHeader={false}`) + `CharacterPosesDrawer` permanent. `editPendingSprites` tracke les sprites importés avant sauvegarde — `drawerSprites = editPendingSprites ?? { ...selected.sprites, ... }`, réinitialisé après enregistrement.
  - Overlay backdrop `fixed left-[36rem] inset-y-0 right-0 bg-black/50 backdrop-blur-sm` (mode edit uniquement).
- `CharacterBasicForm` : bouton unique "Choisir/Changer depuis la médiathèque" (mode `folder-selector`, `allowedFolders: ["characters"]`). En création : liste de poses renommables inline après import (badge amber non renommable pour `"default"`). Color picker inline (`w-9 h-9`, `<input type="color">` via `sr-only`). Enregistrer → retour liste en création, reste en édition.
- `CharacterPosesManager` : add/rename/delete/change image des poses. `showHeader?: boolean` (défaut `true`) — quand `false`, masque le bouton retour et le titre (embedding inline en mode edit). Overlay modale pour noms dupliqués.
- `CharacterPosesDrawer` : `fixed left-72 top-0 h-full w-72 z-30`. Props : `characterName`, `sprites`, `highlightKey?`. `activeKey` en état local, synchronisé avec `highlightKey` via `useEffect`.

## Export et publication standalone

- **Player bundle** : `frontend/player-entry.tsx` compilé via `npm run build:player` (Vite IIFE) → `frontend/player-dist/` (`player-bundle.js`, `player-bundle.css`, `custom.css`). Requis pour export ZIP et publication.
- **`GET /api/stories/{id}/export-zip`** : génère un ZIP standalone téléchargeable (assets inclus, URLs réécrites `assets/images/`).
- **`POST /api/stories/{id}/publish`** : génère le ZIP, extrait dans `backend/published/{slug}/`, met `published=True` + `published_at=now()`.
- **`POST /api/stories/{id}/unpublish`** : supprime `backend/published/{slug}/`, met `published=False`.
- FastAPI sert `backend/published/` via `StaticFiles(html=True)` sur `/published`. URL publique : `http://localhost:8000/published/{slug}/index.html`.
- Bouton navbar : "Publier" / "Republier" (style primaire, quand `updated_at > published_at`) / "Dépublier" (style vert). Point amber affiché quand modifications non publiées.

## UI générale

- `ConfirmModal` : remplace tous les `confirm()` natifs (message + Annuler/Supprimer).
- `AlertModal` : pour les messages d'erreur simples (message + OK). Même style que `ConfirmModal`.
- Story page navbar : libellé "Éditer votre story" (petit, grisé) + titre éditable.
- Story publiée : bouton "Voir la page publique" (→ `/published/{slug}/index.html`) + bouton copier le lien (coche verte 2 s).
- Limite 4 personnages : s'applique uniquement à la scène (`character_ids`), pas à la story.

## Tests

### Backend (60 tests)
- Fixture `client` dans `tests/conftest.py` : SQLite in-memory avec `StaticPool` + override `get_db`.
- Uploads redirigés vers `tmp_path` via `monkeypatch`. Pour les tests export-zip/publish : monkeypatcher aussi `_PLAYER_DIST_DIR` et `_PUBLISHED_DIR` dans `routers.stories`.
- Lancer depuis `backend/` : `python -m pytest`.

### Frontend Jest (121 tests)
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
