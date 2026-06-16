---
baseline_commit: 31f51b296f6663b2e06610ac38169204f809b97b
---

# Story 4.1 — Sélection de dossier et mapping automatique des poses

## Statut
review

## Contexte

La médiathèque est intégrée dans `CharacterBasicForm` : un bouton "Importer depuis la médiathèque" ouvre déjà la modale en mode `folder-selector` restreint à `characters/`. **Ce point est déjà implémenté et ne doit pas être retouché.**

La story implémente la suite du flux : lorsque l'utilisateur navigue dans un sous-dossier de personnage qui contient au moins une image, un bouton contextuel "Choisir ce dossier personnage" apparaît dans la grille d'assets. Au clic, les sprites sont mappés automatiquement depuis les noms de fichiers.

## User Story

En tant qu'auteur,
je veux sélectionner un dossier dans la médiathèque pour importer automatiquement les poses d'un nouveau personnage,
afin d'éviter d'uploader et de nommer les sprites un par un.

## Acceptance Criteria

### AC1 — Bouton contextuel dans AssetGrid

**Given** la modale est ouverte en mode `folder-selector` (via "Importer depuis la médiathèque" dans `CharacterBasicForm`)
**And** l'utilisateur est dans un dossier qui contient au moins un asset image (content_type `image/*`)
**When** `AssetGrid` rend la grille
**Then** un bouton "Choisir ce dossier personnage" apparaît **en haut de la zone**, avant la grille de miniatures
**And** ce bouton n'apparaît pas si le dossier est vide ou ne contient que des fichiers non-image

**Given** la modale est ouverte en mode `navigation` ou `selector`
**When** `AssetGrid` rend la grille
**Then** le bouton "Choisir ce dossier personnage" n'est pas affiché

### AC2 — Mapping automatique des poses

**Given** l'utilisateur clique "Choisir ce dossier personnage" dans un dossier contenant `default.png`, `happy.png`, `surprised.png`
**When** le mapping s'effectue côté frontend (à partir des assets déjà chargés dans la grille)
**Then** le fichier `default.*` (quel que soit le format) est mappé vers la clé de pose `"default"`
**And** les autres images sont mappées avec le stem du filename comme clé de pose (`happy.png` → `"happy"`, `surprised.png` → `"surprised"`)
**And** les fichiers non-image (content_type ne commençant pas par `image/`) sont ignorés
**And** les fichiers `.keep` sont ignorés

**Given** le dossier ne contient pas de fichier `default.*`
**When** le mapping s'effectue
**Then** la première image de la liste (ordre retourné par l'API) est mappée vers la clé `"default"`
**And** les autres images sont mappées normalement par stem de filename

**Given** un fichier `default.jpg` (extension autre que `.png`)
**When** le mapping s'effectue
**Then** la clé de pose est `"default"` (stem sans extension, indépendamment du format)

### AC3 — Résultat du clic

**Given** le mapping est effectué
**When** l'utilisateur clique "Choisir ce dossier personnage"
**Then** `config.onSelectFolder(folder)` est appelé avec le chemin du dossier courant
**And** la modale se ferme
**And** `CharacterBasicForm` reçoit les sprites mappés (via le callback existant)

> **Note implémentation :** `AssetGrid` passe les sprites mappés via `onSelectFolder` ou via un second callback dédié à définir dans `MediaLibraryConfig`. L'approche la plus simple : enrichir `onSelectFolder` pour qu'il reçoive optionnellement les sprites mappés, ou ajouter `onSelectFolderWithSprites?: (folder: string, sprites: Record<string, AssetRef>) => void` dans `MediaLibraryConfig`.

## Tasks/Subtasks

- [x] T1: Étendre `MediaLibraryConfig` avec `onSelectFolderWithSprites` dans `types/index.ts`
- [x] T2: Ajouter bouton "Choisir ce dossier personnage" + logique mapping dans `AssetGrid.tsx`
  - [x] T2a: Bouton visible uniquement en mode `folder-selector` avec au moins une image
  - [x] T2b: Mapping stem→clé de pose (default.* → "default", reste → stem)
  - [x] T2c: Appel `onSelectFolderWithSprites` + fermeture modale
- [x] T3: Ajouter bouton "Importer depuis la médiathèque" (folder-selector) dans `CharacterBasicForm.tsx`
  - [x] T3a: Nouvelle modale folder-selector ouvrant sur `characters/`
  - [x] T3b: Réception des sprites mappés via `onSelectFolderWithSprites`
  - [x] T3c: Affichage du nombre de poses importées
- [x] T4: Tests unitaires pour `AssetGrid` (bouton + mapping)

## Périmètre

**Dans cette story :**
- Bouton "Choisir ce dossier personnage" dans `AssetGrid` (mode `folder-selector` uniquement, si au moins une image présente)
- Logique de mapping stem→clé de pose dans `AssetGrid` (ou helper dédié)
- Transmission des sprites mappés au parent via callback

**Hors périmètre (Story 4.2) :**
- Confirmation si le personnage a déjà des sprites
- Persistance en base (`PATCH /api/stories/{id}/characters/{charId}`)
- Comportement dans `CharacterPosesManager` après import

## Fichiers concernés

- `frontend/components/media-library/AssetGrid.tsx` — ajout du bouton + logique mapping
- `frontend/types/index.ts` — extension optionnelle de `MediaLibraryConfig` (callback enrichi)
- `frontend/components/CharacterBasicForm.tsx` — réception des sprites mappés (lecture seule pour cette story, persistance en 4.2)

## Dev Agent Record

### Completion Notes

Implémentation complète en 4 tâches :
- `MediaLibraryConfig` étendu avec `onSelectFolderWithSprites?: (folder, sprites) => void`
- `AssetGrid` : bouton "Choisir ce dossier personnage" conditionnel (mode folder-selector + images présentes) + helper `mapSpritesFromAssets` gérant le cas `default.*` vs première image fallback
- `CharacterBasicForm` : second bouton "Importer depuis la médiathèque" ouvrant une modale folder-selector restreinte à `characters/`, stockage des sprites dans `pendingSprites` + affichage du compteur de poses
- 10 nouveaux tests unitaires pour `AssetGrid` + correction du test `CharacterManager` impacté par les deux boutons médiathèque
- TypeScript strict : aucune erreur. Suite complète : 121 tests verts.

## File List

- `frontend/types/index.ts`
- `frontend/components/media-library/AssetGrid.tsx`
- `frontend/components/CharacterBasicForm.tsx`
- `frontend/__tests__/media-library/AssetGrid.test.tsx`
- `frontend/__tests__/CharacterManager.test.tsx`

## Change Log

- feat: TEL-29/4.1 — bouton "Choisir ce dossier personnage" + mapping automatique des poses dans AssetGrid
- feat: ajout `onSelectFolderWithSprites` dans `MediaLibraryConfig`
- feat: bouton "Importer depuis la médiathèque" (folder-selector) dans `CharacterBasicForm`
- test: 10 nouveaux tests AssetGrid mode folder-selector + correction CharacterManager

## Notes techniques

- Les assets sont déjà chargés dans `AssetGrid` via `useSWR(["assets", folder])` — pas de nouvel appel API nécessaire pour le mapping
- Le stem d'un filename : `"happy.png".replace(/\.[^.]+$/, "")` → `"happy"`
- `AssetRef` à construire depuis un `Asset` : `{ type: "upload", url: asset.url, opfs_key: null, job_id: null, mime_type: asset.content_type, width: null, height: null }`
- Le bouton "Sélectionner ce dossier" existant dans `FolderTree` reste inchangé (il sert à d'autres usages `folder-selector`)
