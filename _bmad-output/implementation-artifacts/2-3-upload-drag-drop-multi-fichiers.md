---
baseline_commit: "54a1014"
---

# Story 2.3 : Upload drag & drop multi-fichiers (UploadDropZone)

Status: done

## Story

En tant qu'auteur,
je veux déposer plusieurs fichiers d'un coup dans le dossier courant,
afin d'uploader rapidement un lot d'images sans les sélectionner un par un.

## Acceptance Criteria

1. **Given** l'utilisateur glisse des fichiers sur la zone de drop dans le dossier courant
   **When** le drop se produit
   **Then** chaque fichier est envoyé en `POST /api/assets` avec `folder=currentFolder` en multipart
   **And** les uploads se font en parallèle

2. **Given** tous les uploads sont terminés
   **When** les réponses `200` sont reçues
   **Then** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble
   **And** les nouveaux assets apparaissent immédiatement dans `AssetGrid` sans rechargement

3. **Given** un fichier uploadé a le même `filename` qu'un asset existant dans `currentFolder`
   **When** le backend répond `409 Conflict { existing_id, references: { scenes, nodes } }`
   **Then** un `ConfirmModal` s'affiche : `"Ce fichier remplacera "{filename}" utilisé dans {scenes} scène(s) et {nodes} nœud(s). Continuer ?"`
   **And** si confirmé → `POST /api/assets?replace=true` est envoyé
   **And** si annulé → l'upload de ce fichier est ignoré, les autres continuent

4. **Given** l'utilisateur sélectionne 10 fichiers image en une seule opération
   **When** tous sont droppés
   **Then** tous les 10 sont uploadés avec succès

## Tasks / Subtasks

- [x] **T1** — Ajouter `api.assets.uploadMedia` dans `frontend/lib/api.ts` (AC: 1, 3)
  - [x] Ajouter la méthode `uploadMedia(file: File, folder: string, replace?: boolean)` dans l'objet `api.assets`
  - [x] Appeler `POST /api/assets` (pas `/api/assets/upload`) avec `FormData` (champs `file` + `folder`)
  - [x] Si `replace=true` → ajouter `?replace=true` en query string
  - [x] Retour discriminé : `{ ok: true; asset: Asset }` si succès, `{ ok: false; status: 409; existing_id: number; references: { scenes: number; nodes: number } }` si conflit
  - [x] Ne pas utiliser `request<T>()` — ce helper jette sur tout non-OK ; utiliser `fetch` brut

- [x] **T2** — Créer `frontend/components/media-library/UploadDropZone.tsx` (AC: 1, 2, 3, 4)
  - [x] `"use client"` en tête
  - [x] Props : `{ folder: string; config: MediaLibraryConfig }`
  - [x] Retourner `null` si `config.mode !== "navigation"` (upload uniquement en mode navigation)
  - [x] State : `dragging: boolean`, `conflicts: ConflictInfo[]`
  - [x] `useSWRConfig()` pour récupérer `mutate` global (import `{ useSWRConfig } from "swr"`)
  - [x] Zone visuelle : `border-2 border-dashed rounded-md`, fond `border-primary bg-primary/10` si `dragging`, sinon `border-white/20 text-muted hover:border-white/40`
  - [x] Texte : `"Déposer des fichiers ici ou cliquer pour sélectionner"`
  - [x] `<input type="file" multiple accept="image/*" className="sr-only" />` déclenché au clic sur la zone (via `useRef`)
  - [x] Handlers drag : `onDragEnter`/`onDragOver` → `e.preventDefault()` + `setDragging(true)` ; `onDragLeave` → `setDragging(false)` ; `onDrop` → `e.preventDefault()` + `setDragging(false)` + traitement
  - [x] `handleFiles(files: FileList | File[])` : `await Promise.allSettled([...files].map(f => uploadFile(f)))` puis `mutate(["assets", folder])` + `mutate("asset-folders")`
  - [x] `uploadFile(file, replace=false)` : appelle `api.assets.uploadMedia` ; si résultat `ok: false` → ajoute à `conflicts` state
  - [x] Afficher `<ConfirmModal>` pour `conflicts[0]` (un à la fois) — Confirm : appelle `uploadFile(file, true)` + mutate pair + shift conflicts ; Cancel : shift conflicts uniquement

- [x] **T3** — Modifier `frontend/components/media-library/AssetGrid.tsx` pour intégrer `UploadDropZone` (AC: 1, 2)
  - [x] Importer `UploadDropZone` depuis `"./UploadDropZone"`
  - [x] Remplacer l'early-return "Dossier vide" par un affichage conditionnel inline
  - [x] Si `folder` sélectionné : afficher `<UploadDropZone folder={folder} config={config} />` en haut du panneau (avant la grille ou le message "vide")
  - [x] "Dossier vide" devient `<div className="text-muted text-sm text-center py-4">Dossier vide</div>` dans le flux, non un return précoce
  - [x] Layout : `<div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">` englobant UploadDropZone + grille/message

- [x] **T4** — Tests frontend (AC: 1, 2, 3, 4)
  - [x] Créer `frontend/__tests__/media-library/UploadDropZone.test.tsx`
  - [x] Test 1 : en mode `navigation` + folder, la zone de drop est rendue
  - [x] Test 2 : en mode `selector`, la zone de drop ne rend rien (null)
  - [x] Test 3 : drop d'un fichier → `uploadMedia` appelé avec le bon folder, `mutate` appelé après
  - [x] Test 4 : réponse 409 → `ConfirmModal` affiché avec le bon message (filename + references)
  - [x] Test 5 : clic Confirmer dans ConfirmModal → `uploadMedia` appelé avec `replace=true`
  - [x] Test 6 : clic Annuler dans ConfirmModal → `uploadMedia replace` non appelé, conflit suivant affiché
  - [x] Modifier `frontend/__tests__/media-library/AssetGrid.test.tsx` : ajouter mock `UploadDropZone` (isolation, même pattern que AssetGrid mocké dans MediaLibraryModal.test.tsx)

### Review Findings

- [x] [Review][Patch] Input file non réinitialisé après sélection : re-upload du même fichier impossible via le bouton [frontend/components/media-library/UploadDropZone.tsx — onChange handler]
- [x] [Review][Patch] `e.stopPropagation()` manquant dans `handleDrop` (spec Dev Notes l'exige explicitement) [frontend/components/media-library/UploadDropZone.tsx — handleDrop]
- [x] [Review][Patch] Tests ne couvrent pas le chemin drag-drop réel (`fireEvent.drop`) — seul le path `<input onChange>` est testé [frontend/__tests__/media-library/UploadDropZone.test.tsx]
- [x] [Review][Defer] Silent failure : erreurs réseau/500 avalées sans feedback utilisateur [UploadDropZone.tsx:uploadFile] — deferred, hors scope spec
- [x] [Review][Defer] setState sur composant démonté (uploadFile résout après unmount) [UploadDropZone.tsx:uploadFile] — deferred, non-issue React 19 en pratique
- [x] [Review][Defer] onConfirm replace sans `.catch` : grid non rafraîchi si le replace échoue [UploadDropZone.tsx:onConfirm] — deferred, lié au gap error handling global
- [x] [Review][Defer] 409 body malformé → NaN dans le message modal [api.ts:uploadMedia] — deferred, validation défensive hors scope prototype
- [x] [Review][Defer] Flash "Dossier vide" au changement de dossier — déjà déféré en 2.2 [AssetGrid.tsx] — deferred, comportement SWR standard
- [x] [Review][Defer] accept="image/*" bypassé via drag depuis l'OS — validation MIME côté backend [UploadDropZone.tsx:input] — deferred, hors scope

## Dev Notes

### Périmètre — bornes strictes

**In scope :**
- `api.assets.uploadMedia` dans `api.ts` — nouvelle méthode uniquement
- `UploadDropZone.tsx` — nouveau composant
- Patch `AssetGrid.tsx` — intégration UploadDropZone + refactor "dossier vide" early-return
- `UploadDropZone.test.tsx` — nouveau fichier de tests
- Patch `AssetGrid.test.tsx` — mock UploadDropZone

**Out of scope (stories suivantes) :**
- Renommage inline (story 2.4)
- Bouton × suppression (story 2.4)
- Seeds Alice & Bob (story 2.5)
- Affichage de la progression d'upload (barre de progression) — non demandé

### Endpoint backend — contrat API complet

`POST /api/assets` (existant depuis story 1.3) :

```
multipart/form-data:
  file: File
  folder: str  (Form, défaut "backgrounds")
query:
  replace: bool  (Query, défaut False)
```

**Réponses :**
- `200 Asset` — upload réussi (nouveau asset ou asset existant mis à jour si `replace=true`)
- `409 Conflict` — fichier avec même `(folder, filename)` existe, `replace=false`

```json
// 409 body
{
  "existing_id": 42,
  "references": { "scenes": 2, "nodes": 1 }
}
```

**ATTENTION :** Ne PAS appeler `/api/assets/upload` (l'ancien endpoint sans `folder`, retourne `AssetRef` et non `Asset`).

### `api.assets.uploadMedia` — implémentation exacte

```typescript
// Dans l'objet api.assets, après getFolders et list :
uploadMedia: async (
  file: File,
  folder: string,
  replace = false
): Promise<
  | { ok: true; asset: Asset }
  | { ok: false; status: 409; existing_id: number; references: { scenes: number; nodes: number } }
> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const res = await fetch(
    `${API_BASE}/api/assets${replace ? "?replace=true" : ""}`,
    { method: "POST", body: formData }
  );
  if (res.status === 409) {
    const data = await res.json();
    return { ok: false, status: 409, ...data };
  }
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return { ok: true, asset: await res.json() };
},
```

Type `Asset` est importé depuis `@/types` — déjà importé en tête de `api.ts`.

### `UploadDropZone.tsx` — structure complète

```typescript
type ConflictInfo = {
  file: File;
  existingId: number;
  references: { scenes: number; nodes: number };
};
```

**Flux upload :**
```
handleFiles(files)
  → Promise.allSettled(files.map(f => uploadFile(f)))
  → pour chaque résultat ok:false → push ConflictInfo dans state
  → mutate(["assets", folder]) + mutate("asset-folders")
  // Les conflicts sont affichés un à un via ConfirmModal
  // Chaque confirm → uploadFile(file, true) + mutate pair
```

**Gestion ConfirmModal :**
- Toujours afficher `conflicts[0]` uniquement
- Confirm : `uploadFile(pending.file, true)` + mutate pair + `setConflicts(prev => prev.slice(1))`
- Cancel : `setConflicts(prev => prev.slice(1))` uniquement

**Message ConfirmModal :**
```
`Ce fichier remplacera "${conflictInfo.file.name}" utilisé dans ${conflictInfo.references.scenes} scène(s) et ${conflictInfo.references.nodes} nœud(s). Continuer ?`
```

Note UX : Le bouton de confirmation de `ConfirmModal` est libellé "Supprimer" (composant existant non modifiable dans cette story). C'est acceptable MVP — le message rend l'action claire.

### `ConfirmModal` — props existants

```typescript
interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

Composant à `frontend/components/ConfirmModal.tsx`. Import : `import ConfirmModal from "@/components/ConfirmModal"`.

### `useSWRConfig` — pattern d'invalidation

```typescript
import { useSWRConfig } from "swr";

export default function UploadDropZone({ folder, config }) {
  const { mutate } = useSWRConfig();
  // ...
  // Après upload réussi :
  await mutate(["assets", folder]);
  await mutate("asset-folders");
}
```

**Clés canoniques (règle absolue) :** `["assets", folder]` (tableau) + `"asset-folders"` (string). Toujours les deux ensemble après toute mutation upload.

### `AssetGrid.tsx` — refactor layout

Avant (avec early-returns) :
```tsx
if (!folder) return <div>Sélectionnez un dossier</div>;
if (assets.length === 0) return <div>Dossier vide</div>;
return <div className="flex-1 p-4 overflow-y-auto"><grid/></div>;
```

Après (avec UploadDropZone intégré) :
```tsx
if (!folder) {
  return <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">Sélectionnez un dossier</div>;
}
return (
  <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
    <UploadDropZone folder={folder} config={config} />
    {assets.length === 0 ? (
      <div className="text-muted text-sm text-center py-4">Dossier vide</div>
    ) : (
      <div className="grid grid-cols-4 gap-3">
        {assets.map((asset) => (/* ...card existante... */))}
      </div>
    )}
  </div>
);
```

`UploadDropZone` retourne `null` si `config.mode !== "navigation"` — aucune condition à ajouter dans AssetGrid.

### Tests — patterns

#### `UploadDropZone.test.tsx` — mocks requis

```typescript
const mockMutate = jest.fn();
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: {
    assets: {
      uploadMedia: jest.fn(),
    },
  },
  randomCharacterColor: () => "#FF6B6B",
}));

import { api } from "@/lib/api";
const mockUploadMedia = api.assets.uploadMedia as jest.Mock;
```

#### Simulation de drop dans les tests

```typescript
import { fireEvent, render, screen, act } from "@testing-library/react";

const file = new File(["content"], "photo.png", { type: "image/png" });
const dropZone = screen.getByText(/déposer/i).parentElement!; // ou getByRole("button") selon le markup

await act(async () => {
  fireEvent.drop(dropZone, {
    dataTransfer: { files: [file] },
  });
});
```

Ou cibler plus précisément :
```typescript
const zone = screen.getByText(/déposer des fichiers/i).closest("div")!;
```

#### Pattern mock réponse 409

```typescript
mockUploadMedia.mockResolvedValueOnce({
  ok: false,
  status: 409,
  existing_id: 5,
  references: { scenes: 2, nodes: 1 },
});
```

#### Patch `AssetGrid.test.tsx` — mock `UploadDropZone`

Ajouter dans `AssetGrid.test.tsx` (même pattern que AssetGrid dans MediaLibraryModal.test.tsx) :

```typescript
jest.mock("@/components/media-library/UploadDropZone", () => ({
  __esModule: true,
  default: ({ folder }: { folder: string }) => (
    <div data-testid="upload-drop-zone">{folder}</div>
  ),
}));
```

Sans ce mock, les tests AssetGrid qui utilisent `useSWRConfig` (dans UploadDropZone) pourraient échouer si `useSWRConfig` n'est pas couvert par le mock `swr` existant.

#### `useSWRConfig` dans le mock `swr` de AssetGrid.test.tsx

Vérifier que le mock `swr` de `AssetGrid.test.tsx` inclut `useSWRConfig`. Si ce n'est pas le cas, ajouter :

```typescript
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));
```

Mais comme UploadDropZone sera mocké dans `AssetGrid.test.tsx`, `useSWRConfig` n'est pas appelé dans ce contexte — aucune modification du mock `swr` n'est nécessaire là.

### Drag & drop — détails comportementaux

- `onDragEnter` et `onDragOver` : **les deux** doivent appeler `e.preventDefault()` pour permettre le drop (comportement natif du browser)
- `onDragLeave` : `setDragging(false)` — peut se déclencher sur les enfants, mais pour MVP c'est acceptable
- `onDrop` : `e.preventDefault()` + `e.stopPropagation()` + lire `e.dataTransfer.files`
- Input file click : `inputRef.current?.click()` — sans `?` TypeScript se plaint si `useRef<HTMLInputElement>(null)`

### Règles absolues à respecter

1. `mutate(["assets", folder])` + `mutate("asset-folders")` — **toujours les deux ensemble** après tout upload
2. `config.mode !== "navigation"` → UploadDropZone retourne `null` — pas d'upload en mode selector ou folder-selector
3. `Promise.allSettled` (pas `Promise.all`) — pour que l'échec d'un fichier n'annule pas les autres
4. Ne pas modifier le composant `ConfirmModal` — utiliser tel quel avec "Annuler"/"Supprimer"
5. `accept="image/*"` sur l'input — cohérent avec le filtre visuel
6. Pas de `useMemo`/`useCallback` manuels — React Compiler

### Project Structure Notes

- **Fichier créé :** `frontend/components/media-library/UploadDropZone.tsx`
- **Fichier modifié :** `frontend/lib/api.ts` — ajout `uploadMedia` dans `api.assets`
- **Fichier modifié :** `frontend/components/media-library/AssetGrid.tsx` — import + intégration + refactor layout
- **Test créé :** `frontend/__tests__/media-library/UploadDropZone.test.tsx`
- **Test modifié :** `frontend/__tests__/media-library/AssetGrid.test.tsx` — mock UploadDropZone
- Pas de barrel `index.ts` — import direct `@/components/media-library/UploadDropZone`
- `testMatch: __tests__/**/*.test.(ts|tsx)` — respecté

### Patterns hérités des stories 2.1–2.2 (reproduire)

1. **Mock SWR dans les tests** — `jest.mock("swr", () => ({ default: jest.fn(), mutate: jest.fn(), useSWRConfig: ... }))`
2. **Mock `@/lib/api`** — inclure `randomCharacterColor: () => "#FF6B6B"` (requis par CharacterBasicForm globalement)
3. **Tokens design** : `bg-bg`, `bg-elevated`, `text-fore`, `text-muted` — jamais `slate-*`/`zinc-*`
4. **Isolation des tests** : mocker les sous-composants dans les tests du parent (AssetGrid mock UploadDropZone)
5. **`"use client"`** obligatoire sur tout composant interactif

### Vérification de non-régression

Après implémentation :
- `npm test` (depuis `frontend/`) : 94 tests existants + nouveaux tests story 2.3 — tous verts
- Vérifier que `AssetGrid.test.tsx` reste vert (mock UploadDropZone ajouté)
- `MediaLibraryModal.test.tsx` : non impacté (AssetGrid déjà mocké)

### References

- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 2.3 ACs (lignes 295-321)
- Architecture : `_bmad-output/planning-artifacts/architecture.md` — D4 (UploadDropZone), D5 (clés SWR), Process Patterns (flux upload + substitution same-name)
- Story 2.2 : `_bmad-output/implementation-artifacts/2-2-grille-de-miniatures.md` — patterns tests, mock isolement, tokens design
- Code existant :
  - `frontend/lib/api.ts` lignes 172–202 (`api.assets` actuel — `upload`, `getFolders`, `list`)
  - `frontend/components/media-library/AssetGrid.tsx` (état actuel post-2.2 — à modifier T3)
  - `frontend/components/ConfirmModal.tsx` — props : `{ message, onConfirm, onCancel }`, boutons : "Annuler"/"Supprimer"
  - `backend/routers/assets.py` lignes 72–136 (endpoint `POST /api/assets` — contrat complet)
  - `frontend/__tests__/media-library/MediaLibraryModal.test.tsx` — pattern mock composant fils

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- TDD respecté : tests UploadDropZone écrits en RED (import manquant → 1 suite failed), puis GREEN après implémentation.
- T1 — `api.assets.uploadMedia` ajouté dans `api.ts` : `POST /api/assets` avec fetch brut, retour discriminé `{ ok: true }` / `{ ok: false, status: 409 }`. Pas d'utilisation de `request<T>()` (ne gère pas le 409).
- T2 — `UploadDropZone.tsx` créé : drag&drop + click-to-select, `Promise.allSettled`, gestion 409 via queue `conflicts` state + `ConfirmModal`, `useSWRConfig().mutate` pour invalidation. Returns null en mode non-navigation.
- T3 — `AssetGrid.tsx` patché : import UploadDropZone, refactor layout (early-return "dossier vide" → conditionnel inline), `flex-col gap-4` pour l'espacement.
- T4 — `UploadDropZone.test.tsx` créé (6 tests) : navigation/selector null, upload → mutate, 409 → ConfirmModal, confirm → replace=true, cancel → no replace. `AssetGrid.test.tsx` patché : mock UploadDropZone + useSWRConfig dans mock swr.
- Non-régression : 100/100 tests verts (94 existants + 6 nouveaux UploadDropZone).

### File List

- `frontend/lib/api.ts` — MODIFIÉ : ajout `api.assets.uploadMedia`
- `frontend/components/media-library/UploadDropZone.tsx` — NOUVEAU
- `frontend/components/media-library/AssetGrid.tsx` — MODIFIÉ : import UploadDropZone + refactor layout
- `frontend/__tests__/media-library/UploadDropZone.test.tsx` — NOUVEAU
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — MODIFIÉ : mock UploadDropZone + useSWRConfig

## Change Log

- 2026-06-15 — Story 2.3 créée (create-story workflow). Status → ready-for-dev.
- 2026-06-15 — Story 2.3 implémentée : `api.assets.uploadMedia`, `UploadDropZone.tsx` (drag&drop + 409 ConfirmModal), intégration `AssetGrid.tsx`. 6 nouveaux tests, 100/100 verts. Status → review.
