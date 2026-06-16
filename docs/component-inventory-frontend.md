# Inventaire des composants — Frontend Tellana

> Généré le 2026-06-11 · Scan : quick

---

## Player / Rendu visuel

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `ScenePlayer` | `components/ScenePlayer.tsx` | Player principal. Canvas fixe 1920×1080 scalé via `transform: scale(ratio)`. Gère la progression des nœuds (dialogue, texte, quiz), le fond, et les personnages positionnés. |
| `MultiScenePlayer` | `components/MultiScenePlayer.tsx` | Enchaîne plusieurs `ScenePlayer` (`key={scene.id}`). Avance automatiquement sur `onEnd`. |
| `ScenePreviewThumbnail` | `components/ScenePreviewThumbnail.tsx` | Aperçu statique 1920×1080 scalé (sans interaction). Fond + sprites positionnés. Utilisé dans les listes de scènes. |
| `PublicPlayer` | `app/s/[slug]/PublicPlayer.tsx` | Wrapper public : charge la story via fetch SSR et monte `MultiScenePlayer`. |

### Props clés — ScenePlayer

| Prop | Type | Description |
|------|------|-------------|
| `scene` | Scene | Scène à afficher |
| `characters` | Character[] | Liste pré-filtrée par `character_ids` |
| `characterPositions` | Record<string, CharacterPosition>? | Positions des personnages |
| `showMode` | "normal" \| "characters-only" \| "background-only" | Mode d'affichage (preview éditeur) |
| `onIndexChange` | (index: number) => void | Callback avancement nœud |
| `previewPatch` | Partial<Node>? | Patch live pour prévisualisation éditeur |

---

## Éditeur de scène

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `SceneCharacterEditorOverlay` | `components/SceneCharacterEditorOverlay.tsx` | Overlay `absolute inset-0` sur le ScenePlayer. Drag pour déplacer, handles pour redimensionner, bouton miroir. Commit des positions via callback. |
| `SceneCharacterSelector` | `components/SceneCharacterSelector.tsx` | Sidebar onglet "Perso." : liste personnages visibles (max 4), boutons ▲/▼ pour réordonner l'index Z, sélection active. |
| `NodeForm` | `components/NodeForm.tsx` | Formulaire d'édition d'un nœud. Auto-save 1s. Sous-composants : `DialogueFields`, `TextFields`, `QuizFields`. |

---

## Médiathèque

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `MediaLibraryModal` | `components/media-library/MediaLibraryModal.tsx` | Modale principale. Panneau gauche `FolderTree` + panneau droit `AssetGrid`. Configurée via `MediaLibraryConfig` (modes : `navigation`, `selector`, `folder-selector`). |
| `FolderTree` | `components/media-library/FolderTree.tsx` | Arborescence des dossiers. Création de dossier via modale (remplace `prompt()`). Filtre `allowedFolders` si fourni. |
| `AssetGrid` | `components/media-library/AssetGrid.tsx` | Grille des assets d'un dossier. En mode `folder-selector` : bouton "Choisir ce dossier personnage" en bas si des images sont présentes. `mapSpritesFromAssets` construit le `Record<string, AssetRef>` avec `"default"` en premier. |
| `UploadDropZone` | `components/media-library/UploadDropZone.tsx` | Upload par clic ou drag-and-drop. Actif dans tous les modes. Gestion des conflits de nom via `ConfirmModal`. |

---

## Gestion des personnages

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `CharacterManager` | `components/CharacterManager.tsx` | Gestionnaire complet (modes : `list \| add \| edit`). `CharacterPosesManager` inline en mode edit (`showHeader={false}`). `editPendingSprites` pour aperçu immédiat lors du ré-import. |
| `CharacterBasicForm` | `components/CharacterBasicForm.tsx` | Bouton unique médiathèque (mode `folder-selector`). Création : poses renommables inline avant enregistrement. Color picker inline. |
| `CharacterPosesManager` | `components/CharacterPosesManager.tsx` | Ajouter/renommer/supprimer/changer l'image des poses. Prop `showHeader?: boolean`. Badge "défaut" non renommable. |
| `CharacterPosesDrawer` | `components/CharacterPosesDrawer.tsx` | Panneau `fixed left-72 w-72 z-30`. Preview sprite actif + onglets poses. |

---

## UI générale / Modales

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `ConfirmModal` | `components/ConfirmModal.tsx` | Remplace `confirm()` natif. Message + boutons Annuler / Supprimer. |
| `AlertModal` | `components/AlertModal.tsx` | Messages d'erreur simples. Message + bouton OK. |

---

## Bibliothèques utilitaires

| Fichier | Exports clés |
|---------|-------------|
| `lib/api.ts` | `fetcher`, `resolveAsset(ref)`, `RAINBOW_COLORS`, `randomCharacterColor()`, `api.assets.*`, types TS (`Story`, `Scene`, `Node`, `Character`, `Asset`, `AssetRef`, `CharacterPosition`, `NodeData`) |
| `lib/scenePositions.ts` | `DEFAULT_POSITIONS[0..3]`, `FALLBACK_POSITION` |
| `types/index.ts` | Types globaux TypeScript dont `MediaLibraryConfig` (modes `navigation \| selector \| folder-selector`) |

---

## Patterns de composants

- Tous les composants interactifs sont `"use client"`
- Fetch de données via **SWR** avec `mutate()` pour rechargement
- Pas de state management global (pas de Redux/Context) — état local + SWR
- CSS : tokens Tailwind v4 (`bg-bg`, `bg-surface`, `text-fore`, `text-muted`, etc.)
- Styles player isolés dans `app/styles/player.css` (classes `.player-box`, `.player-next-btn`, etc.)
