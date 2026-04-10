# TEL-15 — Preview uniforme + vignettes de scènes (+ fixes #9, #10)

**Date** : 2026-04-10  
**Issues** : TEL-15 (Jira), GitHub #9 (bug), GitHub #10 (enhancement)

---

## Périmètre

Ce spec couvre quatre éléments liés à l'affichage de previews dans l'application :

1. **Bug #9** — Preview bloquée lors de l'édition d'un nœud
2. **Feature #10** — Désélectionner un personnage dans l'éditeur de dialogues
3. **TEL-15a** — Preview uniforme (scaling CSS basé sur 1920×1080)
4. **TEL-15b** — Vignettes de scènes avec personnages (éditeur de story + page d'accueil)

---

## 1. Bug #9 — Preview bloquée lors de l'édition

### Problème

Quand l'utilisateur édite un nœud dans `NodeForm`, `onPreview` est appelé à chaque frappe, ce qui active `previewPatch`. Ce patch remplace le nœud courant (`selectedNodeId`) dans `previewNodes`. Si l'utilisateur clique "avancer" dans la preview, `onIndexChange` met à jour `selectedNodeId` vers le nœud suivant, mais `previewPatch` n'est pas réinitialisé. Résultat : le nœud suivant est affiché avec le contenu de l'ancien nœud édité — donnant l'impression que la preview est "bloquée".

### Fix

**Fichier** : `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx`

Dans le callback `onIndexChange` passé à `ScenePlayer`, ajouter `setPreviewPatch(null)` :

```ts
onIndexChange={(idx) => {
  setPreviewIndex(idx);
  setPreviewPatch(null);  // réinitialise le patch pour éviter la contamination
  if (idx < nodes.length) setSelectedNodeId(nodes[idx].id);
}}
```

---

## 2. Feature #10 — Désélectionner un personnage

### Problème

Dans `DialogueFields` (`NodeForm.tsx`), cliquer sur un bloc personnage sélectionne ce personnage (`character_id = c.id`). Il n'est pas possible de revenir à un état sans personnage.

### Fix

**Fichier** : `frontend/components/NodeForm.tsx`, dans `DialogueFields`

Toggle : si le personnage est déjà sélectionné, le clic remet `character_id` à `null`.

```ts
onClick={() => onChange({ ...data, character_id: selectedCharId === c.id ? null : c.id })}
```

---

## 3. TEL-15a — Preview uniforme (scale 1920×1080)

### Objectif

Que la preview de ScenePlayer soit visuellement identique quelle que soit la taille du conteneur : éditeur compact, plein écran, page publique.

### Approche : CSS transform scale

On rend le contenu de `ScenePlayer` à une taille interne fixe de **1920×1080 px** (résolution de référence HD). Un `transform: scale(ratio)` avec `ratio = containerWidth / 1920` est appliqué à l'inner wrapper. L'outer wrapper maintient `aspect-ratio: 16/9` et `overflow: hidden`.

Avantages :
- Zéro modification des classes CSS existantes (Tailwind, inline styles)
- Le filtre SVG `feMorphology radius="4"` scale automatiquement
- Fonctionne pour tous les contextes d'utilisation (éditeur, play, public)

### Structure JSX cible

```tsx
const BASE_W = 1920;
const BASE_H = 1080;

// Dans ScenePlayer, après les hooks existants :
const [scale, setScale] = useState(1);

useEffect(() => {
  const ro = new ResizeObserver(([entry]) => {
    setScale(entry.contentRect.width / BASE_W);
  });
  if (containerRef.current) ro.observe(containerRef.current);
  return () => ro.disconnect();
}, []);

// Outer div (inchangé sauf ajout du ResizeObserver — containerRef déjà en place)
<div ref={containerRef} className="relative w-full overflow-hidden rounded-xl select-none"
     style={{ aspectRatio: "16/9" }}>
  {/* Inner wrapper — nouveau */}
  <div style={{
    position: "absolute",
    top: 0,
    left: 0,
    width: BASE_W,
    height: BASE_H,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  }}>
    {/* Tout le contenu actuel de ScenePlayer, inchangé */}
  </div>
</div>
```

**Références de scale** :
- Éditeur compact (`max-w-2xl` ≈ 672px) : scale ≈ 0.35
- Plein écran 1920px : scale = 1.0
- Écran 1280px : scale ≈ 0.67

**Fichier** : `frontend/components/ScenePlayer.tsx`

---

## 4. TEL-15b — Vignettes de scènes avec personnages

### Objectif

Afficher les personnages positionnés sur le fond dans les vignettes de scènes :
- Page d'édition de story (`/stories/[id]`) : liste des scènes
- Page d'accueil (`/`) : grille des stories (illustration de la première scène)

### 4a. Backend — Enrichissement des schémas

#### `SceneSummary`

Ajouter `character_ids` et `character_positions` à la réponse de résumé de scène (utilisé dans `Story.scenes[]`).

```python
class SceneSummary(BaseModel):
    # ... champs existants ...
    character_ids: list[int] = []
    character_positions: dict[str, CharacterPosition] = {}
```

#### `StorySummary`

Ajouter les données de la première scène et les personnages de la story pour la page d'accueil.

```python
class StorySummary(BaseModel):
    # ... champs existants (dont first_scene_background) ...
    first_scene_character_ids: list[int] = []
    first_scene_character_positions: dict[str, CharacterPosition] = {}
    characters: list[CharacterSchema] = []
```

Les champs `first_scene_character_ids` et `first_scene_character_positions` sont extraits de la première scène (ordre 0) de la story lors de la construction de la réponse.

### 4b. Frontend — Types

**Fichier** : `frontend/types/index.ts`

```ts
export interface SceneSummary {
  // ... champs existants ...
  character_ids: number[];
  character_positions: Record<string, CharacterPosition>;
}

export interface StorySummary {
  // ... champs existants ...
  first_scene_character_ids: number[];
  first_scene_character_positions: Record<string, CharacterPosition>;
  characters: Character[];
}
```

### 4c. Composant `ScenePreviewThumbnail`

**Fichier** : `frontend/components/ScenePreviewThumbnail.tsx`

Composant statique (pas d'interaction, pas de texte) affichant fond + sprites positionnés.

```ts
interface Props {
  backgroundAsset: AssetRef | null;
  characters: Character[];             // déjà filtrés par character_ids, ordonnés
  characterPositions: Record<string, CharacterPosition>;
  className?: string;
}
```

**Comportement** :
- Scale 1920 base via `ResizeObserver` (même logique que ScenePlayer)
- Positionnement sprites identique à ScenePlayer : `height: 100%`, `bottom: calc(-10% + y*50%)`, `left: ((x+1)/2)*100%`, `transform: translateX(-50%) scale(s) scaleX(flip)`
- Position par défaut si absente : `DEFAULT_POSITIONS[slotIndex]` (même constante que ScenePlayer — à extraire dans un fichier partagé ou dupliquer)
- Fond gris (`bg-slate-800`) si pas de `backgroundAsset`
- Pas de filtre SVG outline (preview statique)

**Note** : Les constantes `DEFAULT_POSITIONS` et `FALLBACK_POSITION` seront extraites de `ScenePlayer.tsx` vers `frontend/lib/scenePositions.ts`. `ScenePlayer` et `ScenePreviewThumbnail` importeront depuis ce module.

### 4d. Page d'édition de story — `SceneCard`

**Fichier** : `frontend/app/stories/[id]/page.tsx`

- `SceneCard` reçoit un prop `characters: Character[]` (filtré depuis `story.characters` par `scene.character_ids`)
- La vignette passe de `w-24 h-16` à `w-40 h-[90px]` (160×90 px, ratio 16:9 exact)
- Remplace l'actuelle `<div style={{ backgroundImage }}/>` par `<ScenePreviewThumbnail>`

```tsx
<ScenePreviewThumbnail
  backgroundAsset={scene.background_asset}
  characters={scene.character_ids
    .map(id => storyCharacters.find(c => c.id === id))
    .filter((c): c is Character => !!c)}
  characterPositions={scene.character_positions}
  className="w-40 h-[90px] flex-shrink-0 rounded-xl overflow-hidden"
/>
```

### 4e. Page d'accueil — `StoryCard`

**Fichier** : `frontend/app/page.tsx`

- La zone image passe à `aspect-video` (ratio 16:9) pour cohérence
- Remplace `<div style={{ backgroundImage }}/>` + fallback SVG par `<ScenePreviewThumbnail>`

```tsx
<ScenePreviewThumbnail
  backgroundAsset={story.first_scene_background}
  characters={story.characters.filter(c =>
    story.first_scene_character_ids.includes(c.id)
  ).sort((a, b) =>
    story.first_scene_character_ids.indexOf(a.id) -
    story.first_scene_character_ids.indexOf(b.id)
  )}
  characterPositions={story.first_scene_character_positions}
  className="w-full aspect-video"
/>
```

Le fallback (aucun fond) affiche un fond dégradé via la prop `backgroundAsset = null` gérée dans `ScenePreviewThumbnail`.

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `frontend/components/ScenePlayer.tsx` | Modifier — scale wrapper 1920×1080 |
| `frontend/components/ScenePreviewThumbnail.tsx` | Créer — composant vignette réutilisable |
| `frontend/lib/scenePositions.ts` | Créer — constantes DEFAULT_POSITIONS partagées |
| `frontend/types/index.ts` | Modifier — SceneSummary, StorySummary |
| `frontend/app/stories/[id]/page.tsx` | Modifier — SceneCard avec ScenePreviewThumbnail |
| `frontend/app/page.tsx` | Modifier — StoryCard avec ScenePreviewThumbnail |
| `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` | Modifier — fix bug #9 |
| `frontend/components/NodeForm.tsx` | Modifier — fix feature #10 |
| `backend/schemas.py` (ou équivalent) | Modifier — SceneSummary, StorySummary enrichis |
| `backend/main.py` (ou équivalent) | Modifier — construction des réponses enrichies |

---

## Tests

- **#9** : Éditer un nœud → cliquer avancer dans la preview → vérifier que le nœud suivant s'affiche correctement
- **#10** : Sélectionner un personnage → re-cliquer → vérifier que `character_id` repasse à `null` dans la preview
- **TEL-15a** : Vérifier visuellement que les proportions sont identiques dans l'éditeur compact et en plein écran
- **TEL-15b** : Vérifier les vignettes sur la page story et la page d'accueil, avec et sans personnages/fond
- Mettre à jour les tests Jest existants (`ScenePlayer.test.tsx`, `NodeForm.test.tsx`) si nécessaire
