---
baseline_commit: "7d52e84"
---

# Story 3.1 : Accès Médiathèque depuis les navbars (global et story)

Status: done

## Story

En tant qu'auteur,
je veux accéder à la médiathèque depuis la barre de navigation,
afin de gérer mes assets depuis n'importe quel écran de l'application.

## Acceptance Criteria

1. **Given** l'auteur est sur la page d'accueil
   **When** il clique sur le bouton "Médiathèque" dans la navbar
   **Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "navigation" }}`
   **And** la modale est accessible en 1 clic

2. **Given** l'auteur est sur la page story (`/stories/[id]`)
   **When** il clique sur le bouton "Médiathèque" dans la navbar story
   **Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "navigation" }}`

3. **Given** la modale est ouverte en mode navigation
   **When** l'auteur ferme la modale (bouton ×, Escape, ou clic backdrop)
   **Then** aucune valeur n'est retournée — la navigation reste sur l'écran courant

## Tasks / Subtasks

- [x] **T1** — Ajouter bouton "Médiathèque" + modale dans `app/page.tsx` (AC: 1, 3)
  - [x] Importer `MediaLibraryModal` depuis `@/components/media-library/MediaLibraryModal`
  - [x] Ajouter `const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)` dans `DashboardPage`
  - [x] Ajouter bouton "Médiathèque" dans le `<header>` à droite du logo Tellana (via `ml-auto`)
  - [x] Rendre `<MediaLibraryModal config={{ mode: "navigation" }} isOpen={isMediaLibraryOpen} onClose={() => setIsMediaLibraryOpen(false)} />`

- [x] **T2** — Ajouter bouton "Médiathèque" + modale dans `app/stories/[id]/page.tsx` (AC: 2, 3)
  - [x] Importer `MediaLibraryModal` depuis `@/components/media-library/MediaLibraryModal`
  - [x] Ajouter `const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)` dans `StoryEditorPage`
  - [x] Ajouter bouton "Médiathèque" dans la div `ml-auto flex items-center gap-2` du `<header>`, avant le lien Canvas
  - [x] Rendre `<MediaLibraryModal config={{ mode: "navigation" }} isOpen={isMediaLibraryOpen} onClose={() => setIsMediaLibraryOpen(false)} />`

## Dev Notes

### Périmètre — bornes strictes

**In scope :**
- `frontend/app/page.tsx` — bouton "Médiathèque" dans le header + état modal
- `frontend/app/stories/[id]/page.tsx` — bouton "Médiathèque" dans le header + état modal

**Out of scope :**
- `app/stories/[id]/canvas/page.tsx` — pas d'ajout dans cette story
- `app/stories/[id]/scenes/[sceneId]/edit/page.tsx` — pas d'ajout ici non plus
- Aucune modification backend
- Aucun nouveau composant — `MediaLibraryModal` existant est réutilisé
- Pas de layout.tsx créé — les navbars sont gérées dans les pages directement

### T1 — Modification de `app/page.tsx`

**État courant du header (lignes 54–68) :**
```tsx
<header className="border-b border-white/5 bg-sidebar/80 backdrop-blur-md sticky top-0 z-10">
  <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
    <div className="flex items-center gap-3">
      {/* logo Tellana */}
    </div>
  </div>
</header>
```

Le header a un div `.max-w-6xl ... flex items-center gap-4` avec seulement le logo à gauche — le côté droit est vide. Ajouter le bouton avec `ml-auto` dans ce div.

**Imports à ajouter en haut du fichier** (après les imports existants) :
```tsx
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";
```

**État à ajouter dans `DashboardPage` (avec les autres useState, lignes 17–20) :**
```tsx
const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
```

**Bouton à ajouter dans le header (après le div logo, DANS le div `.max-w-6xl`) :**
```tsx
<button
  onClick={() => setIsMediaLibraryOpen(true)}
  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  Médiathèque
</button>
```

**Modal à rendre dans `DashboardPage` return** (au même niveau que `ConfirmModal` existant, ligne 46–52) :
```tsx
<MediaLibraryModal
  config={{ mode: "navigation" }}
  isOpen={isMediaLibraryOpen}
  onClose={() => setIsMediaLibraryOpen(false)}
/>
```

### T2 — Modification de `app/stories/[id]/page.tsx`

**État courant du header :** Le header story a une div `ml-auto flex items-center gap-2` (ligne ~154) contenant dans l'ordre : Canvas, Export web, point amber, Publier, lien page publique, copier lien.

**Import à ajouter :**
```tsx
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";
```

**État à ajouter dans `StoryEditorPage` (avec les autres useState, lignes 24–30) :**
```tsx
const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
```

**Bouton à ajouter dans la div `ml-auto flex items-center gap-2`**, EN PREMIER (avant le lien Canvas) :
```tsx
<button
  onClick={() => setIsMediaLibraryOpen(true)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
  Médiathèque
</button>
```

**Modal à rendre dans le return de `StoryEditorPage`**, au même niveau que `AlertModal` (ligne ~107) :
```tsx
<MediaLibraryModal
  config={{ mode: "navigation" }}
  isOpen={isMediaLibraryOpen}
  onClose={() => setIsMediaLibraryOpen(false)}
/>
```

**ATTENTION** : Le bouton Médiathèque dans la story page doit être placé EN DEHORS du div ayant `editingCharacter ? "opacity-20 pointer-events-none" : ""` (qui enveloppe le titre et la flèche de retour). Le groupe `ml-auto` des boutons d'action n'est pas dans ce wrapper — le bouton Médiathèque y appartient donc bien.

### API MediaLibraryModal

Props existants (ne pas modifier le composant) :
```ts
interface Props {
  config: MediaLibraryConfig;
  isOpen: boolean;
  onClose: () => void;
}
```

Type `MediaLibraryConfig` depuis `@/types/index.ts` :
```ts
interface MediaLibraryConfig {
  mode: "navigation" | "selector" | "folder-selector";
  filter?: "images" | "all";
  onSelect?: (asset: Asset) => void;
  onSelectFolder?: (folder: string) => void;
  allowedFolders?: string[];
  initialFolder?: string;
}
```

`mode: "navigation"` = navigation libre, upload/rename/delete actifs, aucune valeur retournée à la fermeture.

### Style des boutons

Utiliser `bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors` — même style que le bouton Canvas et Export web dans la story navbar. Pas de `cursor-pointer` Tailwind (le reset CSS button est OK ici, ce sont de vrais `<button>`).

Icône : image/paysage SVG `M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z` — cohérente avec un concept "galerie".

### Tests

**Pas de nouveaux tests Jest.** Ce projet ne teste pas les pages-level components (tous les tests Jest existants ciblent des composants dans `components/`). L'ajout d'un `useState` + bouton + modal dans une page se vérifie manuellement ou via Playwright E2E (backend requis sur :8000).

**Vérification non-régression après implémentation :**
- `npm test` depuis `frontend/` : 107 tests existants — tous verts (aucune modification de composant)
- Lancer `npm run dev` + backend, vérifier :
  1. Page accueil : bouton "Médiathèque" visible à droite du logo → clic → modale s'ouvre en navigation
  2. Page `/stories/{id}` : bouton "Médiathèque" visible dans la navbar → clic → modale s'ouvre
  3. Fermeture modale : ×, Escape, clic backdrop → modale se ferme, aucune navigation

### Invariants à respecter

1. `MediaLibraryModal` est importé depuis `@/components/media-library/MediaLibraryModal` — pas de barrel `index.ts`
2. Le type `MediaLibraryConfig` est dans `@/types` — pas besoin de le réimporter si déjà les types sont importés
3. Le bouton dans la story page est toujours visible (pas dans le wrapper `opacity-20` du mode édition personnage)
4. Aucun prop `onSelect` ni `onSelectFolder` passé — mode navigation pur
5. Ne pas modifier `MediaLibraryModal.tsx` — utiliser son API existante

### Project Structure Notes

**Fichiers modifiés (2 fichiers) :**
- `frontend/app/page.tsx` — MODIFIÉ : import MediaLibraryModal, useState isMediaLibraryOpen, bouton header, modal render
- `frontend/app/stories/[id]/page.tsx` — MODIFIÉ : idem

**Aucun fichier créé.** `MediaLibraryModal` et son type sont déjà disponibles.

### References

- `frontend/components/media-library/MediaLibraryModal.tsx` — composant existant, API props
- `frontend/types/index.ts:25` — `MediaLibraryConfig` type
- `frontend/app/page.tsx:54-68` — header home page (état courant)
- `frontend/app/stories/[id]/page.tsx:111-241` — header story page + groupe ml-auto boutons
- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 3.1 ACs + FR-2.1

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- T1 — `app/page.tsx` : import MediaLibraryModal, state `isMediaLibraryOpen`, bouton "Médiathèque" avec icône image-paysage ajouté à droite du logo Tellana via `ml-auto`, modal rendu avant le header.
- T2 — `app/stories/[id]/page.tsx` : import MediaLibraryModal, state `isMediaLibraryOpen`, bouton "Médiathèque" inséré en première position dans la div `ml-auto flex items-center gap-2` (avant le lien Canvas), modal rendu juste après l'AlertModal.
- 107/107 tests Jest verts — aucune régression. Aucun nouveau test Jest (pages non testées unitairement dans ce projet, vérification via E2E).
- AC1 : bouton home page accessible en 1 clic → modale en mode navigation.
- AC2 : bouton story page → modale en mode navigation.
- AC3 : fermeture (×, Escape, backdrop) → aucune valeur retournée, navigation inchangée (comportement natif MediaLibraryModal existant).

### File List

- `frontend/app/page.tsx` — MODIFIÉ : import MediaLibraryModal, useState isMediaLibraryOpen, bouton header, modal render
- `frontend/app/stories/[id]/page.tsx` — MODIFIÉ : import MediaLibraryModal, useState isMediaLibraryOpen, bouton header, modal render

## Change Log

- 2026-06-15 — Story 3.1 créée (create-story workflow). Status → ready-for-dev.
- 2026-06-15 — Story 3.1 implémentée : bouton Médiathèque dans navbars home + story. 107/107 tests verts. Status → review.
