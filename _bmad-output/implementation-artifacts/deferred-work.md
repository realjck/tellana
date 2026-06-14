# Deferred Work

## Deferred from: code review of Epic 1 (2026-06-14)

- `os.rename` / `Path.rename` lèvent un 500 non géré si la source disque est absente (assets legacy à URL plate, dossier DB-only). Concerne `rename_folder` et `rename_file` dans `backend/routers/assets.py`. Hors-scope documenté dans la story 1.4. Correctif possible : guard `404` si la source n'existe pas sur disque.
- `rename_folder` : le filtre SQL `folder LIKE "{src}/%"` ne neutralise pas les métacaractères `_`/`%` d'un nom de dossier — un dossier contenant `_` peut sur-matcher des dossiers frères. Faible probabilité, scope prototype. Correctif : échapper les wildcards LIKE ou filtrer par préfixe en Python.
- `_count_references` : détection des références de nœuds via `url in json.dumps(node.data)` (sous-chaîne) — faux positif possible si une url est préfixe d'une autre. Conforme aux dev notes prescrites (story 1.5), impact faible. Correctif : comparaison structurée sur `node.data` plutôt que sérialisée.
- Pas de contrainte d'unicité `(folder, filename)` au niveau DB ni protection contre une course sur upload concurrent du même nom (fenêtre entre le `SELECT` et le `INSERT`). SQLite mono-writer + prototype mono-utilisateur atténuent le risque. Correctif : `UniqueConstraint` + gestion `IntegrityError`.
