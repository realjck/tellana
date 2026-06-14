# Deferred Work

## Deferred from: code review of Epic 1 (2026-06-14)

- `os.rename` / `Path.rename` lèvent un 500 non géré si la source disque est absente (assets legacy à URL plate, dossier DB-only). Concerne `rename_folder` et `rename_file` dans `backend/routers/assets.py`. Hors-scope documenté dans la story 1.4. Correctif possible : guard `404` si la source n'existe pas sur disque.
- `rename_folder` : le filtre SQL `folder LIKE "{src}/%"` ne neutralise pas les métacaractères `_`/`%` d'un nom de dossier — un dossier contenant `_` peut sur-matcher des dossiers frères. Faible probabilité, scope prototype. Correctif : échapper les wildcards LIKE ou filtrer par préfixe en Python.
- `_count_references` : détection des références de nœuds via `url in json.dumps(node.data)` (sous-chaîne) — faux positif possible si une url est préfixe d'une autre. Conforme aux dev notes prescrites (story 1.5), impact faible. Correctif : comparaison structurée sur `node.data` plutôt que sérialisée.
- Pas de contrainte d'unicité `(folder, filename)` au niveau DB ni protection contre une course sur upload concurrent du même nom (fenêtre entre le `SELECT` et le `INSERT`). SQLite mono-writer + prototype mono-utilisateur atténuent le risque. Correctif : `UniqueConstraint` + gestion `IntegrityError`.

## Deferred from: code review of story 2-1-modale-medialibrarymodal (2026-06-14)

- Grande requête `.keep` bufferisée sans vérification de taille (`backend/routers/assets.py`). Aucun guard max-size avant `file.read()`. Faible risque MVP.
- `prompt()` pour la création de dossier (`FolderTree.tsx`). Décision MVP documentée dans les dev notes de la story. Un input inline serait plus propre.
- Assets `.keep` visibles dans `GET /api/assets?folder=X` (`backend/routers/assets.py`, `list_assets`). Filtrage prévu dans story 2.2 AssetGrid.
- Race TOCTOU sur INSERT `.keep` : check-then-act sans verrou explicite (`backend/routers/assets.py`). SQLite sérialise les writes, scope prototype.
- `currentFolder` réinitialisé si `config.initialFolder` change pendant que la modale est ouverte (`MediaLibraryModal.tsx`, `useEffect` deps). Improbable en pratique.
