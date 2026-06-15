---
baseline_commit: "54a1014"
---

# Story 2.4 : Renommage inline et suppression d'asset

Status: review

## Story

En tant qu'auteur,
je veux renommer ou supprimer un asset directement depuis la grille,
afin de maintenir ma médiathèque propre sans quitter l'interface.

## Acceptance Criteria

1. **Given** `config.mode === "navigation"` et un asset affiché dans la grille
   **When** l'utilisateur double-clique sur le nom de fichier
   **Then** un champ `<input>` apparaît avec le nom actuel pré-rempli

2. **Given** le champ de renommage est actif
   **When** l'utilisateur appuie sur Entrée ou perd le focus
   **Then** `PATCH /api/assets/{id}/rename` est appelé avec `{ filename: newName }`
   **And** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble

3. **Given** un asset affiché dans la grille
   **When** l'utilisateur clique le bouton ×
   **Then** un `ConfirmModal` s'affiche avec le nom du fichier à supprimer

4. **Given** la confirmation est validée dans le `ConfirmModal`
   **When** l'utilisateur confirme
   **Then** `DELETE /api/assets/{id}` est appelé
   **And** `mutate(["assets", currentFolder])` + `mutate("asset-folders")` sont appelés ensemble
   **And** l'asset disparaît de la grille

5. **Given** un asset avec `is_seed=true`
   **When** l'utilisateur clique ×
   **Then** le `ConfirmModal` s'affiche normalement — pas de guard 403, suppression permise

## Tasks / Subtasks

- [x] **T1** — Backend : ajouter `DELETE /api/assets/{id}` dans `backend/routers/assets.py` (AC: 3, 4, 5)
  - [x] Ajouter `@router.delete("/{asset_id}", status_code=204)` après `rename_file`
  - [x] Récupérer l'asset par `asset_id` — lever `HTTPException(404)` si absent
  - [x] Supprimer le fichier physique si `(UPLOAD_DIR / asset.folder / asset.filename).exists()`
  - [x] `db.delete(asset)` + `db.commit()`
  - [x] Pas de guard sur `is_seed` — suppression toujours permise

- [x] **T2** — Backend tests : ajouter dans `backend/tests/test_assets.py` (AC: 4, 5)
  - [x] `test_delete_asset_removes_from_db_and_disk` : upload via `_upload`, DELETE, vérifier 204 + fichier disque absent + asset absent de `GET /api/assets?folder=...`
  - [x] `test_delete_asset_not_found` : `DELETE /api/assets/999` → 404
  - [x] `test_delete_seed_asset_allowed` : créer un asset avec `is_seed=True` via `_create_asset` + setattr DB, DELETE → 204

- [x] **T3** — Frontend : ajouter `api.assets.rename` et `api.assets.delete` dans `frontend/lib/api.ts` (AC: 2, 4)
  - [x] Ajouter `rename: (id: number, filename: string): Promise<Asset> => request<Asset>(\`/api/assets/\${id}/rename\`, { method: "PATCH", body: JSON.stringify({ filename }) })` dans `api.assets` (après `uploadMedia`)
  - [x] Ajouter `delete: (id: number): Promise<void> => request<void>(\`/api/assets/\${id}\`, { method: "DELETE" })` dans `api.assets`
  - [x] `request<void>` gère le 204 (retourne `undefined as T`) — pas de fetch brut nécessaire

- [x] **T4** — Frontend : modifier `frontend/components/media-library/AssetGrid.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] Ajouter imports : `useState` depuis `"react"`, `useSWRConfig` depuis `"swr"`, `ConfirmModal` depuis `"@/components/ConfirmModal"`
  - [x] Ajouter `const { mutate } = useSWRConfig()` en début de composant
  - [x] Ajouter states : `const [editingId, setEditingId] = useState<number | null>(null)`, `const [editingName, setEditingName] = useState("")`, `const [pendingDelete, setPendingDelete] = useState<Asset | null>(null)`
  - [x] Ajouter `commitRename(asset: Asset, name: string)` : si nom vide ou identique → exit mode seulement ; sinon `await api.assets.rename(asset.id, name.trim())` + `await mutate(["assets", folder!])` + `await mutate("asset-folders")`
  - [x] Sur la `<p>` du nom : si `config.mode === "navigation"` → ajouter `onDoubleClick={(e) => { e.stopPropagation(); setEditingId(asset.id); setEditingName(asset.filename); }}`
  - [x] Conditionnel sur le nom : si `editingId === asset.id` → rendre `<input>` au lieu de `<p>` (voir section Dev Notes pour les détails)
  - [x] Bouton × : visible uniquement si `config.mode === "navigation"`, positionné `absolute top-1 left-1`, `opacity-0 group-hover:opacity-100`, appelle `(e) => { e.stopPropagation(); setPendingDelete(asset); }`
  - [x] Rendre `<ConfirmModal>` quand `pendingDelete !== null` (voir Dev Notes pour la logique)

- [x] **T5** — Frontend tests : mettre à jour `frontend/__tests__/media-library/AssetGrid.test.tsx` (AC: 1, 2, 3, 4)
  - [x] Capturer `mockMutate` : `const mockMutate = jest.fn()` avant `jest.mock("swr", ...)` + passer `mockMutate` dans `useSWRConfig`
  - [x] Mettre à jour le mock `@/lib/api` : ajouter `rename: jest.fn()` et `delete: jest.fn()` dans `api.assets`
  - [x] Test 1 : double-clic sur nom en mode navigation → `<input>` apparaît avec le nom pré-rempli
  - [x] Test 2 : blur sur input → `api.assets.rename` appelé + mutate pair appelés
  - [x] Test 3 : Entrée sur input → `api.assets.rename` appelé + mutate pair appelés
  - [x] Test 4 : clic × en mode navigation → ConfirmModal affiché avec le nom de l'asset
  - [x] Test 5 : clic "Supprimer" dans ConfirmModal → `api.assets.delete` appelé + mutate pair appelés
  - [x] Test 6 : clic "Annuler" dans ConfirmModal → `api.assets.delete` non appelé

## Dev Notes

### Périmètre — bornes strictes

**In scope :**
- `backend/routers/assets.py` — ajout `DELETE /api/assets/{id}` uniquement
- `backend/tests/test_assets.py` — 3 nouveaux tests DELETE
- `frontend/lib/api.ts` — ajout `api.assets.rename` + `api.assets.delete`
- `frontend/components/media-library/AssetGrid.tsx` — ajout inline rename + bouton × + ConfirmModal
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — 6 nouveaux tests + mise à jour mocks

**Out of scope :**
- Assets de seed Alice & Bob (story 2.5)
- Renommage de dossier depuis FolderTree (story 2.1 — déjà implémenté)
- Feedback erreur réseau (déféré globalement)
- Barre de progression upload

### Endpoint backend — `DELETE /api/assets/{id}`

L'endpoint n'existe pas encore dans `backend/routers/assets.py`. À ajouter après `rename_file` (ligne ~185) :

```python
@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset introuvable")
    file_path = UPLOAD_DIR / asset.folder / asset.filename
    if file_path.exists():
        file_path.unlink()
    db.delete(asset)
    db.commit()
```

Retour 204 = pas de body. `request<void>` dans `api.ts` gère le 204 (ligne 35 : `if (res.status === 204) return undefined as T`).

**Ordre des endpoints dans assets.py :** `GET /folders` → `GET /` → `POST /` → `PATCH /folders` → `PATCH /{id}/rename` → **`DELETE /{id}`** (nouveau) → `POST /upload` (legacy).

### `api.ts` — méthodes à ajouter dans `api.assets`

Ajouter après `uploadMedia`, avant la fermeture `}` de `api.assets` :

```typescript
rename: (id: number, filename: string): Promise<Asset> =>
  request<Asset>(`/api/assets/${id}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ filename }),
  }),
delete: (id: number): Promise<void> =>
  request<void>(`/api/assets/${id}`, { method: "DELETE" }),
```

`request<void>` est disponible (fermeture de `api.assets` est `},` ligne 224).

### `AssetGrid.tsx` — implémentation complète des nouvelles fonctionnalités

**Imports à ajouter :**
```typescript
import { useState } from "react";
import { useSWRConfig } from "swr";
import ConfirmModal from "@/components/ConfirmModal";
```

**État + mutate dans le composant (après les SWR hooks existants) :**
```typescript
const { mutate } = useSWRConfig();
const [editingId, setEditingId] = useState<number | null>(null);
const [editingName, setEditingName] = useState("");
const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
```

**`commitRename` handler :**
```typescript
const commitRename = async (asset: Asset, name: string) => {
  setEditingId(null);
  if (!name.trim() || name.trim() === asset.filename) return;
  await api.assets.rename(asset.id, name.trim());
  await mutate(["assets", folder!]);
  await mutate("asset-folders");
};
```

**Remplacement du bloc nom dans la card :**
```tsx
<div className="p-1.5">
  {editingId === asset.id ? (
    <input
      autoFocus
      className="text-xs text-fore bg-transparent border-b border-primary outline-none w-full"
      value={editingName}
      onChange={(e) => setEditingName(e.target.value)}
      onBlur={() => commitRename(asset, editingName)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename(asset, editingName);
        if (e.key === "Escape") setEditingId(null);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  ) : (
    <p
      className="text-xs text-fore truncate"
      title={asset.filename}
      onDoubleClick={
        config.mode === "navigation"
          ? (e) => { e.stopPropagation(); setEditingId(asset.id); setEditingName(asset.filename); }
          : undefined
      }
    >
      {asset.filename}
    </p>
  )}
  <p className="text-xs text-subtle">{_typeLabel(asset.content_type)}</p>
</div>
```

**Bouton × (à ajouter dans la card, avant le badge `is_seed`) :**
```tsx
{config.mode === "navigation" && (
  <button
    aria-label="Supprimer"
    className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-red-600 text-white rounded text-xs w-5 h-5 flex items-center justify-center leading-none transition-opacity"
    onClick={(e) => { e.stopPropagation(); setPendingDelete(asset); }}
  >
    ×
  </button>
)}
```

**ConfirmModal (à rendre après la grille, à l'intérieur du return principal) :**
```tsx
{pendingDelete && (
  <ConfirmModal
    message={`Supprimer "${pendingDelete.filename}" ?`}
    onConfirm={async () => {
      const target = pendingDelete;
      setPendingDelete(null);
      await api.assets.delete(target.id);
      await mutate(["assets", folder!]);
      await mutate("asset-folders");
    }}
    onCancel={() => setPendingDelete(null)}
  />
)}
```

**Attention :** Le `ConfirmModal` doit être rendu en dehors du map des cards (pas imbriqué dans une card). Le placer juste avant la fermeture du `return` principal, après `</div>` de la grille.

### Tests — `AssetGrid.test.tsx`

**Mise à jour des mocks (remplacer les existants) :**

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
      list: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
    },
  },
  resolveAsset: (url: string) => `http://localhost:8000${url}`,
  randomCharacterColor: () => "#FF6B6B",
}));
```

**Import api après mock :**
```typescript
import { api } from "@/lib/api";
const mockRename = api.assets.rename as jest.Mock;
const mockDelete = api.assets.delete as jest.Mock;
```

**Réinitialisation dans `beforeEach` :**
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: [] });
  mockRename.mockResolvedValue({ id: 1, filename: "nouveau.png", url: "/uploads/...", content_type: "image/png", folder: "characters/alice", is_seed: false });
  mockDelete.mockResolvedValue(undefined);
  mockMutate.mockResolvedValue(undefined);
});
```

**Nouveaux tests :**

```typescript
it("double-clic sur nom en mode navigation affiche un input pré-rempli", async () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  const nameEl = screen.getByTitle("portrait.png");
  fireEvent.dblClick(nameEl);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  expect(input).toBeInTheDocument();
  expect(input.value).toBe("portrait.png");
});

it("blur sur input appelle api.assets.rename et mutate pair", async () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  fireEvent.dblClick(screen.getByTitle("portrait.png"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "nouveau.png" } });
  await act(async () => { fireEvent.blur(input); });
  expect(mockRename).toHaveBeenCalledWith(asset.id, "nouveau.png");
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"]));
  expect(mockMutate).toHaveBeenCalledWith("asset-folders");
});

it("Entrée sur input appelle api.assets.rename", async () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  fireEvent.dblClick(screen.getByTitle("portrait.png"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "new.png" } });
  await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
  expect(mockRename).toHaveBeenCalledWith(asset.id, "new.png");
});

it("clic × en mode navigation affiche ConfirmModal", () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  const btn = screen.getByLabelText("Supprimer");
  fireEvent.click(btn);
  expect(screen.getByText(/Supprimer "portrait\.png"/)).toBeInTheDocument();
});

it('clic "Supprimer" dans ConfirmModal appelle api.assets.delete et mutate pair', async () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  fireEvent.click(screen.getByLabelText("Supprimer"));
  await act(async () => { fireEvent.click(screen.getByText("Supprimer")); });
  expect(mockDelete).toHaveBeenCalledWith(asset.id);
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"]));
  expect(mockMutate).toHaveBeenCalledWith("asset-folders");
});

it('clic "Annuler" dans ConfirmModal ne supprime pas', async () => {
  const asset = makeAsset({ filename: "portrait.png" });
  mockUseSWR.mockReturnValue({ data: [asset] });
  render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
  fireEvent.click(screen.getByLabelText("Supprimer"));
  await act(async () => { fireEvent.click(screen.getByText("Annuler")); });
  expect(mockDelete).not.toHaveBeenCalled();
});
```

**ATTENTION :** Dans le test "clic Supprimer", le bouton "Supprimer" apparaît deux fois : une fois comme libellé de ConfirmModal (le bouton rouge confirmer de ConfirmModal est libellé "Supprimer") et une fois via `aria-label="Supprimer"` sur le bouton ×. Pour éviter l'ambiguïté, utiliser `screen.getByLabelText("Supprimer")` pour le bouton × (via `aria-label`) et `screen.getByRole("button", { name: "Supprimer" })` pour le bouton de confirmation dans ConfirmModal si nécessaire. Vérifier l'ordre avec `screen.getAllByText("Supprimer")` au besoin.

Il faut aussi importer `waitFor` et `act` dans les imports de test :
```typescript
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
```

### Backend tests — implémentation des 3 tests DELETE

Dans `test_assets.py`, à ajouter après les tests de renommage (section `# ── Story 1.4` ou créer `# ── Story 2.4`) :

```python
# ── Story 2.4 — Suppression d'asset ─────────────────────────────────────────

def test_delete_asset_removes_from_db_and_disk(client, tmp_path):
    asset_id = _upload(client, "portrait.png", "characters/alice").json()["id"]
    assert (tmp_path / "characters" / "alice" / "portrait.png").exists()

    res = client.delete(f"/api/assets/{asset_id}")
    assert res.status_code == 204

    assert not (tmp_path / "characters" / "alice" / "portrait.png").exists()
    listing = client.get("/api/assets?folder=characters/alice").json()
    assert all(a["id"] != asset_id for a in listing)


def test_delete_asset_not_found(client):
    res = client.delete("/api/assets/999")
    assert res.status_code == 404


def test_delete_seed_asset_allowed(client):
    from main import app
    from database import get_db
    from models import Asset as AssetModel

    override = app.dependency_overrides.get(get_db)
    db = next(override())
    asset = AssetModel(
        filename="seed.png",
        url="/uploads/characters/alice/seed.png",
        content_type="image/png",
        folder="characters/alice",
        is_seed=True,
    )
    db.add(asset)
    db.commit()
    asset_id = asset.id

    res = client.delete(f"/api/assets/{asset_id}")
    assert res.status_code == 204
```

Note : `test_delete_asset_removes_from_db_and_disk` nécessite `tmp_path` (fixture pytest) car `_upload` écrit sur disque via `POST /api/assets`. Le test utilise `tmp_path` (via `monkeypatch` dans conftest) pour accéder au chemin réel utilisé par le backend de test. Vérifier que `conftest.py` redirige bien `UPLOAD_DIR` vers `tmp_path`.

### Règles absolues à respecter

1. `mutate(["assets", folder!])` + `mutate("asset-folders")` — **toujours les deux ensemble** après rename ou delete
2. `e.stopPropagation()` sur le click du bouton × — évite de déclencher `handleClick` (selector mode) ou d'autres handlers
3. `e.stopPropagation()` sur l'input (onClick) — évite que le clic sur l'input déclenche le clic de la card
4. Rename inline **uniquement en mode `navigation`** — pas de `onDoubleClick` en mode `selector`
5. Bouton × **uniquement en mode `navigation`** — invisible en mode `selector`
6. ConfirmModal importé depuis `@/components/ConfirmModal` (composant existant, ne pas modifier)
7. Pas de `useMemo`/`useCallback` manuels — React Compiler
8. `<button>` ne doit pas être imbriqué dans un autre `<button>` — OK ici car la card est un `<div>`

### Vérification de non-régression

Après implémentation :
- `python -m pytest` (depuis `backend/`) : 60 tests existants + 3 nouveaux DELETE — tous verts
- `npm test` (depuis `frontend/`) : 100 tests existants + 6 nouveaux AssetGrid — tous verts
- Vérifier que le clic sur une card en mode `selector` fonctionne toujours (non affecté)
- Vérifier que `UploadDropZone` s'affiche toujours en mode `navigation` (AssetGrid.tsx non altéré sur ce point)

### Project Structure Notes

**Fichiers modifiés :**
- `backend/routers/assets.py` — ajout endpoint DELETE (aucun autre endpoint modifié)
- `backend/tests/test_assets.py` — ajout section Story 2.4 avec 3 tests
- `frontend/lib/api.ts` — ajout `api.assets.rename` + `api.assets.delete` (dans l'objet `api.assets` existant)
- `frontend/components/media-library/AssetGrid.tsx` — ajout états, imports, rename inline, bouton ×, ConfirmModal
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — mise à jour mocks + 6 nouveaux tests

**Aucun nouveau fichier créé.** Pas de barrel `index.ts`. Architecture plate respectée.

**Tokens design :** `text-fore`, `text-subtle`, `bg-transparent` — jamais de `slate-*`/`zinc-*` hardcodés.

### References

- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 2.4 ACs (lignes 323–352)
- Story 2.3 : `_bmad-output/implementation-artifacts/2-3-upload-drag-drop-multi-fichiers.md` — patterns tests, mock swr, ConfirmModal
- Code existant :
  - `frontend/components/media-library/AssetGrid.tsx` — état actuel post-2.3 à modifier (T4)
  - `frontend/__tests__/media-library/AssetGrid.test.tsx` — mocks existants à enrichir (T5)
  - `frontend/components/ConfirmModal.tsx` — props : `{ message, onConfirm, onCancel }`, boutons : "Annuler"/"Supprimer"
  - `backend/routers/assets.py` — structure actuelle, endpoints existants (T1)
  - `backend/tests/test_assets.py` — helpers `_create_asset` et `_upload`, pattern tests existants
  - `frontend/lib/api.ts` ligne 23–37 : `request<T>` gère 204 → `return undefined as T`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- TDD respecté : tests backend écrits en RED (endpoint absent → 404), puis GREEN après ajout de `DELETE /{asset_id}`. Tests frontend écrits en RED (6 fails sur AssetGrid), puis GREEN après modification d'AssetGrid.tsx.
- T1+T2 — `DELETE /api/assets/{asset_id}` ajouté dans `routers/assets.py` : suppression disque (`file_path.unlink()` si exists) + `db.delete` + `db.commit`. 204 No Content. Aucun guard `is_seed`. 3 tests backend ajoutés (removes_from_db_and_disk, not_found, seed_allowed). 120/120 tests backend verts.
- T3 — `api.assets.rename` et `api.assets.delete` ajoutés dans `api.ts` : utilisation de `request<T>` (gère 204 via `return undefined as T` ligne 35). Pas de fetch brut nécessaire.
- T4 — `AssetGrid.tsx` modifié : ajout `useState`, `useSWRConfig`, `ConfirmModal`. Inline rename via double-clic sur `<p>` nom → `<input autoFocus>` avec commit onBlur/Enter/Escape. Bouton × `aria-label="Supprimer"` en `absolute top-1 left-1`, visible uniquement en mode `navigation`, `opacity-0 group-hover:opacity-100`. `ConfirmModal` rendu hors du map des cards.
- T5 — `AssetGrid.test.tsx` mis à jour : `mockMutate` capturé, mocks `rename` et `delete` ajoutés. 6 nouveaux tests (dblClick → input, blur → rename + mutate, Enter → rename, × → ConfirmModal, Supprimer → delete + mutate, Annuler → no delete). 107/107 tests frontend verts.

### File List

- `backend/routers/assets.py` — MODIFIÉ : ajout endpoint `DELETE /{asset_id}`
- `backend/tests/test_assets.py` — MODIFIÉ : ajout section Story 2.4 (3 tests DELETE)
- `frontend/lib/api.ts` — MODIFIÉ : ajout `api.assets.rename` + `api.assets.delete`
- `frontend/components/media-library/AssetGrid.tsx` — MODIFIÉ : rename inline + bouton × + ConfirmModal
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — MODIFIÉ : mocks enrichis + 6 nouveaux tests

## Change Log

- 2026-06-15 — Story 2.4 créée (create-story workflow). Status → ready-for-dev.
- 2026-06-15 — Story 2.4 implémentée : `DELETE /api/assets/{id}` backend (3 tests), `api.assets.rename/delete` api.ts, `AssetGrid.tsx` rename inline + suppression ConfirmModal (6 nouveaux tests). 120/120 backend, 107/107 frontend. Status → review.
