# Design Spec — Anticipations d'intégration Media Creator

**Date :** 2026-04-07
**EPIC Jira :** TEL-5 (Prototype V2)
**Bloque :** TEL-8 (Refonte Story/Scene)
**Statut :** Approuvé

---

## Contexte

Le projet Tellana est amené à s'intégrer avec **Media Creator**, un projet compagnon de génération et d'édition d'images/vidéos par IA (architecture AWS + RunPod, local-first avec option cloud payante). Dans un premier temps, l'intégration sera de type **import d'assets** : Media Creator produit des images et vidéos que Tellana consomme comme décors, sprites et éléments de nœuds.

Pour éviter un refactoring majeur lors de cette intégration, plusieurs décisions d'architecture doivent être anticipées **avant** l'implémentation de TEL-8.

---

## Décisions de conception

| Sujet | Décision |
|---|---|
| Source des assets | Introduire un modèle `AssetRef` abstrayant la provenance (upload backend, URL distante, local OPFS, IA générative) |
| Types de nœuds | Prévoir l'extensibilité pour `image`, `video`, `image_text` dès la conception des schémas Pydantic |
| Sprites personnages | Prévoir plusieurs expressions par personnage (`sprites` map) au lieu d'un seul `image_url` |
| Fond de scène | Implémenter `background_asset: AssetRef` pour supporter image ET vidéo dès V2 |
| Architecture d'intégration | Phase 1 : "import d'assets" — Tellana reste server-centric, import via upload ou URL distante |
| Rendu texte-sur-image | Différencier rendu HTML (ScenePlayer) et export "baked" — hors scope immédiat |

---

## Modèle AssetRef

Point d'intégration central entre les deux projets. À terme, toute référence à un asset (image, vidéo) doit passer par ce modèle.

### Définition TypeScript (frontend)

```typescript
type AssetSource =
  | { type: "upload";    url: string }         // backend /uploads/ — actuel
  | { type: "remote";    url: string }          // URL externe (cloud Media Creator)
  | { type: "local";     opfsKey: string }      // OPFS local-first (futur)
  | { type: "generated"; jobId: string }        // asset généré par IA (futur)

type AssetRef = {
  source: AssetSource
  mimeType?: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm"
  width?: number
  height?: number
}
```

### Fonction resolveAsset() — extension de resolveImage()

La fonction `resolveImage()` existante dans `lib/api.ts` doit être complétée par `resolveAsset(ref: string | AssetRef): string` :
- `string` → comportement actuel (rétrocompatibilité)
- `AssetRef { type: "upload" }` → résolution URL backend
- `AssetRef { type: "remote" }` → URL directe
- `AssetRef { type: "local" }` → lecture OPFS (implémentation future)
- `AssetRef { type: "generated" }` → polling job IA (implémentation future)

**Pour V2 (TEL-8)**, seuls les types `upload` et `remote` sont requis.

### Schéma Pydantic backend (à créer dans schemas.py)

```python
class AssetRef(BaseModel):
    type: Literal["upload", "remote", "local", "generated"]
    url: str | None = None          # pour upload et remote
    opfs_key: str | None = None     # pour local
    job_id: str | None = None       # pour generated
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
```

---

## Types de nœuds extensibles

### Types actuels (V1)
```
"dialogue" | "text" | "quiz"
```

### Types à prévoir (schéma préparé, non implémentés en V2)

| Type | Description | Horizon |
|---|---|---|
| `"image"` | Panneau image plein écran (style BD/manga) | Moyen terme |
| `"video"` | Clip vidéo intégré dans la scène | Moyen terme |
| `"image_text"` | Image avec texte incrusté (roman photo) | Long terme |

### Convention Pydantic

Le `Literal` sur `type` dans les schémas Pydantic ne doit pas être durci au point de bloquer l'ajout de nouveaux types. Documenter explicitement dans `schemas.py` la liste des types prévus (commentaire) et la stratégie d'ajout (migration Alembic ou reset selon la phase).

---

## Sprites de personnages — Expressions multiples

### V1 actuel
```
Character { image_url: str }
```

### Cible (à implémenter dans TEL-8)

```python
# Backend — schemas.py
class CharacterBase(BaseModel):
    name: str
    sprites: dict[str, AssetRef]
    # ex: { "default": AssetRef(...), "happy": AssetRef(...) }
```

```typescript
// Frontend — types/index.ts
type Character = {
  id: number
  story_id: number
  name: string
  sprites: Record<string, AssetRef>
}
```

Dans les nœuds de dialogue, ajouter un champ optionnel `expression: str` (défaut : `"default"`). ScenePlayer sélectionne le sprite correspondant dans `character.sprites[expression]`.

**Rétrocompatibilité pour V2 :** lors de la migration, convertir `image_url` existant en `{ "default": { type: "upload", url: image_url } }`.

---

## Fond de scène — Support vidéo

### V1 actuel
```
Scene { background_url: str | None }
```

### À implémenter dès TEL-8

```python
# Backend — models.py / schemas.py
class Scene(Base):
    background_asset: JSON | None   # AssetRef sérialisé
    background_loop: bool = True    # pour les fonds vidéo
```

Implémenter directement `background_asset` dans TEL-8 plutôt que `background_url` pour éviter une seconde migration.

---

## Stratégie d'intégration phase 1

L'intégration initiale avec Media Creator est de type **"import d'assets"** :

1. Media Creator génère ou édite un asset (image ou vidéo)
2. L'asset est transmis à Tellana via :
   - **Upload direct** → `POST /api/assets/upload` → `AssetRef { type: "upload" }`
   - **URL distante** → référencée directement → `AssetRef { type: "remote", url: "..." }`
3. Tellana utilise l'asset normalement dans ses nœuds et décors

Aucune synchronisation en temps réel ni API bidirectionnelle n'est prévue dans cette phase.

---

## Hors scope (phase 1)

- Synchronisation temps réel entre Media Creator et Tellana
- Mode local-first dans Tellana (OPFS/IndexedDB)
- Export "baked" image/vidéo depuis le ScenePlayer (roman photo statique)
- Implémentation des nœuds `image`, `video`, `image_text` (schéma préparé, UI non développée)
- UI pour les expressions multiples de personnages (schéma préparé, sélecteur non développé)
