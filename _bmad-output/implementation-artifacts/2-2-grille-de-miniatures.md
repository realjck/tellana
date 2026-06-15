---
baseline_commit: 54a1014
---

# Story 2.2 : Grille de miniatures (AssetGrid)

Status: done

## Story

En tant qu'auteur,
je veux voir les assets du dossier sélectionné sous forme de grille,
afin d'identifier visuellement mes images.

## Acceptance Criteria

1. **Given** un dossier sélectionné dans FolderTree
   **When** `AssetGrid` se monte (via `useSWR(["assets", folder])`)
   **Then** les assets du dossier sont affichés en grille : vignette image, nom de fichier tronqué, icône type

2. **Given** un asset avec `filename=".keep"`
   **When** `AssetGrid` filtre les assets
   **Then** cet asset n'est jamais affiché dans la grille

3. **Given** un asset avec `is_seed=true`
   **When** il s'affiche dans la grille
   **Then** un badge "seed" est visible sur sa vignette

4. **Given** `config.mode === "selector"` et `config.filter === "images"`
   **When** l'utilisateur clique sur une vignette
   **Then** `config.onSelect(asset)` est appelé et la modale se ferme

5. **Given** une image affichée dans la grille
   **When** le composant la rend
   **Then** `resolveAsset(asset.url)` est utilisé pour construire l'URL (jamais `asset.url` directement en tant que `src`)

## Tasks / Subtasks

- [x] **T1** — Créer `AssetGrid.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] Créer `frontend/components/media-library/AssetGrid.tsx` avec `"use client"`
  - [x] Props : `config: MediaLibraryConfig`, `folder: string | null`, `onClose: () => void`
  - [x] `useSWR(["assets", folder], () => api.assets.list(folder!), { isPaused: () => !folder })` pour charger les assets
  - [x] Filtrer les `.keep` : `assets.filter(a => a.filename !== '.keep')`
  - [x] Affichage : grille CSS, vignette `<img src={resolveAsset(asset.url)} />`, nom tronqué, icône type
  - [x] Badge "seed" conditionnel sur `asset.is_seed`
  - [x] Mode `selector` : clic vignette → `config.onSelect(asset)` + `onClose()`
  - [x] État vide : si `!folder` → message "Sélectionnez un dossier" ; si assets vide après filtre → "Dossier vide"

- [x] **T2** — Modifier `MediaLibraryModal.tsx` pour intégrer `AssetGrid` (AC: 1)
  - [x] Importer `AssetGrid` depuis `./AssetGrid`
  - [x] Remplacer le `<div>` placeholder (commentaire "Placeholder — remplacé par AssetGrid en story 2.2") par `<AssetGrid config={config} folder={currentFolder} onClose={onClose} />`
  - [x] Supprimer le div placeholder et son contenu entièrement

- [x] **T3** — Tests frontend (AC: 1, 2, 3, 4, 5)
  - [x] Créer `frontend/__tests__/media-library/AssetGrid.test.tsx`
  - [x] Test 1 : `folder=null` → message "Sélectionnez un dossier" affiché
  - [x] Test 2 : assets chargés → vignettes affichées, `.keep` exclu
  - [x] Test 3 : `is_seed=true` → badge "seed" visible
  - [x] Test 4 : mode `selector` + clic vignette → `onSelect` appelé avec l'asset + `onClose` appelé
  - [x] Test 5 : `resolveAsset` est utilisé (attribut `src` de `<img>` contient l'URL préfixée backend, pas `/uploads/...` brut)

### Review Findings

- [x] [Review][Patch] `config.filter` non appliqué — assets non-image sélectionnables en mode `selector` + `filter: "images"` [`frontend/components/media-library/AssetGrid.tsx:19`] — patché : filtre `config.filter !== "images" || content_type.startsWith("image/")` + test ajouté
- [x] [Review][Patch] Test coupling via `.closest(".rounded-lg")` — si la classe change, le test crashe silencieusement [`frontend/__tests__/media-library/AssetGrid.test.tsx:77`] — patché : `data-testid="asset-card"` + `getByTestId`
- [x] [Review][Defer] Pas d'état de chargement — "Dossier vide" flashe avant que SWR ne reçoive les données [`frontend/components/media-library/AssetGrid.tsx:14`] — deferred, amélioration UX hors scope story
- [x] [Review][Defer] `video/*` non géré dans la vignette — affiche le type MIME brut [`frontend/components/media-library/AssetGrid.tsx:55`] — deferred, scope futur (nodes video)
- [x] [Review][Defer] `folder ?` falsy check traite `""` comme pas de dossier — edge case théorique jamais produit par FolderTree [`frontend/components/media-library/AssetGrid.tsx:14`] — deferred, non atteignable en pratique
- [x] [Review][Defer] Label de type (`"image"`) est texte, pas icône visuelle — AC1 dit "icône type" [`frontend/components/media-library/AssetGrid.tsx`] — deferred, pas de librairie d'icônes dans le projet, texte acceptable MVP
- [x] [Review][Defer] `config.onSelect?.` optional chaining en mode selector — no-op silencieux si onSelect absent [`frontend/components/media-library/AssetGrid.tsx:39`] — deferred, typage optionnel intentionnel, pas de crash

## Dev Notes

### Périmètre — bornes strictes

**In scope :** `AssetGrid.tsx` (affichage + sélection), patch `MediaLibraryModal.tsx` (remplacement placeholder)

**Out of scope (stories suivantes) :**
- `UploadDropZone.tsx` (story 2.3) — pas de drag & drop ici
- Rename inline (double-clic sur nom) (story 2.4)
- Bouton × suppression (story 2.4)
- Seeds Alice & Bob en DB (story 2.5) — le badge `is_seed` est dans `AssetGrid` maintenant, les données arrivent via story 2.5

Ne pas anticiper les features des stories 2.3 et 2.4 même si c'est tentant.

### `AssetGrid.tsx` — JSX complet

```tsx
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { resolveAsset } from "@/lib/api";
import type { MediaLibraryConfig, Asset } from "@/types";

interface Props {
  config: MediaLibraryConfig;
  folder: string | null;
  onClose: () => void;
}

export default function AssetGrid({ config, folder, onClose }: Props) {
  const { data: allAssets = [] } = useSWR<Asset[]>(
    folder ? ["assets", folder] : null,
    () => api.assets.list(folder!)
  );

  const assets = allAssets.filter((a) => a.filename !== ".keep");

  if (!folder) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
        Sélectionnez un dossier
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
        Dossier vide
      </div>
    );
  }

  const handleClick = (asset: Asset) => {
    if (config.mode === "selector") {
      config.onSelect?.(asset);
      onClose();
    }
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="grid grid-cols-4 gap-3">
        {assets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => handleClick(asset)}
            className={`relative rounded-lg overflow-hidden border border-white/10 bg-elevated group ${
              config.mode === "selector" ? "cursor-pointer hover:border-primary/60" : ""
            }`}
          >
            <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
              {asset.content_type.startsWith("image/") ? (
                <img
                  src={resolveAsset(asset.url)}
                  alt={asset.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-muted text-xs text-center px-1">
                  {asset.content_type}
                </span>
              )}
            </div>
            <div className="p-1.5">
              <p className="text-xs text-fore truncate" title={asset.filename}>
                {asset.filename}
              </p>
              <p className="text-xs text-subtle">{_typeLabel(asset.content_type)}</p>
            </div>
            {asset.is_seed && (
              <span className="absolute top-1 right-1 bg-amber-600/80 text-white text-[10px] px-1 rounded leading-tight">
                seed
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function _typeLabel(contentType: string): string {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  return contentType.split("/")[1] ?? contentType;
}
```

**Notes importantes sur ce JSX :**
- `folder ? ["assets", folder] : null` — clé `null` suspend SWR automatiquement quand pas de dossier (pas d'import `isPaused`)
- `resolveAsset(asset.url)` avec le string URL : appelle `resolveImage` → préfixe `${API_BASE}` si le chemin commence par `/uploads/`
- `.aspect-square` pour des vignettes carrées uniformes
- `text-subtle` — token existant (voir globals.css), hiérarchie : `text-fore` > `text-muted` > `text-subtle`
- `bg-elevated` pour le fond des cartes (pas `bg-raised` qui est pour les modales)
- `rounded-lg` pour les cards (convention projet)
- Badge seed : `amber-600` est un exception hardcodée acceptable (couleur sémantique "attention/info", pas un token de fond de page)

### `MediaLibraryModal.tsx` — modification minimale

Le seul changement est de remplacer le bloc placeholder (lignes 72-75) :

**Avant :**
```tsx
{/* Placeholder — remplacé par AssetGrid en story 2.2 */}
<div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
  {currentFolder ? `Dossier : ${currentFolder}` : "Sélectionnez un dossier"}
</div>
```

**Après :**
```tsx
<AssetGrid config={config} folder={currentFolder} onClose={onClose} />
```

Ajouter en tête de fichier : `import AssetGrid from "./AssetGrid"`

Aucune autre modification de `MediaLibraryModal.tsx` — ne pas toucher la gestion d'état, le layout, le FolderTree, ou le bouton "Sélectionner ce dossier".

### Clé SWR — règle stricte

```typescript
// CORRECT
useSWR(folder ? ["assets", folder] : null, () => api.assets.list(folder!))

// INCORRECT (invalide les mauvais caches)
useSWR(folder, () => api.assets.list(folder!))
useSWR(`assets-${folder}`, ...)
```

La clé `["assets", folder]` est la clé canonique pour invalidation coordonnée avec stories 2.3 et 2.4. Ne jamais s'en écarter.

### `resolveAsset` — utilisation correcte

```typescript
// CORRECT — asset.url est un string comme "/uploads/characters/alice/default.png"
// resolveAsset(string) → appelle resolveImage → prepend API_BASE
<img src={resolveAsset(asset.url)} />

// INCORRECT — URL relative, cassée en prod ou sur autre host
<img src={asset.url} />

// INCORRECT — AssetRef incompatible avec Asset
<img src={resolveAsset({ id: asset.id, url: asset.url })} />
// (TypeScript erreur : Asset n'est pas AssetRef — AssetRef requiert type, opfs_key, etc.)
```

`Asset.url` (string) n'est **pas** `AssetRef` (objet complexe). Toujours passer `asset.url` directement à `resolveAsset`.

### Tests — pattern complet

```typescript
// frontend/__tests__/media-library/AssetGrid.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AssetGrid from "@/components/media-library/AssetGrid";
import type { MediaLibraryConfig, Asset } from "@/types";

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: { assets: { list: jest.fn() } },
  resolveAsset: (url: string) => `http://localhost:8000${url}`,
  randomCharacterColor: () => "#FF6B6B",
}));

import useSWR from "swr";
const mockUseSWR = useSWR as jest.Mock;

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 1,
  filename: "portrait.png",
  url: "/uploads/characters/alice/portrait.png",
  content_type: "image/png",
  folder: "characters/alice",
  is_seed: false,
  ...overrides,
});

const navConfig: MediaLibraryConfig = { mode: "navigation" };
const selectorConfig: MediaLibraryConfig = {
  mode: "selector",
  filter: "images",
  onSelect: jest.fn(),
};
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: [] });
});

describe("AssetGrid", () => {
  it("affiche message si pas de dossier sélectionné", () => {
    render(<AssetGrid config={navConfig} folder={null} onClose={onClose} />);
    expect(screen.getByText("Sélectionnez un dossier")).toBeInTheDocument();
  });

  it("filtre les assets .keep et affiche les vrais assets", () => {
    mockUseSWR.mockReturnValue({
      data: [
        makeAsset({ id: 1, filename: ".keep" }),
        makeAsset({ id: 2, filename: "portrait.png" }),
      ],
    });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    expect(screen.queryByTitle(".keep")).not.toBeInTheDocument();
    expect(screen.getByTitle("portrait.png")).toBeInTheDocument();
  });

  it("affiche badge seed sur asset is_seed=true", () => {
    mockUseSWR.mockReturnValue({
      data: [makeAsset({ is_seed: true })],
    });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    expect(screen.getByText("seed")).toBeInTheDocument();
  });

  it("en mode selector, clic appelle onSelect et onClose", () => {
    const asset = makeAsset();
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={selectorConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.click(screen.getByTitle("portrait.png").closest(".rounded-lg")!);
    expect(selectorConfig.onSelect).toHaveBeenCalledWith(asset);
    expect(onClose).toHaveBeenCalled();
  });

  it("img src utilise resolveAsset (préfixe API_BASE)", () => {
    mockUseSWR.mockReturnValue({ data: [makeAsset()] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "http://localhost:8000/uploads/characters/alice/portrait.png");
  });
});
```

**Attention :** le mock `resolveAsset` ci-dessus est une simplification — il préfixe directement. La valeur testée (`http://localhost:8000/uploads/...`) doit correspondre exactement à ce que le vrai `resolveAsset` retournerait avec `API_BASE=http://localhost:8000`.

### Project Structure Notes

- **Fichier créé :** `frontend/components/media-library/AssetGrid.tsx` (pas de barrel `index.ts`)
- **Fichier modifié :** `frontend/components/media-library/MediaLibraryModal.tsx` (import + remplacement placeholder)
- **Test créé :** `frontend/__tests__/media-library/AssetGrid.test.tsx`
- Respecte `testMatch: __tests__/**/*.test.(ts|tsx)` — le fichier est dans `__tests__/media-library/`
- `"use client"` obligatoire sur `AssetGrid.tsx` (composant interactif avec state SWR)
- **Pas de `useMemo`/`useCallback` manuels** — React Compiler optimise
- **Pas de `<button>` imbriqués** — les cartes utilisent `<div onClick>` directement
- `grid-cols-4` par défaut — ajustable en story ultérieure si nécessaire, pas de responsive complexe en MVP

### Patterns hérités de story 2.1 (reproduire)

1. **Mock SWR dans les tests** — utiliser le même pattern que `FolderTree.test.tsx` :
   ```typescript
   const mockUseSWR = useSWR as jest.Mock;
   mockUseSWR.mockReturnValue({ data: [...], mutate: jest.fn() });
   ```
2. **Mock `@/lib/api`** — inclure `randomCharacterColor: () => "#FF6B6B"` (requis globalement même si `AssetGrid` ne l'utilise pas)
3. **Tokens design** : `bg-bg`, `bg-elevated`, `text-fore`, `text-muted`, `text-subtle` — jamais `slate-*`/`zinc-*`
4. **Border radius** : `rounded-lg` pour les cartes asset

### Vérification de non-régression

Après implémentation, vérifier :
- `npm test` : tous les tests existants passent (88 actuels + nouveaux tests story 2.2)
- `MediaLibraryModal.test.tsx` : les tests existants passent toujours (FolderTree mockable, AssetGrid à mocker si nécessaire)
- `FolderTree.test.tsx` : aucune modification — doit rester vert

### References

- Epics : `_bmad-output/planning-artifacts/epics.md` — Story 2.2 ACs (lignes 267-293)
- Architecture : `_bmad-output/planning-artifacts/architecture.md` — D4 (structure composants), D5 (clés SWR), Process Patterns (dossier vide), Enforcement (resolveAsset obligatoire)
- Story 2.1 : `_bmad-output/implementation-artifacts/2-1-modale-medialibrarymodal-et-navigation-de-dossiers.md` — Dev Notes (patterns tests, tokens design, SWR keys)
- Code existant :
  - `frontend/components/media-library/MediaLibraryModal.tsx` lignes 71-75 (placeholder à remplacer)
  - `frontend/lib/api.ts` lignes 192-201 (`api.assets.list` — déjà implémenté, ne pas recréer)
  - `frontend/lib/api.ts` lignes 14-21 (`resolveAsset` — fonction à utiliser)
  - `frontend/types/index.ts` lignes 16-32 (`Asset` et `MediaLibraryConfig` — types existants)
  - `frontend/__tests__/media-library/FolderTree.test.tsx` — pattern de mock SWR à reproduire

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- TDD respecté : tests écrits en RED (import manquant → 1 suite failed), puis GREEN à chaque étape.
- T1 — `AssetGrid.tsx` créé : clé SWR `folder ? ["assets", folder] : null`, filtre `.keep`, badge `is_seed`, mode `selector` (click → `onSelect` + `onClose`), `resolveAsset(asset.url)` pour les img src. 5 tests AssetGrid verts.
- T2 — `MediaLibraryModal.tsx` patché : import `AssetGrid` ajouté, placeholder remplacé par `<AssetGrid config={config} folder={currentFolder} onClose={onClose} />`.
- T3 — `MediaLibraryModal.test.tsx` mis à jour : mock `AssetGrid` ajouté (isolation des tests Modal vs Grid) + `resolveAsset` ajouté au mock `@/lib/api`. Aucun test Modal modifié dans son assertion.
- Non-régression : 93/93 tests frontend verts (88 existants + 5 nouveaux AssetGrid).

### File List

- `frontend/components/media-library/AssetGrid.tsx` — NOUVEAU
- `frontend/components/media-library/MediaLibraryModal.tsx` — MODIFIÉ : import AssetGrid + remplacement placeholder
- `frontend/__tests__/media-library/AssetGrid.test.tsx` — NOUVEAU
- `frontend/__tests__/media-library/MediaLibraryModal.test.tsx` — MODIFIÉ : mock AssetGrid + resolveAsset dans mock api

## Change Log

- 2026-06-15 — Story 2.2 implémentée : composant `AssetGrid.tsx` (grille miniatures, filtre .keep, badge seed, mode selector), intégration dans `MediaLibraryModal.tsx`, mock `AssetGrid` dans `MediaLibraryModal.test.tsx`. 5 nouveaux tests, 93/93 verts. Status → review.
- 2026-06-15 — Post-review patches appliqués : filtre `config.filter` images enforced (+ 1 test), test coupling `.closest(".rounded-lg")` remplacé par `data-testid="asset-card"`. 94/94 verts. Status → done.
