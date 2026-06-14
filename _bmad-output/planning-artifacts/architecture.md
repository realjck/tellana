---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-06-14'
lastStep: 8
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-tellana-2026-06-14/prd.md'
  - '_bmad-output/project-context.md'
  - 'docs/data-models-backend.md'
  - 'docs/architecture-backend.md'
  - 'docs/architecture-frontend.md'
  - 'docs/component-inventory-frontend.md'
workflowType: 'architecture'
project_name: 'tellana'
user_name: 'jck'
date: '2026-06-14'
feature: 'Médiathèque structurée'
---

# Architecture Decision Document — Médiathèque structurée

_Ce document se construit collaborativement étape par étape. Les sections sont ajoutées au fil des décisions architecturales._

---

## Analyse de contexte du projet

### Vue d'ensemble des exigences

**Exigences fonctionnelles (17 FRs, 4 features) :**
- **F1** — Extension modèle `Asset` : champ `folder` string path + endpoints filtrés
- **F2** — Modale médiathèque CMS-style : 2 modes (navigation / sélecteur), arborescence, grille, drag & drop multi-upload, rename inline, delete, substitution fichier
- **F3** — Assets de seed Alice & Bob : starter kit lecture seule, initialisés au démarrage
- **F4** — Import personnage par dossier : auto-mapping poses depuis `characters/{folder}/`

**Exigences non-fonctionnelles :**
- Idempotence du seed au redémarrage
- Rétrocompatibilité totale des `AssetRef` existants (aucune migration JSON)
- Protection des seeds contre suppression/remplacement
- Substitution de fichier avec affichage de l'impact réel (X scènes, Y nœuds)

### Évaluation de la complexité

- **Domaine principal :** full-stack web (FastAPI + Next.js)
- **Niveau de complexité :** moyen — backend extension propre, complexité concentrée dans la modal frontend
- **Composants architecturaux estimés :** 1 migration DB, 1 nouveau router backend, 1 composant modal principal + 3 sous-composants, 5 points d'intégration existants

### Contraintes techniques et dépendances

- SQLAlchemy sync uniquement (pas d'AsyncSession)
- Migration via `try/except ALTER TABLE ADD COLUMN` dans `main.py` (pas d'Alembic)
- Pas de couche service — logique dans `routers/`
- `resolveAsset()` obligatoire côté frontend — `AssetRef` ne change pas
- SWR avec `mutate()` pour l'invalidation cache après upload/delete/rename
- `ConfirmModal` pour toute confirmation destructive

### Préoccupations transversales identifiées

- **Gestion des dossiers** : représentation string path en DB, arborescence dérivée en mémoire côté frontend (pas de table Folder)
- **Protection des seeds** : champ `is_seed: bool` sur `Asset`, guard `403` dans le router DELETE
- **Modes de la modal** : pattern `MediaLibraryConfig` objet unique passé en prop — `{ mode, filter, onSelect, allowedFolders? }`
- **UX mode sélecteur** : bandeau contextuel persistant + simple clic = sélection (pas double-clic)
- **Import personnage** : écran de confirmation intermédiaire avec récapitulatif des poses détectées

### Décisions d'architecture anticipées (Party Mode)

| Décision | Choix retenu |
|---|---|
| Modèle dossiers | String path sur `Asset`, pas de table `Folder` |
| Seeds protection | `is_seed: bool`, 403 sur DELETE, idempotence via `(folder, filename)` |
| `AssetRef` | Inchangé `{id, url}` — `folder` non embarqué (Option A) |
| Dossier `audio/` | Reporté post-v1 |
| Substitution fichier | Warning avec impact concret (X scènes, Y nœuds) |
| Double-clic | Rename en mode navigation uniquement |

---

## Foundation technique

Projet existant — aucun starter à évaluer. Stack établie :

- **Backend :** FastAPI 0.115 · SQLAlchemy 2.0 sync · SQLite · Python 3.10+
- **Frontend :** Next.js 16.2 · React 19 · TypeScript strict · Tailwind v4 · SWR 2.4
- **Tests :** pytest ≥8 (60 tests) · Jest 30 (39 tests) · Playwright 1.59

La feature s'intègre dans le codebase existant sans initialisation de projet.

---

## Décisions architecturales principales

### Résumé des décisions (Step 4)

| # | Domaine | Décision retenue |
|---|---------|-----------------|
| D1 | Listing des dossiers | `GET /api/assets/folders` — endpoint dédié, dérive l'arborescence en mémoire depuis les champs `folder` existants en DB |
| D2 | Renommage de dossier | `PATCH /api/assets/folders` body `{from, to}` — UPDATE SQL en masse sur tous les assets du dossier (et sous-dossiers via prefix match) |
| D3 | Création dossier vide | Asset placeholder `.keep` (filtré côté frontend) — pas de table `Folder`, cohérent avec le modèle string path |
| D4 | Structure composants modal | `components/media-library/` avec `MediaLibraryModal.tsx` + `FolderTree.tsx` + `AssetGrid.tsx` + `UploadDropZone.tsx` |
| D5 | Clés SWR | `["assets", folder]` par dossier + `"asset-folders"` global — invalidation ciblée après upload/delete/rename |
| D6 | Stockage disque | Mirror de la structure dossier : `uploads/characters/alice/default.png` — `os.makedirs(exist_ok=True)` à l'upload, URLs `/uploads/{folder}/{filename}` |
| D7 | Mapping import personnage | Frontend — `GET /api/assets?folder=characters/alice`, stem du filename → clé de pose (`default.png` → `"default"`) |

### Détail des décisions critiques

#### D6 — Stockage disque miroir

- Nouveaux assets : chemin `uploads/{folder}/{filename}` avec sous-dossiers créés à la volée
- Assets existants (URL plat `/uploads/filename`) : rétrocompatibles sans migration — FastAPI sert `uploads/` en StaticFiles récursivement
- `AssetRef.url` = `/uploads/{folder}/{filename}` pour les nouveaux assets — `resolveAsset()` inchangé (préfixe URL backend)
- Substitution same-name : détection via requête `(folder, filename)` en DB avant save, `ConfirmModal` avec impact (N scènes, M persos), remplacement fichier physique + update `url` en DB

#### D3 — Placeholder `.keep`

- Asset DB avec `filename=".keep"`, `content_type="application/x-empty"`, `is_seed=False`
- Filtré dans `AssetGrid` : `assets.filter(a => a.filename !== '.keep')`
- Supprimé automatiquement si un vrai asset est uploadé dans le dossier (ou laissé — pas de nettoyage obligatoire)

#### D2 — Rename dossier

- `PATCH /api/assets/folders` body `{ from: "characters/alice", to: "characters/alice-v2" }`
- Backend : UPDATE SQL `SET folder = REPLACE(folder, :from, :to) WHERE folder = :from OR folder LIKE :from || '/%'`
- Rename dossier sur disque : `os.rename(uploads/from, uploads/to)`
- Idempotent — si `to` n'existe pas déjà

#### Seeds (F3)

- Fichiers images dans `backend/seed_assets/characters/alice/` et `.../bob/`
- Chargement au démarrage dans `main.py` via `startup_event` (ou `lifespan`) : `shutil.copy2` si fichier absent dans `uploads/`, INSERT en DB si asset `(folder, filename)` absent
- `is_seed=True` sur tous les assets seed
- Guard `DELETE /api/assets/{id}` : `HTTPException(403)` si `asset.is_seed`
- L'utilisateur peut néanmoins supprimer les seeds via l'UI (bouton visible mais confirmation explicite) — CORRECTION : FR-3.4 dit supprimable normalement → pas de guard 403, `is_seed` sert uniquement à l'affichage d'un badge "seed" dans la médiathèque

---

## Patterns d'implémentation & règles de consistance

### Naming Patterns

**Backend — nouveaux endpoints**

| Endpoint | Pattern |
|---|---|
| `GET /api/assets` | param `?folder=characters/alice` — slash POSIX, pas d'encodage spécial |
| `GET /api/assets/folders` | liste les dossiers distincts — pas `/api/folders` |
| `PATCH /api/assets/folders` | body `{ from: str, to: str }` — snake_case |
| `PATCH /api/assets/{id}/rename` | body `{ filename: str }` — rename fichier seul |
| `DELETE /api/assets/{id}` | existant, guard `is_seed` à ne PAS ajouter (FR-3.4) |
| `POST /api/assets` | existant, champ `folder` ajouté en multipart |

Champ `folder` — valeur toujours slash POSIX (`characters/alice`), jamais backslash. Backend normalise via `folder.replace('\\', '/')` en entrée.

**Frontend — fichiers**

```
components/media-library/
  MediaLibraryModal.tsx       # composant racine, reçoit MediaLibraryConfig
  FolderTree.tsx              # panneau gauche arborescence
  AssetGrid.tsx               # grille droite miniatures
  UploadDropZone.tsx          # zone drag & drop intégrée dans AssetGrid
```

Pas de fichier `index.ts` barrel — import direct du composant (`@/components/media-library/MediaLibraryModal`).

### Structure Patterns

**Config objet `MediaLibraryConfig`** — toujours passé comme prop unique :

```typescript
type MediaLibraryConfig = {
  mode: "navigation" | "selector" | "folder-selector"
  filter?: "images" | "all"
  onSelect?: (asset: Asset) => void
  onSelectFolder?: (folder: string) => void
  allowedFolders?: string[]
  initialFolder?: string
}
```

**Clés SWR** — convention stricte :

```typescript
useSWR(["assets", folder], ...)     // assets d'un dossier spécifique
useSWR("asset-folders", ...)        // liste des dossiers
```

Invalidation après mutation : `mutate(["assets", currentFolder])` + `mutate("asset-folders")` — les deux, toujours ensemble.

### Format Patterns

**Schéma `Asset`** — nouveau champ ajouté :

```python
class Asset(BaseModel):
    id: int
    filename: str
    url: str          # "/uploads/{folder}/{filename}"
    content_type: str
    folder: str       # ex. "characters/alice"
    is_seed: bool
```

**`GET /api/assets/folders`** retourne une liste plate triée :
```json
["backgrounds", "characters", "characters/alice", "characters/bob"]
```
Pas d'objet wrapper, pas de structure arborescente — l'arborescence est dérivée côté frontend.

**Upload multipart** — champs :
```
file: File
folder: str  (défaut "backgrounds" si absent)
```
`filename` toujours dérivé de `file.filename`, jamais passé séparément.

### Process Patterns

**Substitution same-name** :
1. Backend : `SELECT * FROM assets WHERE folder=:folder AND filename=:filename`
2. Si trouvé → `409 Conflict` body `{ existing_id: int, references: { scenes: int, nodes: int } }`
3. Frontend → `ConfirmModal` → confirmation → `POST /api/assets?replace=true`
4. Backend écrase le fichier physique, met à jour `url` en DB sur l'asset existant

**Dossier vide** : `POST /api/assets` avec fichier vide `.keep`, `content_type="application/x-empty"`. Filtré dans `AssetGrid` : `assets.filter(a => a.filename !== '.keep')`.

**Seed au démarrage** (`main.py` lifespan) : idempotent — `shutil.copy2` si fichier absent + INSERT si `(folder, filename)` absent en DB.

**Rename dossier** : `os.rename` uniquement si `from != to` et `to` n'existe pas → `HTTPException(409)` sinon.

### Enforcement — règles absolues pour tous les agents

- `resolveAsset(ref)` obligatoire côté frontend — jamais `ref.url` direct
- `folder` normalisé en POSIX slash à l'entrée backend ET au moment de la saisie frontend
- `.keep` toujours filtré avant affichage — jamais rendu dans la grille
- `is_seed` lu depuis l'asset — pas de liste hardcodée frontend
- `mutate(["assets", folder])` + `mutate("asset-folders")` à chaque mutation — les deux ensemble
- `os.makedirs(os.path.join(UPLOAD_DIR, folder), exist_ok=True)` avant tout write d'upload

---

## Structure du projet & frontières

### Arborescence — fichiers nouveaux et modifiés

```
backend/
├── main.py                          # MODIFIÉ — migration folder+is_seed, seed loader au démarrage
├── models.py                        # MODIFIÉ — Asset.folder + Asset.is_seed
├── seed_assets/                     # NOUVEAU — images de seed (commit dans le repo)
│   └── characters/
│       ├── alice/
│       │   ├── default.png
│       │   ├── happy.png
│       │   └── surprised.png
│       └── bob/
│           ├── default.png
│           ├── happy.png
│           └── surprised.png
├── routers/
│   └── assets.py                    # MODIFIÉ — upload+folder, GET /folders, PATCH /folders,
│                                    #           PATCH /{id}/rename, is_seed badge
└── uploads/                         # runtime — structure miroir dossiers
    ├── characters/
    │   ├── alice/
    │   └── bob/
    └── backgrounds/

frontend/
├── lib/
│   └── api.ts                       # MODIFIÉ — type Asset (+ folder, is_seed)
├── components/
│   ├── media-library/               # NOUVEAU — dossier feature
│   │   ├── MediaLibraryModal.tsx    # modale racine + MediaLibraryConfig
│   │   ├── FolderTree.tsx           # panneau gauche arborescence
│   │   ├── AssetGrid.tsx            # grille miniatures + filtrage .keep
│   │   └── UploadDropZone.tsx       # zone drag & drop multi-fichiers
│   ├── CharacterBasicForm.tsx       # MODIFIÉ — bouton "Importer depuis médiathèque"
│   └── CharacterPosesManager.tsx    # MODIFIÉ — accès médiathèque depuis poses
└── app/
    ├── layout.tsx                   # MODIFIÉ — bouton Médiathèque dans navbar globale
    └── stories/
        └── [id]/
            ├── layout.tsx           # MODIFIÉ — bouton Médiathèque navbar story
            └── edit/
                └── [sceneId]/
                    └── page.tsx     # MODIFIÉ — sélecteur fond de scène via médiathèque
```

### Mapping features → fichiers

| Feature | Backend | Frontend |
|---|---|---|
| **F1** — champ `folder` | `models.py`, `main.py`, `routers/assets.py` | `lib/api.ts` (type) |
| **F2** — modale médiathèque | `routers/assets.py` (endpoints) | `components/media-library/*` + `layout.tsx` |
| **F3** — seeds Alice & Bob | `seed_assets/`, `main.py` (lifespan) | `AssetGrid.tsx` (badge is_seed) |
| **F4** — import par dossier | `GET /api/assets?folder=` (existant) | `CharacterBasicForm.tsx` + mapping frontend |

### Frontières d'intégration

**API → Frontend (nouveaux flux)**

```
MediaLibraryModal
  ├── useSWR("asset-folders")          → GET /api/assets/folders
  ├── useSWR(["assets", folder])       → GET /api/assets?folder=X
  ├── UploadDropZone                   → POST /api/assets (multipart + folder)
  ├── rename inline                    → PATCH /api/assets/{id}/rename
  ├── rename dossier                   → PATCH /api/assets/folders
  └── delete                          → DELETE /api/assets/{id}

CharacterBasicForm
  └── "Importer depuis médiathèque"
        → MediaLibraryModal (mode: "folder-selector", allowedFolders: ["characters"])
        → onSelectFolder(folder)
        → GET /api/assets?folder={folder}
        → mapping stem → pose key
        → PUT /api/stories/{storyId}/characters/{id}
```

**Points d'intégration existants modifiés**

| Point | Modification |
|---|---|
| Sélecteur fond de scène | Bouton "Choisir depuis médiathèque" → mode `selector`, `filter: "images"`, `initialFolder: "backgrounds"` |
| `DialogueFields` sélecteur sprite | Même pattern → `allowedFolders: ["characters"]` |
| Navbar `app/layout.tsx` | Bouton "Médiathèque" → `MediaLibraryModal` mode `navigation` |

### Tests — emplacements

```
backend/tests/
└── test_assets.py          # MODIFIÉ — nouveaux endpoints + migration + seed

frontend/__tests__/
└── media-library/
    ├── MediaLibraryModal.test.tsx
    ├── FolderTree.test.tsx
    └── AssetGrid.test.tsx
```

### Flux de données — upload

```
User drop files
  → UploadDropZone
  → POST /api/assets (file, folder)
  → backend: os.makedirs + write file + INSERT Asset
  → 200 Asset | 409 Conflict { existing_id, references }
  → si 409 : ConfirmModal → POST /api/assets?replace=true
  → mutate(["assets", folder]) + mutate("asset-folders")
  → AssetGrid re-render
```

---

## Résultats de validation de l'architecture

### Validation de cohérence ✅

**Compatibilité des décisions :**
- Stack établi (FastAPI sync + SQLite + Next.js 16 + React 19 + SWR) — aucun conflit de version, aucune dépendance nouvelle
- D6 (stockage miroir) + D1 (listing dossiers depuis DB) : cohérents — la DB est la source de vérité pour les dossiers, pas le disque
- D3 (placeholder `.keep`) + D5 (clés SWR) : cohérents — upload `.keep` via même `POST /api/assets`, invalidation identique
- D7 (mapping frontend) + D4 (structure modal) : cohérents — `CharacterBasicForm` appelle `MediaLibraryModal` en mode `folder-selector`, pas d'endpoint nouveau

**Consistance des patterns :**
- Tous les endpoints préfixés `/api/`, body snake_case — aligné avec le codebase existant
- Clés SWR en tableau pour requêtes paramétrées, en string pour globales — cohérent
- `components/media-library/` : structure plate, pas de couches supplémentaires — conforme à l'architecture volontairement plate du projet

**Alignement structurel :**
- `__tests__/media-library/` respecte le `testMatch` Jest configuré
- `backend/seed_assets/` : nouveau répertoire commité dans le repo, logiquement isolé du runtime `uploads/`

### Validation de couverture des exigences ✅

| Feature | FRs | Couverture |
|---|---|---|
| F1 — champ `folder` | FR-1.1 à 1.5 | ✅ migration, filtre `?folder=`, POST avec folder, type API |
| F2 — modale médiathèque | FR-2.1 à 2.8 | ✅ 4 composants, 3 modes config, substitution same-name, rename, delete |
| F3 — seeds | FR-3.1 à 3.5 | ✅ `seed_assets/`, lifespan loader, `is_seed`, supprimable (FR-3.4 — pas de guard 403) |
| F4 — import dossier | FR-4.1 à 4.5 | ✅ mode `folder-selector`, mapping stem→pose, écrase avec confirmation |

**NFR :**
- ✅ Idempotence seed : INSERT uniquement si `(folder, filename)` absent
- ✅ Rétrocompatibilité `AssetRef` : structure `{id, url}` inchangée, `resolveAsset()` inchangé
- ✅ Substitution avec impact réel : 409 + `{ references: { scenes, nodes } }` avant `ConfirmModal`

**FR-4.2 vérifié** : `GET /api/assets?folder=characters/alice` = exact match (pas prefix) — niveau direct uniquement, conforme à "sans récursion".

### Analyse des gaps

**Gaps importants (non bloquants) :**
- **Création dossier vide — flow UI** : bouton "Nouveau dossier" dans `FolderTree` → saisie nom → `POST /api/assets` avec `.keep` — flow dérivable des patterns mais non explicité. Mitigation : l'agent peut dériver du pattern D3.
- **Atomicité rename dossier** : si `PATCH /api/assets/folders` réussit l'UPDATE SQL mais `os.rename` échoue → état incohérent. Mitigation : faire `os.rename` en premier, rollback SQL si échec OS.

**Gaps mineurs :**
- Tests Playwright E2E non documentés pour la médiathèque (hors scope immédiat)
- Validation MIME type backend toujours côté client uniquement (limitation prototype existante)

### Checklist de complétude

**Analyse des exigences**
- [x] Contexte projet analysé (project-context.md, docs/*)
- [x] Complexité évaluée (feature medium, concentrée sur la modal)
- [x] Contraintes techniques identifiées (SQLAlchemy sync, pas d'Alembic, resolveAsset)
- [x] Préoccupations transversales mappées (seeds, rétrocompatibilité, modes modal)

**Décisions architecturales**
- [x] 7 décisions critiques documentées avec options et rationale
- [x] Stack complet spécifié (versions dans Foundation technique)
- [x] Patterns d'intégration définis (SWR keys, MediaLibraryConfig, endpoints)
- [x] Considérations de performance adressées (invalidation ciblée, pas de refetch global)

**Patterns d'implémentation**
- [x] Conventions de nommage établies (endpoints, champs, composants, fichiers)
- [x] Patterns de structure définis (dossier feature, pas de barrel)
- [x] Patterns de communication spécifiés (SWR keys, mutate double)
- [x] Patterns de processus documentés (substitution, rename, seed, dossier vide)

**Structure du projet**
- [x] Arborescence complète avec annotations NOUVEAU/MODIFIÉ
- [x] Frontières de composants établies (MediaLibraryConfig prop unique)
- [x] Points d'intégration mappés (4 points d'entrée UX)
- [x] Mapping features → fichiers complet

### Évaluation de la préparation

**Statut global : READY FOR IMPLEMENTATION**

**Niveau de confiance : élevé** — stack établi, patterns existants réutilisés, aucun nouvel outil externe introduit.

**Points forts :**
- Zéro breaking change sur les `AssetRef` existants — intégration progressive possible
- Seeds commités dans le repo — pas de setup manuel au premier lancement
- Modal configurable par un seul objet `MediaLibraryConfig` — 4 points d'entrée sans duplication de logique

**Axes d'amélioration future :**
- Atomicité rename dossier (os.rename avant SQL)
- Tests E2E Playwright pour la médiathèque
- Validation MIME côté backend (post-prototype)

### Handoff d'implémentation

**Ordre de build recommandé :**
1. Backend — migration DB (`folder`, `is_seed`) + seed loader lifespan + endpoints assets
2. Frontend — type `Asset` étendu + `components/media-library/` (modal + sous-composants)
3. Intégration — 4 points d'entrée UX (navbar, sélecteur fond, sélecteur sprite, import personnage)

**Pour les agents AI :**
- Lire `_bmad-output/project-context.md` en premier — contient les règles critiques non-évidentes
- `resolveAsset()` obligatoire côté frontend — jamais `ref.url` directement
- `_touch_story()` dans scenes/nodes/characters — inchangé, ne pas oublier
