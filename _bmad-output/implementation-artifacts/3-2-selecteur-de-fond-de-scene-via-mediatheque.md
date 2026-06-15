---
baseline_commit: "7d52e84"
---

# Story 3.2 : Sélecteur de fond de scène via médiathèque

Status: done

## Story

En tant qu'auteur,
je veux choisir le fond d'une scène depuis ma médiathèque,
afin de sélectionner une image existante sans repasser par un upload.

## Acceptance Criteria

1. **Given** l'auteur édite une scène (onglet "Décor")
   **When** il clique sur "Choisir depuis la médiathèque"
   **Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "selector", filter: "images", initialFolder: "backgrounds" }}`

2. **Given** la modale est ouverte en mode sélecteur
   **When** l'auteur clique sur une vignette image
   **Then** `config.onSelect(asset)` est appelé avec l'asset choisi
   **And** la modale se ferme
   **And** le fond de la scène est mis à jour avec l'`AssetRef` construit depuis l'asset sélectionné
   **And** `resolveAsset(ref)` est utilisé pour afficher la preview du fond

## Tasks / Subtasks

- [x] **T1** — Modifier `BackgroundTab` dans `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` (AC: 1, 2)
  - [x] Ajouter l'import `MediaLibraryModal` depuis `@/components/media-library/MediaLibraryModal` en tête de fichier
  - [x] Ajouter `Asset` dans l'import de `@/types`
  - [x] Ajouter `const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)` dans `BackgroundTab`
  - [x] Ajouter le bouton "Choisir depuis la médiathèque" dans le rendu de `BackgroundTab`, avant le bouton upload
  - [x] Rendre `<MediaLibraryModal>` dans `BackgroundTab` avec `config={{ mode: "selector", filter: "images", initialFolder: "backgrounds" }}`
  - [x] Handler `handleAssetSelect` : convertir `Asset` → `AssetRef`, appeler `onSelect(ref)`, fermer la modale

### Review Findings

- [x] [Review][Decision] UploadDropZone en mode selector n'auto-sélectionne pas l'asset uploadé — RÉSOLU : comportement intentionnel, l'utilisateur clique manuellement sur la vignette — Le guard changé de `mode !== "navigation"` à `mode === "folder-selector"` rend la zone de drop visible dans les modales selector (ex. sélecteur de fond). Après upload, l'asset apparaît dans la grille mais n'est pas auto-sélectionné (`config.onSelect` n'est pas appelé). Intentionnel (l'auteur clique manuellement) ou gap à combler ?

## Dev Notes

### Périmètre — bornes strictes

**In scope :**
- `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` — uniquement la fonction `BackgroundTab` (définie en bas du fichier, lignes 651–761)

**Out of scope :**
- Aucune modification backend
- Aucun nouveau composant — `MediaLibraryModal` existant réutilisé
- Pas d'ajout à `bgCustomUploads` : le fond sélectionné depuis la médiathèque n'apparaît pas dans la galerie latérale "Décors disponibles" (hors scope de cette story — le fond est bien persisté et affiché dans la preview)
- Aucun autre fichier, aucun test Jest

### T1 — Modification de `BackgroundTab`

**Chemin réel du fichier** (différent de l'AC épique qui était indicatif) :
`frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx`

**Imports à ajouter en tête de fichier** (après les imports existants) :

```tsx
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";
```

Et ajouter `Asset` à l'import `@/types` existant (ligne 8) :

```tsx
import type { AssetRef, CharacterPosition, Scene, Story, StoryNode, NodeType, DialogueNodeData, Character, Asset } from "@/types";
```

**Dans la fonction `BackgroundTab`** (composant local, ligne 651) :

Ajouter au début du corps de la fonction (après `const currentUrl = ...`) :

```tsx
const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

const handleAssetSelect = (asset: Asset) => {
  const ref: AssetRef = {
    type: "upload",
    url: asset.url,
    opfs_key: null,
    job_id: null,
    mime_type: asset.content_type,
    width: null,
    height: null,
  };
  onSelect(ref);
  setIsMediaLibraryOpen(false);
};
```

**Bouton à insérer dans le JSX de `BackgroundTab`**, entre la liste `customUploads` et le bouton upload existant :

```tsx
<button
  onClick={() => setIsMediaLibraryOpen(true)}
  className="w-full py-3 rounded-md border border-white/10 hover:border-white/25 text-muted hover:text-fore text-sm transition-colors flex items-center justify-center gap-2"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  Choisir depuis la médiathèque
</button>
```

**Modale à rendre à la fin du return de `BackgroundTab`**, juste avant la fermeture du div racine `</div>` :

```tsx
<MediaLibraryModal
  config={{
    mode: "selector",
    filter: "images",
    initialFolder: "backgrounds",
    onSelect: handleAssetSelect,
  }}
  isOpen={isMediaLibraryOpen}
  onClose={() => setIsMediaLibraryOpen(false)}
/>
```

### Conversion Asset → AssetRef

- `Asset` (depuis médiathèque) : `{ id, filename, url, content_type, folder, is_seed }` — `url` est déjà le chemin relatif backend, ex. `/uploads/backgrounds/image.png`
- `AssetRef` (pour `scene.background_asset`) : `{ type, url, opfs_key, job_id, mime_type, width, height }`
- Utiliser `type: "upload"` — l'asset vient du backend
- `resolveAsset(ref)` depuis `@/lib/api` est déjà utilisé dans le reste du fichier — ne pas utiliser `asset.url` directement pour l'affichage

### Comportement de la galerie latérale

Après sélection depuis la médiathèque :
- La preview ScenePlayer affiche le nouveau fond correctement (via `scene.background_asset` rafraîchi par `mutateScene`)
- La galerie "Décors disponibles" n'affiche PAS le fond sélectionné (il n'est pas dans `DEFAULT_BACKGROUNDS` ni `bgCustomUploads`) — c'est attendu, hors scope
- Le fond est bien persisté en base via le `onSelect` existant de `SceneEditorPage` (`setBackground → api.scenes.update → mutateScene`)

### API MediaLibraryModal

Ne pas modifier `MediaLibraryModal.tsx`. Props existants :

```ts
interface Props {
  config: MediaLibraryConfig;
  isOpen: boolean;
  onClose: () => void;
}
```

`MediaLibraryConfig.onSelect?: (asset: Asset) => void` — c'est le callback appelé dans `AssetGrid` quand `mode === "selector"` et que l'utilisateur clique sur une vignette.

### Tests

**Pas de nouveaux tests Jest.** `BackgroundTab` est un sous-composant de page, non testé unitairement dans ce projet. Vérification manuelle :
- `npm test` depuis `frontend/` — 107 tests existants doivent rester verts (aucun test ne touche ce composant)
- Lancer backend `:8000` + `npm run dev` `:3000`, vérifier :
  1. Onglet "Décor" de l'éditeur de scène → bouton "Choisir depuis la médiathèque" visible
  2. Clic → `MediaLibraryModal` s'ouvre, dossier `backgrounds` présélectionné, mode sélecteur
  3. Clic sur une vignette → modale se ferme, fond de la scène mis à jour dans la preview
  4. Escape/backdrop → fermeture sans sélection

### Invariants à respecter

1. `MediaLibraryModal` importé depuis `@/components/media-library/MediaLibraryModal` — pas de barrel `index.ts`
2. `onSelect` dans `config` passé à `MediaLibraryModal` — pas à `onClose`
3. `useState` est déjà importé en ligne 3 — ne pas l'ajouter
4. `Asset` est ajouté à l'import existant `@/types` — ne pas créer un second import
5. Le `isMediaLibraryOpen` state est local à `BackgroundTab` (pas remonté dans `SceneEditorPage`)
6. Pas de `resolveAsset` dans `handleAssetSelect` — c'est `AssetRef.url` que l'on passe, `resolveAsset` est appelé à l'affichage dans `ScenePlayer` (déjà implémenté)

### Project Structure Notes

**Fichier modifié (1 fichier) :**
- `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` — modifications dans `BackgroundTab` uniquement

**Aucun fichier créé.** `MediaLibraryModal` et ses types sont déjà disponibles depuis l'Epic 2.

**Structure du fichier `edit/page.tsx` :**
- `SceneEditorPage` (composant principal) : lignes 29–522
- `NodesTab` (sous-composant) : lignes 526–647
- `BackgroundTab` (sous-composant) : lignes 651–761 — **zone de modification**

### References

- `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx:651-761` — `BackgroundTab` (composant cible)
- `frontend/components/media-library/MediaLibraryModal.tsx` — API props
- `frontend/types/index.ts:16-32` — types `Asset`, `AssetRef`, `MediaLibraryConfig`
- `frontend/lib/api.ts` — `resolveAsset`, `DEFAULT_BACKGROUNDS`, `API_BASE`
- `_bmad-output/planning-artifacts/epics.md` — Story 3.2 ACs + FR-2.1
- Story 3.1 (`3-1-acces-mediatheque-depuis-les-navbars.md`) — pattern MediaLibraryModal, style bouton, import sans barrel

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- T1 — `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` : import `MediaLibraryModal` + `Asset` ajouté, `isMediaLibraryOpen` state + `handleAssetSelect` dans `BackgroundTab`, bouton "Choisir depuis la médiathèque" inséré avant le bouton upload, `MediaLibraryModal` rendu avec `mode:"selector", filter:"images", initialFolder:"backgrounds"`.
- AC1 : bouton visible dans l'onglet Décor → ouvre la modale en mode sélecteur avec dossier `backgrounds` présélectionné.
- AC2 : sélection d'une vignette → `onSelect` appelé → `Asset` converti en `AssetRef` (`type:"upload"`) → `setBackground` persiste en base → `mutateScene` rafraîchit la preview. Modale se ferme. `resolveAsset` utilisé par `ScenePlayer` pour l'affichage (déjà en place).
- 107/107 tests Jest verts — aucune régression. Aucun nouveau test Jest (sous-composant de page non testé unitairement).

### File List

- `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` — MODIFIÉ : import MediaLibraryModal + Asset, BackgroundTab étendu avec sélecteur médiathèque

## Change Log

- 2026-06-15 — Story 3.2 créée (create-story workflow). Status → ready-for-dev.
- 2026-06-15 — Story 3.2 implémentée : bouton "Choisir depuis la médiathèque" dans l'onglet Décor. 107/107 tests verts. Status → review.
