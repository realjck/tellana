---
baseline_commit: "e129d7d9b8153ed4f4047ee183bc49f3bc7e86b5"
---

# Story 4.2 — Menu contextuel clic droit dans la médiathèque

## Statut

done

## Contexte

La médiathèque (`AssetGrid`) gère aujourd'hui les actions fichiers/dossiers via deux mécanismes disparates :
- Fichiers : double-clic pour renommer inline, bouton × absolu pour supprimer
- Dossiers : bouton × absolu uniquement (pas de renommage possible)

Le backend **dispose déjà** de tous les endpoints nécessaires (story 1.4 terminée) :
- `PATCH /api/assets/{id}/rename` — renommer un fichier
- `DELETE /api/assets/{id}` — supprimer un fichier
- `PATCH /api/assets/folders` body `{ from, to }` — renommer un dossier
- `DELETE /api/assets/folders?path=X` — supprimer un dossier

L'objectif de cette story : remplacer le double-clic et les boutons × par un **menu contextuel clic droit** unifié (Renommer / Supprimer) applicable aux fichiers ET aux dossiers, et câbler le renommage de dossier côté frontend.

## User Story

En tant qu'auteur,
je veux cliquer droit sur un fichier ou un dossier dans la médiathèque pour accéder aux actions (renommer, supprimer),
afin d'avoir une interface cohérente et d'être capable de renommer mes dossiers de personnages.

## Acceptance Criteria

### AC1 — Menu contextuel sur les fichiers

**Given** un fichier affiché dans `AssetGrid` (tout mode)
**When** l'utilisateur fait un clic droit dessus
**Then** un menu contextuel apparaît à la position du curseur avec deux entrées : "Renommer" et "Supprimer"
**And** les boutons × absolus sur les fichiers sont supprimés
**And** le double-clic pour renommer est supprimé (remplacé par le menu)

**Given** le menu contextuel est visible
**When** l'utilisateur clique "Renommer"
**Then** le menu se ferme et le champ `<input>` de renommage inline s'active sur le fichier
**And** le comportement de renommage (valider sur Enter/blur, appel `PATCH /api/assets/{id}/rename`) est identique à l'actuel

**Given** le menu contextuel est visible
**When** l'utilisateur clique "Supprimer"
**Then** le menu se ferme et `ConfirmModal` s'affiche avec le message existant
**And** le comportement de suppression (`DELETE /api/assets/{id}`) est identique à l'actuel

### AC2 — Menu contextuel sur les dossiers

**Given** un dossier affiché dans `AssetGrid` (tout mode)
**When** l'utilisateur fait un clic droit dessus
**Then** un menu contextuel apparaît à la position du curseur avec deux entrées : "Renommer" et "Supprimer"
**And** le bouton × absolu sur les dossiers est supprimé

**Given** le menu contextuel de dossier est visible
**When** l'utilisateur clique "Renommer"
**Then** le menu se ferme et un champ `<input>` de renommage inline s'active sur le nom du dossier (même UX que le renommage de fichier)
**And** valider (Enter ou blur) appelle `PATCH /api/assets/folders` avec `{ from: fullFolderPath, to: parentPath + "/" + newName }`
**And** après succès : `mutate("asset-folders")` + `mutate(["assets", currentFolder])` sont appelés
**And** si le dossier cible existe déjà (409) : un `AlertModal` affiche "Un dossier avec ce nom existe déjà."

**Given** le menu contextuel de dossier est visible
**When** l'utilisateur clique "Supprimer"
**Then** le menu se ferme et `ConfirmModal` s'affiche avec le message existant
**And** le comportement de suppression (`DELETE /api/assets/folders`) est identique à l'actuel

### AC3 — Fermeture du menu contextuel

**Given** le menu contextuel est visible
**When** l'utilisateur clique n'importe où en dehors du menu
**Then** le menu se ferme sans action

**Given** le menu contextuel est visible
**When** l'utilisateur appuie sur Escape
**Then** le menu se ferme sans action

**Given** le menu contextuel est visible ET il dépasse le bas/droite de la fenêtre
**When** le menu s'affiche
**Then** sa position est ajustée pour rester dans les limites de `window.innerWidth` / `window.innerHeight`

### AC4 — API frontend renameFolder

**Given** `lib/api.ts`
**When** `api.assets.renameFolder(from, to)` est appelé
**Then** `PATCH /api/assets/folders` avec body `{ from, to }` est envoyé
**And** la fonction est typée `(from: string, to: string) => Promise<void>`

## Tasks/Subtasks

- [x] T1: Ajouter `api.assets.renameFolder` dans `lib/api.ts`
  - [x] T1a: `renameFolder: (from: string, to: string) => Promise<void>` → `PATCH /api/assets/folders`
- [x] T2: Créer composant `ContextMenu` dans `components/media-library/ContextMenu.tsx`
  - [x] T2a: Props : `x, y, items: { label, onClick }[], onClose`
  - [x] T2b: Positionné en `fixed`, z-index élevé (au-dessus de la modale : `z-50`)
  - [x] T2c: Fermeture sur clic extérieur (`mousedown` sur document) + Escape
  - [x] T2d: Ajustement position pour rester dans les limites viewport
- [x] T3: Mettre à jour `AssetGrid.tsx`
  - [x] T3a: Supprimer les boutons × sur fichiers et dossiers
  - [x] T3b: Supprimer le double-clic pour renommer les fichiers
  - [x] T3c: Ajouter `onContextMenu` sur les cartes fichiers → ouvre `ContextMenu` avec "Renommer" / "Supprimer"
  - [x] T3d: Ajouter `onContextMenu` sur les cartes dossiers → ouvre `ContextMenu` avec "Renommer" / "Supprimer"
  - [x] T3e: Implémenter le renommage inline de dossier (état local `editingFolder` analogue à `editingId`)
  - [x] T3f: Câbler `api.assets.renameFolder` + gestion erreur 409 via `AlertModal`
- [x] T4: Tests unitaires
  - [x] T4a: `ContextMenu.test.tsx` — rendu, fermeture clic extérieur, fermeture Escape
  - [x] T4b: `AssetGrid.test.tsx` — clic droit fichier affiche menu, clic "Renommer" active l'input, clic "Supprimer" ouvre ConfirmModal
  - [x] T4c: `AssetGrid.test.tsx` — clic droit dossier affiche menu, clic "Renommer" appelle renameFolder, 409 affiche AlertModal
  - [x] T4d: Mettre à jour les tests existants qui testaient le double-clic ou le bouton ×

## Périmètre

**Dans cette story :**
- Composant `ContextMenu` réutilisable
- Remplacement double-clic + boutons × par clic droit dans `AssetGrid`
- Renommage de dossier frontend (backend déjà implémenté en story 1.4)
- `api.assets.renameFolder` dans `lib/api.ts`

**Hors périmètre :**
- Menu contextuel dans `FolderTree` (panneau gauche) — uniquement `AssetGrid` pour cette story
- Copier/coller ou déplacer des assets entre dossiers

## Dev Notes

### Architecture existante à respecter

**`AssetGrid.tsx`** — fichier principal à modifier. État actuel :
- `editingId: number | null` + `editingName: string` — renommage inline fichier (à conserver, juste déclenché différemment)
- `pendingDelete: Asset | null` + `pendingDeleteFolder: string | null` — modales de suppression (à conserver telles quelles)
- Clés SWR : `["assets", folder]` + `"asset-folders"` — toujours muter les deux ensemble

**État à ajouter dans `AssetGrid` :**
```typescript
const [contextMenu, setContextMenu] = useState<{
  x: number; y: number;
  type: "file"; asset: Asset;
} | {
  x: number; y: number;
  type: "folder"; folderPath: string;
} | null>(null);
const [editingFolder, setEditingFolder] = useState<string | null>(null);
const [editingFolderName, setEditingFolderName] = useState("");
```

**`ContextMenu` component** — à créer dans `components/media-library/ContextMenu.tsx` :
```typescript
interface ContextMenuItem { label: string; onClick: () => void; variant?: "danger" }
interface Props { x: number; y: number; items: ContextMenuItem[]; onClose: () => void; }
```
- Utilise `useEffect` pour écouter `mousedown` + `keydown(Escape)` sur `document`
- `e.preventDefault()` sur le `onContextMenu` parent pour éviter le menu natif

**Renommage dossier** — le dossier affiché dans la grille est un chemin relatif au parent courant : `f.slice(folder.length + 1)`. Le `from` envoyé à l'API est `f` (chemin complet). Le `to` est `folder + "/" + newName.trim()` (même parent, nouveau nom).

**Gestion 409** : `api.assets.renameFolder` doit lever une erreur quand le backend retourne 409. Dans `AssetGrid`, catcher via `try/catch` et afficher `AlertModal` avec le message "Un dossier avec ce nom existe déjà." (utiliser le composant `AlertModal` existant dans `components/AlertModal.tsx`).

**Styles menu contextuel** :
- `bg-elevated border border-white/10 rounded-md shadow-xl py-1 min-w-[140px]`
- Items : `px-3 py-1.5 text-sm text-fore hover:bg-raised cursor-pointer`
- Item "danger" (Supprimer) : `text-red-400 hover:bg-red-900/20`

**Tests** — patterns à suivre :
- Mock `ContextMenu` dans les tests `AssetGrid` (comme `UploadDropZone` est mocké) ou tester les callbacks directement
- Tests existants qui testaient le double-clic (`onDoubleClick`) devront être mis à jour pour `onContextMenu`
- Utiliser `fireEvent.contextMenu(element)` dans les tests

### Backend — aucune modification nécessaire

`PATCH /api/assets/folders` (story 1.4) accepte un body JSON `{ from_: str, to: str }` (Pydantic alias `from` → `from_`). Le frontend envoie `{ from: "...", to: "..." }` — le schéma Pydantic gère l'alias avec `model_config = ConfigDict(populate_by_name=True)` ou `Field(alias="from")`.

Vérifier dans `backend/schemas.py` le schéma `FolderRename` pour confirmer le nom du champ attendu dans le JSON.

## Fichiers concernés

- `frontend/lib/api.ts` — ajout `api.assets.renameFolder`
- `frontend/components/media-library/AssetGrid.tsx` — suppression × + double-clic, ajout clic droit
- `frontend/components/media-library/ContextMenu.tsx` — nouveau composant
- `frontend/__tests__/media-library/ContextMenu.test.tsx` — nouveaux tests
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — mise à jour tests existants

## Dev Agent Record

### Debug Log

_Aucun blocage._

### Completion Notes

- `api.assets.renameFolder` ajouté dans `lib/api.ts` — envoie `PATCH /api/assets/folders` avec body `{ from, to }` (Pydantic alias géré côté backend).
- Composant `ContextMenu` créé (`fixed`, `z-50`) avec fermeture sur `mousedown` extérieur et `Escape`, ajustement viewport via `useLayoutEffect` + `getBoundingClientRect`.
- `AssetGrid` refactorisé : suppression des boutons × et du double-clic ; clic droit (`onContextMenu`) sur fichiers et dossiers ouvre le menu contextuel. Nouveau state `editingFolder`/`editingFolderName` pour le renommage inline de dossier. Erreur 409 catchée → `AlertModal`.
- `ContextMenu` mocké dans les tests `AssetGrid` (pattern identique à `UploadDropZone`).
- 138 tests Jest passent, 0 erreur TypeScript.

## File List

- `frontend/lib/api.ts`
- `frontend/components/media-library/ContextMenu.tsx` (nouveau)
- `frontend/components/media-library/AssetGrid.tsx`
- `frontend/__tests__/media-library/ContextMenu.test.tsx` (nouveau)
- `frontend/__tests__/media-library/AssetGrid.test.tsx`

## Change Log

- Ajout `api.assets.renameFolder` dans `lib/api.ts` (Date: 2026-06-16)
- Création composant `ContextMenu` réutilisable (Date: 2026-06-16)
- Remplacement double-clic + boutons × par menu contextuel clic droit dans `AssetGrid` (Date: 2026-06-16)
- Ajout renommage inline de dossier avec gestion 409 via `AlertModal` (Date: 2026-06-16)

## Review Findings

- [x] [Review][Patch] (CORRIGÉ 2026-06-16) Renommer/Supprimer un dossier via le menu contextuel corrompt les références JSON (sprites perso + fond de scène) [backend/routers/assets.py:144,167] — le menu clic droit (cette story) expose désormais en première classe deux opérations dossier qui ne maintiennent pas l'intégrité référentielle. `rename_folder` met à jour `Asset.url` des lignes affectées mais PAS les URLs stockées dans `Character.sprites` ni `Scene.background_asset` (JSON) → après renommage du dossier, tous les sprites/fonds qui le référencent pointent vers un chemin disparu → images cassées dans l'éditeur et le player. `delete_folder` supprime les assets/fichiers mais ne purge pas non plus `Character.sprites`/`Scene.background_asset` (contrairement à `delete_asset` qui le fait). Côté frontend, le `onConfirm` de suppression de dossier ne mute que `asset-folders` + `["assets", folder]`, pas les clés SWR `story-`/`scene-` (la suppression de fichier, elle, les mute). La logique backend préexiste mais n'était déclenchable que via le bouton ×/cas marginaux ; la story la rend triviale à atteindre. Fix : refléter le nettoyage de `delete_asset` dans `delete_folder`, et réécrire les références JSON dans `rename_folder`.
