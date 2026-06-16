---
baseline_commit: 57e2e788826dff72cf1c665e31802dcaf983fb41
---

# Story 2.1 : Modale MediaLibraryModal et navigation de dossiers (FolderTree)

Status: done

## Story

En tant qu'auteur,
je veux ouvrir une modale médiathèque et naviguer dans l'arborescence de dossiers,
afin de trouver rapidement les assets organisés par catégorie.

## Acceptance Criteria

1. **Given** un composant parent qui passe `config: MediaLibraryConfig`
   **When** la modale s'ouvre (`isOpen=true`)
   **Then** `MediaLibraryModal` reçoit `config: MediaLibraryConfig` + `isOpen: boolean` + `onClose: () => void`
   **And** la modale est pleine-largeur avec panneau gauche `FolderTree` (`w-64`) + zone droite placeholder (pour `AssetGrid` en story 2.2)

2. **Given** `GET /api/assets/folders` retourne `["backgrounds", "characters", "characters/alice"]`
   **When** `FolderTree` se monte via `useSWR("asset-folders", api.assets.getFolders)`
   **Then** l'arborescence est dérivée en mémoire et affichée hiérarchiquement
   **And** `characters/` est un nœud parent avec `alice` comme enfant indented

3. **Given** l'utilisateur clique sur un dossier dans `FolderTree`
   **When** la sélection change
   **Then** `currentFolder` est mis à jour dans l'état de `MediaLibraryModal`
   **And** si `config.allowedFolders` est défini, seuls les dossiers correspondants (exact + sous-dossiers `dossier/`) sont navigables
   **And** si `config.mode === "folder-selector"` et un dossier est sélectionné, un bouton "Sélectionner ce dossier" apparaît et appelle `config.onSelectFolder(folder)` puis ferme la modale

4. **Given** `config.initialFolder` est fourni
   **When** la modale s'ouvre
   **Then** ce dossier est présélectionné dans `FolderTree` et `currentFolder` est initialisé avec cette valeur

5. **Given** l'auteur est dans `FolderTree` en mode navigation (`config.mode === "navigation"`)
   **When** il clique sur "Nouveau dossier" et saisit un nom
   **Then** `POST /api/assets` est appelé avec `folder="${currentFolder}/${name}"` (ou `name` si aucun dossier courant) et un fichier vide `.keep` (`content_type="application/x-empty"`)
   **And** `mutate("asset-folders")` est appelé
   **And** le nouveau dossier apparaît dans `FolderTree` (le `.keep` sera filtré dans `AssetGrid` en story 2.2)

## Tasks / Subtasks

- [x] **T1** — Backend : chemin `.keep` dans `create_asset` (AC: 5)
  - [x] Dans `backend/routers/assets.py`, déplacer `filename = Path(...)` avant `_validate_image`
  - [x] Ajouter bloc early-return pour `filename == ".keep"` : idempotent si existant, sinon crée dossier + touch file + INSERT avec `content_type="application/x-empty"` (voir dev notes)
  - [x] Test dans `backend/tests/test_assets.py` : upload `.keep` → 200, asset retourné avec `filename=".keep"` et `content_type="application/x-empty"` ; re-upload → même id (idempotence)

- [x] **T2** — Types et API client (AC: 1)
  - [x] Ajouter `MediaLibraryConfig` dans `frontend/types/index.ts` (voir dev notes pour l'interface complète)
  - [x] Ajouter `api.assets.getFolders()` dans `frontend/lib/api.ts` → `GET /api/assets/folders` → `Promise<string[]>`
  - [x] Ajouter `api.assets.list(folder)` dans `frontend/lib/api.ts` → `GET /api/assets?folder=X` → `Promise<Asset[]>` (utilisé en story 2.2 par AssetGrid, à créer maintenant)

- [x] **T3** — `FolderTree.tsx` (AC: 2, 3, 4, 5)
  - [x] Créer `frontend/components/media-library/FolderTree.tsx` avec `"use client"`
  - [x] `useSWR("asset-folders", api.assets.getFolders)` pour charger la liste plate
  - [x] Filtrer les dossiers via `config.allowedFolders` (voir dev notes)
  - [x] `buildTree(folders)` pour dériver l'arborescence en mémoire (voir dev notes — algo à reproduire tel quel)
  - [x] Affichage hiérarchique : dossier sélectionné mis en évidence, enfants indentés (`pl-4`)
  - [x] Clic sur un nœud → appelle prop `onSelectFolder(path)`
  - [x] Bouton "Nouveau dossier" visible uniquement en mode `navigation` : prompt → POST `.keep` → `mutate()`

- [x] **T4** — `MediaLibraryModal.tsx` (AC: 1, 3, 4)
  - [x] Créer `frontend/components/media-library/MediaLibraryModal.tsx` avec `"use client"`
  - [x] Props : `config: MediaLibraryConfig`, `isOpen: boolean`, `onClose: () => void`
  - [x] `if (!isOpen) return null`
  - [x] État : `currentFolder` initialisé depuis `config.initialFolder ?? null`
  - [x] Layout overlay + conteneur : voir dev notes pour le JSX complet
  - [x] Panneau gauche : `<FolderTree>` + bouton "Sélectionner ce dossier" en bas (si mode `folder-selector` + dossier sélectionné)
  - [x] Zone droite placeholder (remplacée par AssetGrid en story 2.2)
  - [x] Fermeture : bouton `×` + clic backdrop + Escape

- [x] **T5** — Tests frontend (AC: 1, 2, 3)
  - [x] Créer `frontend/__tests__/media-library/FolderTree.test.tsx` : mock SWR → vérifie l'affichage hiérarchique ; clic folder → callback ; filtrage `allowedFolders`
  - [x] Créer `frontend/__tests__/media-library/MediaLibraryModal.test.tsx` : `isOpen=false` → non rendu ; `isOpen=true` → FolderTree visible ; bouton `×` → `onClose` ; mode `folder-selector` + dossier sélectionné → "Sélectionner ce dossier" visible

### Review Findings

- [x] [Review][Patch] buildTree crash quand allowedFolders filtre les dossiers parents [`frontend/components/media-library/FolderTree.tsx:20`] — filtre étendu avec `|| a.startsWith(f + "/")` pour inclure les segments ancêtres
- [x] [Review][Patch] `config.onSelectFolder!` runtime crash si prop absente [`frontend/components/media-library/MediaLibraryModal.tsx:62`] — remplacé par `config.onSelectFolder?.(currentFolder)`
- [x] [Review][Patch] `handleNewFolder` avale silencieusement les erreurs fetch [`frontend/components/media-library/FolderTree.tsx:94`] — `res.ok` vérifié, early return si erreur
- [x] [Review][Patch] `getFolders`/`list` utilisent `fetch` brut — body d'erreur retourné à SWR au lieu d'une exception [`frontend/lib/api.ts`] — guard `if (!r.ok) throw new Error(...)` ajouté
- [x] [Review][Patch] Bouton "Sélectionner ce dossier" peut scroller hors de vue sur liste longue [`frontend/components/media-library/MediaLibraryModal.tsx:52`] — `overflow-y-auto` supprimé du div `w-64`
- [x] [Review][Defer] Grande requête `.keep` bufferisée sans vérification de taille [`backend/routers/assets.py`] — deferred, MVPscope
- [x] [Review][Defer] `prompt()` pour la création de dossier [`frontend/components/media-library/FolderTree.tsx:88`] — deferred, décision MVP documentée
- [x] [Review][Defer] Assets `.keep` visibles dans la liste `GET /api/assets?folder=X` [`backend/routers/assets.py`] — deferred, filtrage prévu en story 2.2
- [x] [Review][Defer] Race TOCTOU sur INSERT `.keep` [`backend/routers/assets.py`] — deferred, SQLite mono-writer prototype
- [x] [Review][Defer] `currentFolder` réinitialisé si `initialFolder` change pendant que la modale est ouverte [`frontend/components/media-library/MediaLibraryModal.tsx:18`] — deferred, improbable en pratique MVP

## Dev Notes

### Périmètre — bornes strictes

**In scope :** backend `.keep`, types `MediaLibraryConfig`, `FolderTree`, `MediaLibraryModal` shell, méthodes API `getFolders`/`list`
**Out of scope (stories suivantes) :**
- `AssetGrid.tsx` (story 2.2) — zone droite = placeholder texte uniquement
- `UploadDropZone.tsx` (story 2.3)
- Rename/delete assets (story 2.4)
- Seeds Alice & Bob (story 2.5)
- Boutons navbar + sélecteurs fond/sprite (Epic 3)

Ne pas tenter d'implémenter `AssetGrid` dans cette story même si c'est tentant.

### Backend — patch `create_asset` pour `.keep`

**Problème :** `_validate_image(content)` (ligne 81 de `assets.py`) rejette tout contenu non-image. Les fichiers `.keep` (Blob vide) échouent la validation.

**Modification à apporter** — dans `create_asset` (lignes 79-113), restructurer le début ainsi :

```python
folder = _normalize_folder(folder)
content = await file.read()
filename = Path(file.filename or "upload").name  # déplacé avant _validate_image

# .keep: placeholder pour dossier vide — bypass image validation (idempotent)
if filename == ".keep":
    existing_keep = (
        db.query(models.Asset)
        .filter(models.Asset.folder == folder, models.Asset.filename == ".keep")
        .first()
    )
    if existing_keep:
        return existing_keep
    (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / folder / ".keep").touch()
    keep_asset = models.Asset(
        filename=".keep",
        url=f"/uploads/{folder}/.keep",
        content_type="application/x-empty",
        folder=folder,
    )
    db.add(keep_asset)
    db.commit()
    db.refresh(keep_asset)
    return keep_asset

mime = _validate_image(content)
# ... reste inchangé (existing query, replace logic, normal insert)
```

`filename` est maintenant calculé avant `_validate_image` — c'est le seul réordonnancement. Le reste de la fonction (`existing` query, chemin `replace`, INSERT normal) reste identique.

### Type `MediaLibraryConfig` — ajout dans `frontend/types/index.ts`

Ajouter après l'interface `Asset` existante :

```typescript
export interface MediaLibraryConfig {
  mode: "navigation" | "selector" | "folder-selector";
  filter?: "images" | "all";
  onSelect?: (asset: Asset) => void;
  onSelectFolder?: (folder: string) => void;
  allowedFolders?: string[];
  initialFolder?: string;
}
```

`Asset` est déjà défini dans ce fichier (lignes 16-23) — pas d'import supplémentaire.

### API methods — ajout dans `frontend/lib/api.ts`

Dans l'objet `api.assets` (actuellement uniquement `upload`), ajouter :

```typescript
assets: {
  upload: async (file: File): Promise<AssetRef> => { ... },  // existant, ne pas toucher
  getFolders: (): Promise<string[]> =>
    fetch(`${API_BASE}/api/assets/folders`).then(r => r.json()),
  list: (folder: string): Promise<Asset[]> =>
    fetch(`${API_BASE}/api/assets?folder=${encodeURIComponent(folder)}`).then(r => r.json()),
},
```

Ajouter `import type { Asset } from "@/types"` en tête de `api.ts` (actuellement seul `AssetRef` est importé depuis `@/types`).

### Algorithme `buildTree` — reproduire tel quel

```typescript
type TreeNode = { name: string; path: string; children: TreeNode[] }

function buildTree(folders: string[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  for (const path of folders) {
    const parts = path.split("/")
    for (let i = 0; i < parts.length; i++) {
      const fullPath = parts.slice(0, i + 1).join("/")
      if (!map.has(fullPath)) {
        const node: TreeNode = { name: parts[i], path: fullPath, children: [] }
        map.set(fullPath, node)
        if (i === 0) roots.push(node)
        else map.get(parts.slice(0, i).join("/"))!.children.push(node)
      }
    }
  }
  return roots
}
```

`buildTree(["backgrounds", "characters", "characters/alice"])` → `[{name:"backgrounds",path:"backgrounds",children:[]}, {name:"characters",path:"characters",children:[{name:"alice",path:"characters/alice",children:[]}]}]`

### Filtrage `allowedFolders`

Appliqué sur la liste plate **avant** `buildTree` :

```typescript
const filtered = config.allowedFolders
  ? folders.filter(f =>
      config.allowedFolders!.some(a => f === a || f.startsWith(a + "/"))
    )
  : folders
const tree = buildTree(filtered)
```

### Flux "Nouveau dossier"

```typescript
const handleNewFolder = async () => {
  const name = prompt("Nom du nouveau dossier :")?.trim()
  if (!name) return
  const folder = selectedFolder ? `${selectedFolder}/${name}` : name
  const formData = new FormData()
  formData.append("file", new Blob([], { type: "application/x-empty" }), ".keep")
  formData.append("folder", folder)
  await fetch(`${API_BASE}/api/assets`, { method: "POST", body: formData })
  await mutate()  // mutate lié à useSWR("asset-folders")
}
```

`prompt()` natif est acceptable pour le MVP. Bouton "Nouveau dossier" uniquement si `config.mode === "navigation"`.

### `MediaLibraryModal.tsx` — JSX complet

```tsx
"use client"

import { useEffect, useState } from "react"
import type { MediaLibraryConfig } from "@/types"
import FolderTree from "./FolderTree"

interface Props {
  config: MediaLibraryConfig
  isOpen: boolean
  onClose: () => void
}

export default function MediaLibraryModal({ config, isOpen, onClose }: Props) {
  const [currentFolder, setCurrentFolder] = useState<string | null>(
    config.initialFolder ?? null
  )

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-bg border border-white/10 rounded-lg shadow-2xl w-full max-w-5xl mx-4 h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-fore font-semibold">Médiathèque</h2>
          <button onClick={onClose} className="text-muted hover:text-fore text-xl leading-none">×</button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-white/10 flex flex-col flex-shrink-0 overflow-y-auto">
            <FolderTree
              config={config}
              selectedFolder={currentFolder}
              onSelectFolder={setCurrentFolder}
            />
            {config.mode === "folder-selector" && currentFolder && (
              <div className="p-3 flex-shrink-0">
                <button
                  onClick={() => { config.onSelectFolder!(currentFolder); onClose() }}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-sm"
                >
                  Sélectionner ce dossier
                </button>
              </div>
            )}
          </div>
          {/* Zone droite — placeholder remplacé par AssetGrid en story 2.2 */}
          <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
            {currentFolder ? `Dossier : ${currentFolder}` : "Sélectionnez un dossier"}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Note :** Réinitialiser `currentFolder` à `config.initialFolder ?? null` quand `isOpen` passe à `true` (si le parent réutilise l'instance modale). Ajouter un `useEffect([isOpen])` si nécessaire.

### `FolderTree.tsx` — structure des props

```typescript
interface FolderTreeProps {
  config: MediaLibraryConfig   // pour mode + allowedFolders
  selectedFolder: string | null
  onSelectFolder: (folder: string) => void
}
```

### Clés SWR — convention stricte (Architecture D5)

| Clé | Fetcher | Invalidation |
|-----|---------|--------------|
| `"asset-folders"` | `api.assets.getFolders` | après création dossier (story 2.1), upload, rename dossier |
| `["assets", folder]` | `api.assets.list(folder)` | après upload, rename, delete (stories 2.2–2.4) |

Toujours invalider **les deux** après toute mutation d'asset. En story 2.1, seul `mutate("asset-folders")` est appelé (pas de mutation d'assets).

### Tests — pattern mock SWR

```typescript
import useSWR from "swr"
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))
const mockUseSWR = useSWR as jest.Mock

beforeEach(() => {
  mockUseSWR.mockReturnValue({
    data: ["backgrounds", "characters", "characters/alice"],
    mutate: jest.fn(),
  })
})
```

Mock `@/lib/api` — inclure `randomCharacterColor` (requis globalement dans le projet) :
```typescript
jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: { assets: { getFolders: jest.fn(), list: jest.fn() } },
  randomCharacterColor: () => "#FF6B6B",
}))
```

### État du backend Epic 1 (référence)

| Endpoint | Status | Story |
|----------|--------|-------|
| `GET /api/assets/folders` | ✅ opérationnel | 1.2 |
| `GET /api/assets?folder=X` | ✅ opérationnel | 1.2 |
| `POST /api/assets` (avec folder, collision 409, replace) | ✅ opérationnel | 1.3 + 1.5 |
| `_normalize_folder` (anti path-traversal) | ✅ présent | Code review Epic 1 |
| `Asset.folder` + `Asset.is_seed` | ✅ en DB + schéma | 1.1 |

Le seul changement backend de story 2.1 est le chemin `.keep` dans `create_asset`.

### Project Structure Notes

- `components/media-library/` : créer le répertoire, **pas de fichier `index.ts`** barrel
- `__tests__/media-library/` : respecte `testMatch: __tests__/**/*.test.(ts|tsx)`
- `"use client"` sur `MediaLibraryModal.tsx` et `FolderTree.tsx` (obligatoire — composants interactifs)
- Pas de `useMemo`/`useCallback` manuels — React Compiler optimise
- Design tokens : `bg-bg`, `bg-elevated`, `text-fore`, `text-muted`, `bg-primary hover:bg-primary-hover` — jamais `slate-*`/`zinc-*`
- Border radius : `rounded-lg` (modal container), `rounded-md` (bouton sélectionner)
- Modal z-index : `z-50` (cohérent avec `ConfirmModal`)

### References

- Architecture : `_bmad-output/planning-artifacts/architecture.md` — D3 (placeholder .keep), D4 (structure `components/media-library/`), D5 (clés SWR), "Naming Patterns", "Process Patterns — Dossier vide", `MediaLibraryConfig` (type complet)
- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 2.1 (AC complets), FR-2.2 (panneau dossiers + grille), FR-2.4 (modes navigation/sélecteur)
- Project context : `_bmad-output/project-context.md` — `"use client"`, SWR pattern, `resolveAsset`, design tokens, pas de `useMemo`/`useCallback`
- Code existant clé : `backend/routers/assets.py` lignes 72-113 (`create_asset` — état exact avant patch), `frontend/types/index.ts` lignes 16-23 (`Asset`, pour référencer dans `MediaLibraryConfig`), `frontend/lib/api.ts` lignes 172-192 (`api.assets.upload` — ne pas modifier), `frontend/components/ConfirmModal.tsx` (pattern overlay à reproduire pour `MediaLibraryModal`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- TDD respecté : tests écrits en RED, confirmés failing, puis GREEN à chaque étape.
- T1 — Backend : `filename` déplacé avant `_validate_image` dans `create_asset` ; bloc early-return `.keep` idempotent (touch file + INSERT, retourne existant si déjà présent). 3 tests ajoutés, 117/117 backend verts.
- T2 — `MediaLibraryConfig` ajouté dans `frontend/types/index.ts` ; `api.assets.getFolders()` et `api.assets.list(folder)` ajoutés dans `frontend/lib/api.ts` ; import `Asset` ajouté.
- T3 — `FolderTree.tsx` : `buildTree()` dérive l'arborescence en mémoire depuis la liste plate ; filtrage `allowedFolders` sur la liste avant construction ; `data-selected` pour le dossier actif ; bouton "Nouveau dossier" en mode `navigation` uniquement ; `handleNewFolder` via `prompt()` natif + POST `.keep` + `mutate()`.
- T4 — `MediaLibraryModal.tsx` : `if (!isOpen) return null` ; `currentFolder` réinitialisé via `useEffect([isOpen])` ; Escape via `useEffect([isOpen, onClose])` ; layout overlay `fixed inset-0 z-50` + panneau gauche `w-64` + placeholder droite ; bouton "Sélectionner ce dossier" conditionnel (mode `folder-selector` + dossier choisi).
- T5 — 10 tests FolderTree + 9 tests MediaLibraryModal, 88/88 frontend verts, 0 erreur TypeScript.
- Aucune régression : toutes les suites backend (117) et frontend (88) passent.

### File List

- `backend/routers/assets.py` — MODIFIÉ : bloc `.keep` early-return dans `create_asset` (déplacement `filename` + bypass image validation)
- `backend/tests/test_assets.py` — MODIFIÉ : 3 tests story 2.1 (`test_upload_keep_creates_folder_placeholder`, `test_upload_keep_is_idempotent`, `test_upload_keep_appears_in_folders_list`)
- `frontend/types/index.ts` — MODIFIÉ : ajout interface `MediaLibraryConfig`
- `frontend/lib/api.ts` — MODIFIÉ : import `Asset`, ajout `api.assets.getFolders()` et `api.assets.list(folder)`
- `frontend/components/media-library/FolderTree.tsx` — NOUVEAU
- `frontend/components/media-library/MediaLibraryModal.tsx` — NOUVEAU
- `frontend/__tests__/media-library/FolderTree.test.tsx` — NOUVEAU
- `frontend/__tests__/media-library/MediaLibraryModal.test.tsx` — NOUVEAU

## Change Log

- 2026-06-14 — Story 2.1 implémentée : backend `.keep` (bypass image validation, idempotent), type `MediaLibraryConfig`, API `getFolders`/`list`, composants `FolderTree` + `MediaLibraryModal` avec `buildTree`, filtrage `allowedFolders`, modes navigation/selector/folder-selector. 19 tests ajoutés (3 backend + 16 frontend), 117/117 backend et 88/88 frontend verts. Status → review.
