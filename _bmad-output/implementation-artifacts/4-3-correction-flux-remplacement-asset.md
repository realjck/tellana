---
baseline_commit: "e129d7d9b8153ed4f4047ee183bc49f3bc7e86b5"
---

# Story 4.3 — Correction du flux de remplacement d'asset (conflit même nom)

## Statut

done

## Contexte

Quand un utilisateur uploade un fichier dont le nom existe déjà dans le même dossier, le backend répond 409 avec `{ existing_id, references: { scenes, nodes } }` et le frontend affiche un `ConfirmModal`. Trois bugs sont présents :

**Bug 1 — Références toujours 0 (backend)** : `_count_references` dans `backend/routers/assets.py` cherche l'URL dans `Scene.background_asset` et `Node.data`, mais **jamais dans `Character.sprites`**. Or les sprites de personnages sont stockés dans `Character.sprites: JSON` (colonne `sprites` sur le modèle `Character`). Pour un fichier `characters/alice/default.png`, tous les compteurs restent à 0.

**Bug 2 — Bouton "Supprimer" au lieu de "Remplacer" (frontend)** : `ConfirmModal` n'a pas de prop `confirmLabel`, il affiche toujours "Supprimer". Dans le contexte d'un remplacement, ce libellé est trompeur.

**Bug 3 — "Aucun effet" visuel après remplacement (frontend)** : Après confirmation, le fichier est correctement remplacé sur le serveur, mais le `<img>` garde l'ancienne image en cache navigateur (même URL, pas de cache-busting). L'utilisateur ne voit pas la nouvelle image dans la grille. Il ne la voit que dans la publication.

## User Story

En tant qu'auteur,
je veux que le flux de remplacement d'un asset en conflit de nom fonctionne correctement,
afin de mettre à jour mes images depuis la médiathèque sans erreur ni confusion.

## Acceptance Criteria

### AC1 — Références correctes dans le 409

**Given** un asset `characters/alice/default.png` référencé dans `Character.sprites["default"]` pour 2 personnages
**When** l'utilisateur uploade un nouveau `default.png` dans `characters/alice`
**Then** le backend répond `409 { existing_id, references: { scenes: 0, nodes: 0, characters: 2 } }`

**Given** un asset `backgrounds/foret.jpg` utilisé comme `background_asset` dans 3 scènes
**When** l'utilisateur uploade un nouveau `foret.jpg` dans `backgrounds`
**Then** le backend répond `409 { existing_id, references: { scenes: 3, nodes: 0, characters: 0 } }`

**Given** un asset non référencé nulle part
**When** l'utilisateur uploade un fichier du même nom
**Then** le backend répond `409 { existing_id, references: { scenes: 0, nodes: 0, characters: 0 } }`

### AC2 — Message et bouton corrects dans le ConfirmModal

**Given** un conflit 409 détecté côté frontend
**When** le `ConfirmModal` s'affiche
**Then** le message est : `Ce fichier remplacera "{filename}" utilisé dans {scenes} scène(s), {nodes} nœud(s) et {characters} personnage(s). Continuer ?`
**And** le bouton de confirmation affiche "Remplacer" (et non "Supprimer")
**And** le bouton d'annulation affiche "Annuler"

### AC3 — Remplacement effectif et visible

**Given** l'utilisateur confirme le remplacement en cliquant "Remplacer"
**When** le `POST /api/assets?replace=true` est envoyé et retourne 200
**Then** la grille se rafraîchit et affiche la nouvelle image sans cache navigateur
**And** l'asset existant conserve son `id` (les `AssetRef` existantes pointant vers cet id restent valides)

## Tasks/Subtasks

- [x] T1: Corriger `_count_references` dans `backend/routers/assets.py`
  - [x] T1a: Ajouter la requête sur `Character.sprites` (JSON) — compter les personnages dont `sprites` contient une valeur dont `url == existing.url`
  - [x] T1b: Retourner `{ scenes, nodes, characters }` au lieu de `{ scenes, nodes }`
  - [x] T1c: Mettre à jour les tests backend concernés
- [x] T2: Ajouter prop `confirmLabel` à `ConfirmModal`
  - [x] T2a: `confirmLabel?: string` (défaut `"Supprimer"` pour préserver le comportement existant)
  - [x] T2b: Mettre à jour les tests `ConfirmModal` si nécessaire
- [x] T3: Mettre à jour `UploadDropZone.tsx`
  - [x] T3a: Mettre à jour le type `ConflictInfo` → `references: { scenes, nodes, characters }`
  - [x] T3b: Message du `ConfirmModal` avec le champ `characters`
  - [x] T3c: Passer `confirmLabel="Remplacer"` au `ConfirmModal`
  - [x] T3d: Cache-busting : après replace réussi, forcer le rechargement de l'image en ajoutant `?v={Date.now()}` à l'URL de l'asset retourné par le backend, ou via une clé SWR invalidée
- [x] T4: Mettre à jour le type frontend `uploadMedia` dans `lib/api.ts`
  - [x] T4a: `references: { scenes: number; nodes: number; characters: number }`
- [x] T5: Tests frontend
  - [x] T5a: `UploadDropZone.test.tsx` — vérifier le message avec `characters`, bouton "Remplacer"

## Périmètre

**Dans cette story :**
- Fix backend `_count_references` → inclure `Character.sprites`
- Prop `confirmLabel` sur `ConfirmModal`
- Message + bouton corrects dans `UploadDropZone`
- Cache-busting après remplacement réussi

**Hors périmètre :**
- Refactor global du flux d'upload
- Cache-busting global sur toutes les images de l'application

## Dev Notes

### Bug 1 — Fix `_count_references` (backend)

Fichier : `backend/routers/assets.py`, fonction `_count_references` (ligne ~47).

Ajouter le comptage des personnages dont `sprites` JSON contient l'URL :
```python
character_count = sum(
    1 for char in db.query(models.Character).all()
    if url in json.dumps(char.sprites or {})
)
return {"scenes": scene_count, "nodes": node_count, "characters": character_count}
```

**Attention** : `json.dumps(char.sprites or {})` est un substring match comme pour les nodes. C'est intentionnel — même pattern que la ligne existante pour `node.data`.

Le schéma de réponse 409 dans la route `POST /` doit retourner le nouveau champ. Pas besoin de schéma Pydantic formel ici — c'est retourné dans un `JSONResponse` directement.

### Bug 2 — Prop `confirmLabel` sur `ConfirmModal`

Fichier : `frontend/components/ConfirmModal.tsx`.

Interface actuelle :
```typescript
interface Props { message: string; onConfirm: () => void; onCancel: () => void; }
```

À modifier en :
```typescript
interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}
```

Le bouton confirm utilise `confirmLabel ?? "Supprimer"` pour préserver tous les usages existants.

### Bug 3 — Cache-busting

Après `uploadFile(pending.file, true)`, le backend retourne l'asset mis à jour. L'URL est identique (`/uploads/folder/filename`). Le navigateur met en cache les images par URL.

Solution légère : après un replace réussi, invalider le SWR avec `mutate(["assets", folder])` (déjà fait) **et** forcer le rechargement des images affectées en stockant un timestamp dans l'état local `refreshToken` qui est passé comme `key` prop sur les `<img>` de l'asset remplacé. 

Alternative plus simple : dans `AssetGrid`, utiliser `src={resolveAsset(asset.url) + "?v=" + asset.id}` ou ne rien faire (SWR refetch met à jour les données mais les images se rechargent au prochain render avec cache invalidé via `mutate`). À évaluer lors de l'implémentation.

**Note** : le `mutate(["assets", folder])` déclenche un re-fetch SWR. Si l'asset retourné a le même `id` et la même `url`, React ne force pas un rechargement du `<img>`. Le cache-busting le plus simple est d'ajouter `?t={Date.now()}` à l'URL de l'image **uniquement** pour l'asset remplacé, en stockant temporairement son `id` dans l'état de `AssetGrid` après le remplacement.

### Tests backend existants

Vérifier `backend/tests/test_assets.py` — les tests sur le 409 vérifient probablement la structure `{ scenes, nodes }`. Mettre à jour pour `{ scenes, nodes, characters }`.

### Patterns existants à respecter

- `ConfirmModal` : ne PAS changer le comportement par défaut — `confirmLabel` est optionnel avec défaut `"Supprimer"`
- `UploadDropZone` : le flux `Promise.allSettled` + `mutate` en fin de `handleFiles` reste inchangé
- Clés SWR : toujours muter `["assets", folder]` + `"asset-folders"` ensemble

## Fichiers concernés

- `backend/routers/assets.py` — fix `_count_references`
- `frontend/components/ConfirmModal.tsx` — ajout `confirmLabel` prop
- `frontend/components/media-library/UploadDropZone.tsx` — message + label + cache-busting
- `frontend/lib/api.ts` — type `references` étendu avec `characters`
- `backend/tests/test_assets.py` — mise à jour tests 409

## Dev Agent Record

### Debug Log

_Aucun blocage._

### Completion Notes

- `_count_references` dans `backend/routers/assets.py` : ajout du comptage `Character.sprites` via `json.dumps(char.sprites or {})` (même pattern substring que `node.data`). Retourne maintenant `{ scenes, nodes, characters }`.
- 1 nouveau test backend `test_upload_same_name_conflict_with_character_sprites` + 2 tests existants mis à jour pour inclure `"characters": 0/N`.
- `ConfirmModal.tsx` : ajout `confirmLabel?: string` (défaut `"Supprimer"` — rétrocompatible). Tous les usages existants inchangés.
- `UploadDropZone.tsx` : `ConflictInfo.references` étendu avec `characters`. Message 409 mis à jour. `confirmLabel="Remplacer"`. `uploadFile` retourne `Asset | null`. Prop `onReplaceSuccess?: (assetId: number) => void` : appelée après replace réussi.
- `AssetGrid.tsx` : `bustMap` state (`Record<number, number>`). Passe `onReplaceSuccess` à `UploadDropZone`. Img src avec `?v=${bustMap[id]}` pour forcer le rechargement navigateur après replace.
- `lib/api.ts` : type `references` étendu avec `characters: number`.
- 140 tests Jest passent + 126 tests pytest. 0 erreur TypeScript.

## File List

- `backend/routers/assets.py`
- `backend/tests/test_assets.py`
- `frontend/components/ConfirmModal.tsx`
- `frontend/components/media-library/UploadDropZone.tsx`
- `frontend/components/media-library/AssetGrid.tsx`
- `frontend/lib/api.ts`
- `frontend/__tests__/media-library/UploadDropZone.test.tsx`
- `frontend/__tests__/media-library/AssetGrid.test.tsx`

## Change Log

- Fix `_count_references` : inclure `Character.sprites` dans le comptage — retourne `{ scenes, nodes, characters }` (Date: 2026-06-16)
- Ajout `confirmLabel` prop sur `ConfirmModal` (Date: 2026-06-16)
- `UploadDropZone` : message 409 avec `characters`, bouton "Remplacer", cache-busting via `onReplaceSuccess` (Date: 2026-06-16)
- `AssetGrid` : cache-busting `bustMap` pour rechargement immédiat après remplacement d'image (Date: 2026-06-16)

## Review Findings

- [x] [Review][Patch] (CORRIGÉ 2026-06-16) Élargir le cache-busting hors de la médiathèque (décision jck, 2026-06-16) — l'image remplacée reste périmée partout ailleurs — AC3 est satisfait au sens strict (la grille se rafraîchit via `bustMap` dans `AssetGrid.tsx:181`), mais le `?v=` n'est appliqué nulle part ailleurs. `CharacterManager` (liste), `ScenePlayer`, `ScenePreviewThumbnail`, `CharacterPosesDrawer` affichent tous `resolveAsset(ref)` sans cache-bust. Après un remplacement, l'utilisateur voit la nouvelle image dans la grille mais l'ANCIENNE dans l'éditeur de perso, les miniatures et le player. C'est le « dysfonctionnement à l'usage » le plus probable. Le cache-busting global a été explicitement mis hors périmètre — décision requise : ne rien faire (respect du scope), ou élargir (ex. invalider via une version d'asset persistée plutôt qu'un état local éphémère).
