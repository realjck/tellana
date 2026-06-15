# Deferred Work

## Deferred from: code review of 2-5-assets-de-seed-alice-bob (2026-06-15)

- `db.commit()` sans try/except dans `_load_seeds` : désync fichier/DB si le commit échoue à mi-parcours — auto-guérissant au prochain restart ; prototype SQLite — `backend/main.py`.
- Race condition multi-worker : deux processus `lifespan` simultanés peuvent double-copier/double-insérer — prototype single-worker, `backend/main.py`.
- `folder="."` si un PNG est à la racine de `seed_dir` : URL `/uploads/./foo.png` invalide — impossible avec la structure `seed_assets/characters/{persona}/` actuelle, `backend/main.py`.
- N requêtes SELECT séparées dans `_load_seeds` (une par fichier) au lieu d'un batch — 6 fichiers, négligeable, `backend/main.py`.
- `db_session` fixture : `drop_all` après `close()` — fonctionne avec StaticPool SQLite, `backend/tests/test_seed.py`.
- Tests : contenu des fichiers copiés non vérifié (only `exists()`) — couverture acceptable prototype, `backend/tests/test_seed.py`.
- `is_seed=False` pour les assets non-seed non testé — couverture acceptable, `backend/tests/test_seed.py`.
- Docstring `_load_seeds` dit "Idempotent" — inexact si erreur partielle — nitpick, `backend/main.py`.
- `seed_dir` est un fichier (pas un dossier) : comportement `rglob` non défini — extrêmement improbable, `backend/main.py`.

## Deferred from: code review of 2-4-renommage-inline-et-suppression-dassert (2026-06-15)

- `commitRename` sans gestion d'erreur réseau : si `api.assets.rename` lève, la promesse rejette silencieusement, l'UI ne donne aucun feedback — `AssetGrid.tsx`. Hors scope : "Feedback erreur réseau (déféré globalement)" per spec.
- `onConfirm` (delete) sans gestion d'erreur : si `api.assets.delete` lève, le modal se ferme sans message, SWR re-fetch fait réapparaître l'asset — `AssetGrid.tsx`. Même deferral global.
- Pas de vérification d'intégrité référentielle sur `DELETE /api/assets/{id}` : la suppression d'un asset référencé dans des nœuds/scènes laisse des URLs `/uploads/…` orphelines — `backend/routers/assets.py`. Limitation prototype connue ; à traiter dans une story de robustesse future.
- Path traversal risk sur `asset.folder`/`asset.filename` : `UPLOAD_DIR / asset.folder / asset.filename` sans `.resolve()` check — `backend/routers/assets.py`. Prototype ; données venant de la DB ; même pattern que `rename_file`. Correctif si contexte production : `assert resolved_path.is_relative_to(UPLOAD_DIR.resolve())`.
- Race condition concurrent rename+delete sur même `asset_id` : pas d'isolation transaction explicite — `backend/routers/assets.py`. Prototype ; SQLite sérialise les writes mono-thread.
- Clé `mutate("asset-folders")` à vérifier contre la clé SWR réelle utilisée par `FolderTree` — `AssetGrid.tsx`. Pattern cohérent avec story 2.3, mais non vérifié formellement.
- Test défensif manquant : double-clic en mode selector ne doit pas ouvrir l'input — `AssetGrid.test.tsx`. Code correct (`config.mode === "navigation"` guard présent), test manquant.
- Test défensif manquant : bouton × absent en mode selector — `AssetGrid.test.tsx`. Code correct, test manquant.
- `uploadMedia` 409 spread fragility : `{ ok: false, status: 409, ...data }` produit `undefined` si le backend omet `existing_id`/`references` — `api.ts`. Pré-existant story 2.3, hors scope 2.4.

## Deferred from: code review of 2-3-upload-drag-drop-multi-fichiers (2026-06-15)

- Silent failure : erreurs réseau/500 dans `uploadFile` avalées sans feedback utilisateur — `UploadDropZone.tsx:uploadFile`. Hors scope story 2.3 (spec ne définit pas la gestion d'erreur non-409). À adresser dans une story de robustesse future.
- setState sur composant démonté : `uploadFile` peut résoudre après unmount → `setConflicts` sur composant démonté — `UploadDropZone.tsx`. Non-issue React 19 (no-op), mais propre à corriger avec un ref `mounted`.
- `onConfirm` replace sans `.catch` : si le replace upload échoue, `mutate` n'est pas appelé et l'utilisateur n'a aucun feedback — `UploadDropZone.tsx:onConfirm`. Lié au gap error handling global.
- 409 body malformé → NaN dans le message modal : aucune validation de la forme `{ existing_id, references }` — `api.ts:uploadMedia`. Validation défensive hors scope prototype.
- `accept="image/*"` bypassé via drag depuis l'OS : les fichiers non-image peuvent être droppés sans restriction côté front — `UploadDropZone.tsx`. Validation MIME à faire côté backend (hors scope).

## Deferred from: code review of Epic 1 (2026-06-14)

- `os.rename` / `Path.rename` lèvent un 500 non géré si la source disque est absente (assets legacy à URL plate, dossier DB-only). Concerne `rename_folder` et `rename_file` dans `backend/routers/assets.py`. Hors-scope documenté dans la story 1.4. Correctif possible : guard `404` si la source n'existe pas sur disque.
- `rename_folder` : le filtre SQL `folder LIKE "{src}/%"` ne neutralise pas les métacaractères `_`/`%` d'un nom de dossier — un dossier contenant `_` peut sur-matcher des dossiers frères. Faible probabilité, scope prototype. Correctif : échapper les wildcards LIKE ou filtrer par préfixe en Python.
- `_count_references` : détection des références de nœuds via `url in json.dumps(node.data)` (sous-chaîne) — faux positif possible si une url est préfixe d'une autre. Conforme aux dev notes prescrites (story 1.5), impact faible. Correctif : comparaison structurée sur `node.data` plutôt que sérialisée.
- Pas de contrainte d'unicité `(folder, filename)` au niveau DB ni protection contre une course sur upload concurrent du même nom (fenêtre entre le `SELECT` et le `INSERT`). SQLite mono-writer + prototype mono-utilisateur atténuent le risque. Correctif : `UniqueConstraint` + gestion `IntegrityError`.

## Deferred from: code review of 2-2-grille-de-miniatures (2026-06-15)

- Pas d'état de chargement dans `AssetGrid` — "Dossier vide" s'affiche brièvement avant que SWR reçoive les données. Amélioration UX (`AssetGrid.tsx:14`).
- `video/*` content type non géré dans la vignette — affiche le type MIME brut au lieu d'un thumbnail ou icône. Scope futur (nodes vidéo, `AssetGrid.tsx:55`).
- `folder ?` falsy check traite `""` comme pas de dossier — edge case théorique non atteignable via FolderTree, mais `folder !== null` serait plus correct (`AssetGrid.tsx:14`).
- Label de type en texte ("image"/"audio") au lieu d'icône visuelle — AC1 mentionne "icône type", mais aucune librairie d'icônes n'est présente dans le projet. Texte acceptable pour le MVP.
- `config.onSelect?.` optional chaining en mode selector — si `onSelect` est absent, la modale se ferme sans retourner de valeur. Comportement acceptable vu le typage TypeScript optionnel (`AssetGrid.tsx:39`).

## Deferred from: code review of story 2-1-modale-medialibrarymodal (2026-06-14)

- Grande requête `.keep` bufferisée sans vérification de taille (`backend/routers/assets.py`). Aucun guard max-size avant `file.read()`. Faible risque MVP.
- `prompt()` pour la création de dossier (`FolderTree.tsx`). Décision MVP documentée dans les dev notes de la story. Un input inline serait plus propre.
- Assets `.keep` visibles dans `GET /api/assets?folder=X` (`backend/routers/assets.py`, `list_assets`). Filtrage prévu dans story 2.2 AssetGrid.
- Race TOCTOU sur INSERT `.keep` : check-then-act sans verrou explicite (`backend/routers/assets.py`). SQLite sérialise les writes, scope prototype.
- `currentFolder` réinitialisé si `config.initialFolder` change pendant que la modale est ouverte (`MediaLibraryModal.tsx`, `useEffect` deps). Improbable en pratique.
