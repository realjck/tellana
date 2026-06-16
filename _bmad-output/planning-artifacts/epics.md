---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-tellana-2026-06-14/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# tellana - Epic Breakdown

## Overview

Ce document fournit la décomposition complète en epics et stories pour la feature **Médiathèque structurée** de Tellana, décomposant les exigences du PRD et de l'Architecture en stories implémentables.

## Requirements Inventory

### Functional Requirements

FR-1.1: Le backend ajoute un champ `folder: str` au modèle `Asset` avec migration safe `ALTER TABLE assets ADD COLUMN folder TEXT DEFAULT 'backgrounds'` dans `main.py`.
FR-1.2: Les dossiers racine prédéfinis sont `characters/`, `backgrounds/`, `audio/`. L'utilisateur peut créer des sous-dossiers librement à n'importe quel niveau sous ces racines.
FR-1.3: Les assets peuvent être placés à n'importe quel niveau de l'arborescence — directement à la racine d'un dossier ou dans un sous-dossier. Le nom de dossier est libre et indépendant du nom des personnages.
FR-1.4: `GET /api/assets?folder=X` retourne tous les assets du dossier `X` (exact match, sans récursion).
FR-1.5: `POST /api/assets` accepte un champ `folder` en multipart. Si absent, le dossier par défaut est `backgrounds`.
FR-2.1: La médiathèque s'ouvre dans une modale pleine-largeur depuis le bouton navbar (page accueil et story) et depuis les sélecteurs d'assets existants (fond de scène, sprites).
FR-2.2: La modale affiche un panneau de navigation de dossiers à gauche (arborescence dérivée en mémoire) et une grille de miniatures à droite.
FR-2.3: La grille de miniatures affiche : vignette image, nom de fichier tronqué, icône de type (image/audio). Vignettes cliquables pour sélection (mode sélecteur) ou affichage détails.
FR-2.4: La modale supporte deux modes : **navigation** (navbar, sans sélection retournée, avec upload/rename/delete) et **sélecteur** (depuis un champ asset, retourne l'asset sélectionné au parent via simple clic).
FR-2.5: Upload depuis la modale : zone drag & drop visible dans le dossier courant, multi-upload, les fichiers uploadés apparaissent immédiatement dans la grille.
FR-2.6: Renommage inline : double-clic sur le nom d'un asset → champ éditable, valide à la perte de focus ou touche Entrée.
FR-2.7: Suppression : bouton × sur chaque asset → `ConfirmModal` avant suppression. La suppression d'un asset utilisé affiche un warning mais reste permise.
FR-2.8: Substitution par même nom de fichier dans le même dossier : `ConfirmModal` avec impact réel (N scènes, M nœuds) → fichier remplacé à la source, toutes les références `AssetRef` pointent automatiquement vers le nouveau fichier sans modification.
FR-3.1: Le projet embarque des assets de démonstration pour deux personnages — Alice et Bob — avec plusieurs poses chacun.
FR-3.2: Les images de seed sont stockées dans `backend/seed_assets/characters/alice/` et `.../bob/`, copiées dans `uploads/` au démarrage si absentes (pas d'écrasement si déjà présentes).
FR-3.3: Les assets de seed sont enregistrés en base avec leur dossier (`characters/alice`, `characters/bob`) au premier démarrage — idempotent via `(folder, filename)`.
FR-3.4: L'utilisateur peut supprimer les assets de seed depuis la médiathèque comme n'importe quel asset (pas de guard 403). `is_seed` sert uniquement à afficher un badge dans la grille.
FR-3.5: Poses minimum par personnage de seed : `default.png` (pose neutre) + `happy.png` + `surprised.png`. Convention `{nom-pose}.png`.
FR-4.1: Dans `CharacterBasicForm`, bouton "Importer depuis la médiathèque" ouvre la modale en mode `folder-selector` restreint à `characters/`. L'auteur sélectionne un dossier (pas un fichier). Lien dossier-personnage = choix explicite, indépendant du nom du personnage dans la story.
FR-4.2: À la sélection d'un dossier, tous les assets images du dossier (niveau direct uniquement, sans récursion) sont mappés en poses : `default.*` -> pose `"default"` (non renommable), autres -> stem du filename comme clé de pose (`happy.png` -> `"happy"`).
FR-4.3: Si le personnage avait déjà des sprites, un `ConfirmModal` s'affiche avant d'écraser. Import sans confirmation si aucun sprite existant.
FR-4.4: Après import, les poses sont éditables normalement dans `CharacterPosesManager` (ajout, renommage, suppression individuelle).
FR-4.5: Le flux d'upload manuel des poses reste disponible dans `CharacterPosesManager` en complément de l'import par dossier.

### NonFunctional Requirements

NFR-1: Idempotence du seed au redémarrage — INSERT en base uniquement si `(folder, filename)` absent, copy fichier uniquement si absent dans `uploads/`.
NFR-2: Rétrocompatibilité totale des `AssetRef` existants — structure `{id, url}` inchangée, `resolveAsset()` inchangé, aucune migration JSON des scènes/personnages existants.
NFR-3: Substitution de fichier avec affichage de l'impact réel : le backend retourne `{ existing_id, references: { scenes: int, nodes: int } }` avant toute confirmation de remplacement.
NFR-4: La médiathèque est accessible en moins de 2 clics depuis n'importe quel écran de l'éditeur (bouton navbar toujours visible).
NFR-5: Upload multi-fichiers : l'utilisateur peut uploader 10 images en une seule opération drag & drop dans un dossier.

### Additional Requirements

- Migration DB : deux colonnes à ajouter au modèle `Asset` — `folder TEXT DEFAULT 'backgrounds'` et `is_seed BOOLEAN DEFAULT FALSE` — via pattern `try/except ALTER TABLE ADD COLUMN` dans `main.py` (pas d'Alembic).
- Stockage disque miroir : nouveaux assets stockés dans `uploads/{folder}/{filename}` avec `os.makedirs(os.path.join(UPLOAD_DIR, folder), exist_ok=True)` avant tout write. FastAPI sert `uploads/` en `StaticFiles` récursivement -> rétrocompatibilité des URLs plates existantes.
- `GET /api/assets/folders` : retourne liste plate triée des dossiers distincts dérivés depuis les champs `folder` en DB (ex. `["backgrounds", "characters", "characters/alice"]`). Pas d'objet wrapper.
- `PATCH /api/assets/folders` : rename dossier en masse — body `{ from: str, to: str }` — UPDATE SQL + `os.rename` disque. Atomicité : `os.rename` AVANT SQL, rollback SQL si échec OS.
- `PATCH /api/assets/{id}/rename` : rename fichier seul — body `{ filename: str }`.
- Substitution same-name : détection `SELECT WHERE folder=:folder AND filename=:filename` -> `409 Conflict { existing_id, references: { scenes, nodes } }` -> client envoie `POST /api/assets?replace=true` après confirmation.
- Placeholder `.keep` pour dossier vide : asset DB avec `filename=".keep"`, filtré dans `AssetGrid` (`assets.filter(a => a.filename !== '.keep')`).
- Clés SWR : `["assets", folder]` par dossier, `"asset-folders"` global. Après chaque mutation : `mutate(["assets", currentFolder])` + `mutate("asset-folders")` — les deux ensemble.
- `MediaLibraryConfig` objet unique passé en prop : `{ mode: "navigation"|"selector"|"folder-selector", filter?, onSelect?, onSelectFolder?, allowedFolders?, initialFolder? }`.
- Structure composants : `components/media-library/` avec `MediaLibraryModal.tsx`, `FolderTree.tsx`, `AssetGrid.tsx`, `UploadDropZone.tsx`. Pas de fichier `index.ts` barrel.
- Seed loader dans `main.py` lifespan : idempotent via `shutil.copy2` si fichier absent + INSERT si `(folder, filename)` absent. `is_seed=True` sur tous les assets seed.
- Champ `folder` normalisé POSIX slash à l'entrée backend (`folder.replace('\\', '/')`) et à la saisie frontend.

### UX Design Requirements

Aucun document UX Design disponible pour cette feature. Les patterns UX sont définis dans le PRD (FR-2.x) et l'Architecture (patterns d'implémentation).

### FR Coverage Map

FR-1.1: Epic 1 — Migration modèle Asset, champ `folder TEXT DEFAULT 'backgrounds'` + `is_seed BOOLEAN`
FR-1.2: Epic 1 — Dossiers racine prédéfinis, sous-dossiers libres
FR-1.3: Epic 1 — Assets à n'importe quel niveau de l'arborescence, nom de dossier libre
FR-1.4: Epic 1 — `GET /api/assets?folder=X` (exact match, sans récursion)
FR-1.5: Epic 1 — `POST /api/assets` avec champ `folder` multipart
FR-2.1: Epic 3 — Ouverture modale depuis navbar (layout.tsx ×2) et sélecteurs existants
FR-2.2: Epic 2 — Panneau dossiers (FolderTree) + grille miniatures (AssetGrid)
FR-2.3: Epic 2 — Vignettes : thumbnail, nom tronqué, icône type, cliquables
FR-2.4: Epic 2 — Modes navigation / sélecteur / folder-selector via MediaLibraryConfig
FR-2.5: Epic 2 — Upload drag & drop multi-fichiers (UploadDropZone), apparition immédiate
FR-2.6: Epic 2 — Renommage inline double-clic, PATCH /api/assets/{id}/rename
FR-2.7: Epic 2 — Suppression avec ConfirmModal, DELETE /api/assets/{id}
FR-2.8: Epic 2 — Substitution same-name : 409 Conflict + ConfirmModal + POST ?replace=true
FR-3.1: Epic 2 — Assets seed Alice & Bob, plusieurs poses chacun
FR-3.2: Epic 2 — seed_assets/ commité, shutil.copy2 au démarrage si absent
FR-3.3: Epic 2 — Seed loader lifespan idempotent : INSERT si (folder, filename) absent
FR-3.4: Epic 2 — is_seed badge dans AssetGrid, suppression seed permise sans guard 403
FR-3.5: Epic 2 — Poses seed : default.png + happy.png + surprised.png par personnage
FR-4.1: Epic 4 — Bouton "Importer" dans CharacterBasicForm, mode folder-selector sur characters/
FR-4.2: Epic 4 — Mapping automatique stem→pose key (default.* → "default", autres → stem)
FR-4.3: Epic 4 — ConfirmModal si sprites existants, import direct sinon
FR-4.4: Epic 4 — Poses éditables normalement après import dans CharacterPosesManager
FR-4.5: Epic 4 — Upload manuel des poses reste disponible en complément

## Epic List

### Epic 1 — Fondations API Assets
Le backend gère les assets en dossiers structurés : migration du modèle, stockage miroir, et tous les endpoints API nécessaires à la médiathèque sont opérationnels et testés.
**FRs couverts :** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5
**NFRs :** NFR-2 (rétrocompatibilité AssetRef), NFR-3 (409 avec références)

### Epic 2 — Composants Médiathèque & Seeds
Les quatre composants de la modale sont construits et testés unitairement. Les assets de démonstration Alice & Bob sont chargés et visibles dans la grille dès l'ouverture.
**FRs couverts :** FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8, FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5
**NFRs :** NFR-1 (idempotence seed), NFR-5 (multi-upload 10 fichiers)

### Epic 3 — Intégration Médiathèque
La modale est câblée dans l'application depuis tous les points d'entrée UX : bouton navbar (global et story), sélecteur de fond de scène, sélecteur de sprite dialogue.
**FRs couverts :** FR-2.1
**NFRs :** NFR-4 (accessibilité 2 clics)

### Epic 4 — Import de personnage par dossier
Les auteurs peuvent importer un set de sprites complet en sélectionnant un dossier dans la médiathèque, avec mapping automatique des poses et confirmation si des sprites existaient.
**FRs couverts :** FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5

---

## Epic 1 : Fondations API Assets

Le backend gère les assets en dossiers structurés : migration du modèle, stockage miroir, et tous les endpoints opérationnels.

### Story 1.1 : Migration modèle Asset

En tant qu'auteur,
je veux que les assets soient associés à un dossier sémantique,
afin de les retrouver organisés par catégorie.

**Acceptance Criteria :**

**Given** une base de données existante avec des assets sans dossier
**When** l'application démarre
**Then** la colonne `folder TEXT DEFAULT 'backgrounds'` est ajoutée à la table `assets` via `ALTER TABLE` dans un `try/except` (pas d'erreur si elle existe déjà)
**And** la colonne `is_seed BOOLEAN DEFAULT FALSE` est ajoutée de la même façon
**And** les assets existants ont `folder = 'backgrounds'` et `is_seed = False`

**Given** le schéma Pydantic `Asset`
**When** un endpoint retourne un asset
**Then** la réponse JSON inclut les champs `folder: str` et `is_seed: bool`

**Given** le type TypeScript `Asset` dans `frontend/lib/api.ts`
**When** le frontend consomme l'API
**Then** `Asset` expose `folder: string` et `is_seed: boolean`
**And** `AssetRef` reste inchangé (`{ id: number, url: string }`) — aucune breaking change

### Story 1.2 : Listing des assets par dossier

En tant qu'auteur,
je veux filtrer les assets par dossier et lister tous les dossiers existants,
afin de naviguer dans ma bibliothèque de médias.

**Acceptance Criteria :**

**Given** des assets avec des dossiers variés en base
**When** `GET /api/assets?folder=backgrounds` est appelé
**Then** seuls les assets dont `folder = 'backgrounds'` sont retournés (exact match, sans récursion)

**Given** des assets dans `characters/alice`, `characters/bob`, `backgrounds`
**When** `GET /api/assets/folders` est appelé
**Then** la réponse est une liste plate triée `["backgrounds", "characters/alice", "characters/bob"]`
**And** pas d'objet wrapper — tableau JSON direct

**Given** aucun asset en base
**When** `GET /api/assets/folders` est appelé
**Then** la réponse est `[]`

### Story 1.3 : Upload d'un asset dans un dossier

En tant qu'auteur,
je veux uploader une image dans un dossier spécifique,
afin de l'organiser dès l'upload sans manipulation supplémentaire.

**Acceptance Criteria :**

**Given** un fichier à uploader avec `folder=characters/alice` en multipart
**When** `POST /api/assets` est appelé
**Then** le fichier est sauvegardé dans `uploads/characters/alice/{filename}` (makedirs créé si absent)
**And** l'asset en base a `folder = 'characters/alice'` et `url = '/uploads/characters/alice/{filename}'`
**And** le champ `folder` est normalisé POSIX slash (`\` remplacé par `/`)

**Given** un `POST /api/assets` sans champ `folder`
**When** l'upload est traité
**Then** le dossier par défaut `backgrounds` est utilisé

**Given** des assets existants avec une URL plate `/uploads/filename` (anciens assets)
**When** l'application sert ces URLs
**Then** ils restent accessibles sans migration — `StaticFiles` sert `uploads/` récursivement

### Story 1.4 : Renommage de dossier et de fichier

En tant qu'auteur,
je veux renommer un dossier ou un fichier asset,
afin de corriger une erreur de nommage sans perdre mes références.

**Acceptance Criteria :**

**Given** un dossier `characters/alice` avec des assets en base et sur disque
**When** `PATCH /api/assets/folders` avec body `{ from: "characters/alice", to: "characters/alice-v2" }` est appelé
**Then** `os.rename(uploads/characters/alice, uploads/characters/alice-v2)` est exécuté en premier
**And** si `os.rename` réussit, UPDATE SQL `folder = REPLACE(folder, from, to) WHERE folder = from OR folder LIKE from || '/%'`
**And** si `os.rename` échoue, le SQL n'est pas exécuté
**And** si le dossier cible existe déjà → `409 Conflict`

**Given** un asset avec `id=5`, `filename="portrait.png"`
**When** `PATCH /api/assets/5/rename` avec body `{ filename: "portrait-v2.png" }` est appelé
**Then** le fichier physique est renommé sur disque
**And** `url` et `filename` sont mis à jour en base

### Story 1.5 : Détection et remplacement d'asset par même nom

En tant qu'auteur,
je veux être averti si mon upload écrase un fichier existant,
afin de décider consciemment s'il faut le remplacer ou annuler.

**Acceptance Criteria :**

**Given** un asset `portrait.png` dans `characters/alice` déjà en base
**When** `POST /api/assets` avec `folder=characters/alice` et `filename=portrait.png` est appelé (sans `?replace=true`)
**Then** la réponse est `409 Conflict` avec body `{ existing_id: int, references: { scenes: int, nodes: int } }`
**And** `references.scenes` et `references.nodes` comptent les usages réels dans les JSONs de la story

**Given** un `409 Conflict` reçu par le client
**When** `POST /api/assets?replace=true` est appelé avec le même fichier
**Then** le fichier physique est écrasé sur disque
**And** `url` de l'asset existant est mis à jour en base (l'`id` reste identique)
**And** toutes les `AssetRef` existantes `{ id: existing_id }` pointent automatiquement vers le nouveau fichier sans modification JSON

---

## Epic 2 : Composants Médiathèque & Seeds

Les quatre composants de la modale sont construits et testés unitairement. Les assets de démonstration Alice & Bob sont visibles dans la grille dès l'ouverture.

### Story 2.1 : Modale MediaLibraryModal et navigation de dossiers (FolderTree)

En tant qu'auteur,
je veux ouvrir une modale médiathèque et naviguer dans l'arborescence de dossiers,
afin de trouver rapidement les assets organisés par catégorie.

**Acceptance Criteria :**

**Given** un composant parent qui passe `config: MediaLibraryConfig`
**When** la modale s'ouvre
**Then** `MediaLibraryModal` reçoit un seul prop `config` de type `{ mode: "navigation"|"selector"|"folder-selector", filter?, onSelect?, onSelectFolder?, allowedFolders?, initialFolder? }`
**And** la modale est pleine-largeur avec panneau gauche (FolderTree) + zone droite (pour AssetGrid)

**Given** `GET /api/assets/folders` retourne `["backgrounds", "characters", "characters/alice"]`
**When** `FolderTree` se monte (via `useSWR("asset-folders")`)
**Then** l'arborescence est dérivée en mémoire et affichée hiérarchiquement
**And** `characters/` est un nœud parent avec `alice` comme enfant

**Given** l'utilisateur clique sur un dossier dans `FolderTree`
**When** la sélection change
**Then** le dossier courant est mis à jour dans l'état de `MediaLibraryModal`
**And** si `config.allowedFolders` est défini, seuls ces dossiers sont navigables
**And** si `config.mode === "folder-selector"`, un bouton "Sélectionner ce dossier" apparaît et appelle `config.onSelectFolder(folder)`

**Given** `config.initialFolder` est fourni
**When** la modale s'ouvre
**Then** ce dossier est présélectionné dans FolderTree

**Given** l'auteur est dans `FolderTree` en mode navigation
**When** il clique sur "Nouveau dossier" et saisit un nom (ex. `characters/alice-v2`)
**Then** `POST /api/assets` est appelé avec `folder="characters/alice-v2"` et un fichier vide `.keep` (`content_type="application/x-empty"`)
**And** `mutate("asset-folders")` est appelé
**And** le nouveau dossier apparaît dans `FolderTree` (le `.keep` est filtré dans `AssetGrid`)

### Story 2.2 : Grille de miniatures (AssetGrid)

En tant qu'auteur,
je veux voir les assets du dossier sélectionné sous forme de grille,
afin d'identifier visuellement mes images.

**Acceptance Criteria :**

**Given** un dossier sélectionné dans FolderTree
**When** `AssetGrid` se monte (via `useSWR(["assets", folder])`)
**Then** les assets du dossier sont affichés en grille : vignette image, nom de fichier tronqué, icône type

**Given** un asset avec `filename=".keep"`
**When** `AssetGrid` filtre les assets
**Then** cet asset n'est jamais affiché dans la grille

**Given** un asset avec `is_seed=true`
**When** il s'affiche dans la grille
**Then** un badge "seed" est visible sur sa vignette

**Given** `config.mode === "selector"` et `config.filter === "images"`
**When** l'utilisateur clique sur une vignette
**Then** `config.onSelect(asset)` est appelé et la modale se ferme

**Given** une image affichée dans la grille
**When** le composant la rend
**Then** `resolveAsset({ id, url })` est utilisé pour construire l'URL (jamais `asset.url` directement)

### Story 2.3 : Upload drag & drop multi-fichiers (UploadDropZone)

En tant qu'auteur,
je veux déposer plusieurs fichiers d'un coup dans le dossier courant,
afin d'uploader rapidement un lot d'images sans les sélectionner un par un.

**Acceptance Criteria :**

**Given** l'utilisateur glisse des fichiers sur la zone de drop dans le dossier courant
**When** le drop se produit
**Then** chaque fichier est envoyé en `POST /api/assets` avec `folder=currentFolder` en multipart
**And** les uploads se font en parallèle

**Given** tous les uploads sont terminés
**When** les réponses `200` sont reçues
**Then** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble
**And** les nouveaux assets apparaissent immédiatement dans `AssetGrid` sans rechargement

**Given** un fichier uploadé a le même `filename` qu'un asset existant dans `currentFolder`
**When** le backend répond `409 Conflict { existing_id, references: { scenes, nodes } }`
**Then** un `ConfirmModal` s'affiche : "Ce fichier remplacera `{filename}` utilisé dans {scenes} scène(s) et {nodes} nœud(s). Confirmer ?"
**And** si confirmé → `POST /api/assets?replace=true` est envoyé
**And** si annulé → l'upload de ce fichier est ignoré, les autres continuent

**Given** l'utilisateur sélectionne 10 fichiers image en une seule opération
**When** tous sont droppés
**Then** tous les 10 sont uploadés avec succès

### Story 2.4 : Renommage inline et suppression d'asset

En tant qu'auteur,
je veux renommer ou supprimer un asset directement depuis la grille,
afin de maintenir ma médiathèque propre sans quitter l'interface.

**Acceptance Criteria :**

**Given** `config.mode === "navigation"` et un asset affiché dans la grille
**When** l'utilisateur double-clique sur le nom de fichier
**Then** un champ `<input>` apparaît avec le nom actuel pré-rempli

**Given** le champ de renommage est actif
**When** l'utilisateur appuie sur Entrée ou perd le focus
**Then** `PATCH /api/assets/{id}/rename` est appelé avec `{ filename: newName }`
**And** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble

**Given** un asset affiché dans la grille
**When** l'utilisateur clique le bouton ×
**Then** un `ConfirmModal` s'affiche avec le nom du fichier à supprimer

**Given** la confirmation est validée dans le `ConfirmModal`
**When** l'utilisateur confirme
**Then** `DELETE /api/assets/{id}` est appelé
**And** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble
**And** l'asset disparaît de la grille

**Given** un asset avec `is_seed=true`
**When** l'utilisateur clique ×
**Then** le `ConfirmModal` s'affiche normalement — pas de guard 403, suppression permise

### Story 2.5 : Assets de seed Alice & Bob

En tant qu'auteur débutant sur Tellana,
je veux trouver des assets de démonstration prêts à l'emploi au premier lancement,
afin de pouvoir tester l'application sans uploader mes propres images.

**Acceptance Criteria :**

**Given** les fichiers `backend/seed_assets/characters/alice/default.png`, `happy.png`, `surprised.png` et `backend/seed_assets/characters/bob/default.png`, `happy.png`, `surprised.png` sont commités dans le repo
**When** l'application démarre (lifespan)
**Then** chaque fichier est copié dans `uploads/characters/alice/` (ou `bob/`) si absent via `shutil.copy2`
**And** chaque asset est inséré en base avec `folder="characters/alice"` (ou `bob/`) et `is_seed=True` si le couple `(folder, filename)` n'existe pas déjà

**Given** l'application redémarre avec les seeds déjà présents
**When** le lifespan s'exécute
**Then** aucune copie ni insertion supplémentaire n'est effectuée (idempotence)

**Given** l'utilisateur ouvre la médiathèque et navigue dans `characters/alice`
**When** `AssetGrid` affiche les assets
**Then** les 3 poses sont visibles avec un badge "seed" sur chaque vignette

---

## Epic 3 : Intégration Médiathèque

La modale est câblée dans l'application depuis tous les points d'entrée UX — accessible en moins de 2 clics depuis n'importe quel écran.

### Story 3.1 : Accès Médiathèque depuis les navbars (global et story)

En tant qu'auteur,
je veux accéder à la médiathèque depuis la barre de navigation,
afin de gérer mes assets depuis n'importe quel écran de l'application.

**Acceptance Criteria :**

**Given** l'auteur est sur la page d'accueil (`app/layout.tsx`)
**When** il clique sur le bouton "Médiathèque" dans la navbar
**Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "navigation" }}`
**And** la modale est accessible en 1 clic

**Given** l'auteur est sur la page story ou l'éditeur de scène (`app/stories/[id]/layout.tsx`)
**When** il clique sur le bouton "Médiathèque" dans la navbar story
**Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "navigation" }}`

**Given** la modale est ouverte en mode navigation
**When** l'auteur ferme la modale
**Then** aucune valeur n'est retournée — la navigation reste sur l'écran courant

### Story 3.2 : Sélecteur de fond de scène via médiathèque

En tant qu'auteur,
je veux choisir le fond d'une scène depuis ma médiathèque,
afin de sélectionner une image existante sans repasser par un upload.

**Acceptance Criteria :**

**Given** l'auteur édite une scène (`app/stories/[id]/edit/[sceneId]/page.tsx`)
**When** il clique sur "Choisir depuis la médiathèque" dans le sélecteur de fond
**Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "selector", filter: "images", initialFolder: "backgrounds" }}`

**Given** la modale est ouverte en mode sélecteur
**When** l'auteur clique sur une vignette image
**Then** `config.onSelect(asset)` est appelé avec l'asset choisi
**And** la modale se ferme
**And** le fond de la scène est mis à jour avec l'`AssetRef` sélectionné (`{ id, url }`)
**And** `resolveAsset(ref)` est utilisé pour afficher la preview du fond

### Story 3.3 : Sélecteur de sprite dialogue via médiathèque

En tant qu'auteur,
je veux choisir le sprite d'un personnage dans un nœud dialogue depuis ma médiathèque,
afin d'associer rapidement une pose existante sans naviguer hors de l'éditeur.

**Acceptance Criteria :**

**Given** l'auteur édite un nœud dialogue et a sélectionné un personnage (`DialogueFields`)
**When** il clique sur "Choisir depuis la médiathèque" dans le sélecteur de sprite
**Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "selector", filter: "images", allowedFolders: ["characters"] }}`

**Given** la modale est ouverte avec `allowedFolders: ["characters"]`
**When** `FolderTree` s'affiche
**Then** seuls les dossiers sous `characters/` sont navigables

**Given** l'auteur clique sur une vignette dans la modale
**When** `config.onSelect(asset)` est appelé
**Then** la modale se ferme
**And** le sprite du nœud dialogue est mis à jour avec l'`AssetRef` sélectionné
**And** `resolveAsset(ref)` est utilisé pour afficher la preview du sprite dans `DialogueFields`

---

## Epic 4 : Import de personnage par dossier

Les auteurs importent un set de sprites complet en sélectionnant un dossier dans la médiathèque, avec mapping automatique des poses et confirmation si des sprites existaient.

### Story 4.1 : Sélection de dossier et mapping automatique des poses

En tant qu'auteur,
je veux sélectionner un dossier dans la médiathèque pour importer automatiquement les poses d'un personnage,
afin d'éviter d'uploader les sprites un par un.

**Acceptance Criteria :**

**Given** l'auteur est dans `CharacterBasicForm` pour créer ou éditer un personnage
**When** il clique sur le bouton "Importer depuis la médiathèque"
**Then** `MediaLibraryModal` s'ouvre avec `config={{ mode: "folder-selector", allowedFolders: ["characters"] }}`
**And** seuls les dossiers sous `characters/` sont navigables dans `FolderTree`

**Given** l'auteur sélectionne le dossier `characters/alice`
**When** il clique "Sélectionner ce dossier"
**Then** `config.onSelectFolder("characters/alice")` est appelé et la modale se ferme
**And** `GET /api/assets?folder=characters/alice` est appelé pour récupérer les assets du dossier (niveau direct uniquement)

**Given** le dossier contient `default.png`, `happy.png`, `surprised.png`
**When** le mapping automatique s'effectue côté frontend
**Then** `default.png` est mappé vers la clé de pose `"default"` (AssetRef `{ id, url }`)
**And** `happy.png` est mappé vers la clé `"happy"`
**And** `surprised.png` est mappé vers la clé `"surprised"`
**And** les fichiers non-image dans le dossier sont ignorés

**Given** le dossier contient `default.jpg`
**When** le mapping s'effectue
**Then** la clé de pose est `"default"` (stem sans extension, indépendamment du format)

### Story 4.2 : Confirmation, enregistrement et compatibilité du workflow

En tant qu'auteur,
je veux valider l'import et conserver la possibilité d'éditer manuellement les poses,
afin d'avoir le contrôle total sur le résultat final.

**Acceptance Criteria :**

**Given** le personnage n'a aucun sprite existant
**When** le mapping de dossier est effectué
**Then** les poses mappées sont appliquées directement à `character.sprites` sans confirmation
**And** `PUT /api/stories/{storyId}/characters/{id}` est appelé avec les sprites mis à jour

**Given** le personnage a déjà des sprites définis
**When** le mapping de dossier est effectué
**Then** un `ConfirmModal` s'affiche : "Ce personnage a déjà des sprites. L'import les remplacera. Confirmer ?"
**And** si confirmé → `PUT /api/stories/{storyId}/characters/{id}` est appelé avec les nouveaux sprites
**And** si annulé → les sprites existants sont conservés inchangés

**Given** l'import a été effectué avec succès
**When** l'auteur ouvre `CharacterPosesManager` pour ce personnage
**Then** toutes les poses importées sont éditables : ajout, renommage, suppression individuelle fonctionnent normalement
**And** la pose `"default"` affiche le badge "défaut" non renommable (comportement existant préservé)

**Given** l'auteur est dans `CharacterPosesManager` après un import
**When** il utilise le bouton d'upload manuel d'une pose
**Then** le flux d'upload manuel fonctionne normalement en complément de l'import par dossier
