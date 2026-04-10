# TEL-15 — Preview uniforme + Vignettes de scènes (+ fixes #9, #10) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le ScenePlayer visuellement uniforme à toute taille d'écran (scale 1920×1080), afficher les personnages dans les vignettes de scènes, et corriger deux bugs mineurs (#9 preview bloquée, #10 désélection personnage).

**Architecture:** CSS transform-scale sur un inner div 1920×1080 mesuré via ResizeObserver — zéro modification des classes CSS existantes. Nouveau composant `ScenePreviewThumbnail` (statique, réutilisable) consommant les mêmes constantes de positionnement que ScenePlayer via un module partagé `lib/scenePositions.ts`. Backend enrichi pour exposer `character_ids`/`character_positions` dans les résumés de scène et les données de stories.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind CSS, FastAPI, Pydantic v2, SQLAlchemy, pytest, Jest / React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-10-tel15-preview-uniforme-vignettes-design.md`

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `backend/schemas.py` | Modifier — `SceneSummary` + `StorySummary` |
| `backend/routers/stories.py` | Modifier — `list_stories` enrichi |
| `backend/tests/test_stories.py` | Modifier — nouveaux tests |
| `frontend/types/index.ts` | Modifier — `SceneSummary`, `StorySummary` |
| `frontend/lib/scenePositions.ts` | Créer — constantes partagées |
| `frontend/jest.setup.ts` | Modifier — mock ResizeObserver |
| `frontend/components/ScenePlayer.tsx` | Modifier — scale wrapper 1920×1080 |
| `frontend/components/ScenePreviewThumbnail.tsx` | Créer — vignette statique |
| `frontend/__tests__/ScenePreviewThumbnail.test.tsx` | Créer — tests |
| `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx` | Modifier — fix bug #9 |
| `frontend/components/NodeForm.tsx` | Modifier — fix feature #10 |
| `frontend/__tests__/NodeForm.test.tsx` | Modifier — test désélection |
| `frontend/app/stories/[id]/page.tsx` | Modifier — `SceneCard` avec vignette |
| `frontend/app/page.tsx` | Modifier — `StoryCard` avec vignette |

---

## Task 1 — Bug #9 : Reset de `previewPatch` lors de l'avance dans la preview

**Files:**
- Modify: `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx`

- [ ] **Step 1 : Localiser le callback `onIndexChange` dans `SceneEditorPage`**

Dans `frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx`, repérer le `ScenePlayer` rendu dans la zone de preview (environ ligne 381–399). Son prop `onIndexChange` ressemble à :

```tsx
onIndexChange={tab === "nodes" ? (idx) => {
  setPreviewIndex(idx);
  if (idx < nodes.length) setSelectedNodeId(nodes[idx].id);
} : undefined}
```

- [ ] **Step 2 : Ajouter `setPreviewPatch(null)`**

Remplacer ce callback par :

```tsx
onIndexChange={tab === "nodes" ? (idx) => {
  setPreviewIndex(idx);
  setPreviewPatch(null);
  if (idx < nodes.length) setSelectedNodeId(nodes[idx].id);
} : undefined}
```

- [ ] **Step 3 : Vérifier manuellement**

Lancer `cd frontend && npm run dev`, ouvrir l'éditeur d'une scène avec au moins 2 nœuds dialogue. Éditer le texte du nœud 1 (previewPatch actif), cliquer sur la bulle dans la preview → vérifier que la preview passe bien au nœud 2 avec le contenu correct.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/stories/[id]/scenes/[sceneId]/edit/page.tsx
git commit -m "fix: reset previewPatch lors de l'avance dans la preview (#9)"
```

---

## Task 2 — Feature #10 : Désélectionner un personnage dans NodeForm

**Files:**
- Modify: `frontend/components/NodeForm.tsx`
- Modify: `frontend/__tests__/NodeForm.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `frontend/__tests__/NodeForm.test.tsx`, ajouter ce test dans le bloc `describe("NodeForm — comportement général")` :

```tsx
it("désélectionne le personnage si on clique à nouveau sur lui", () => {
  const char = makeChar({ id: 1 });
  const node: StoryNode = {
    id: 1, scene_id: 1, order: 0, type: "dialogue",
    data: { character_id: 1, text: "Bonjour" } as StoryNode["data"],
  };
  const onSave = jest.fn();
  render(
    <NodeForm node={node} characters={[char]} onSave={onSave} onDelete={jest.fn()} />
  );
  // Le personnage Alice est sélectionné (character_id = 1)
  // Re-cliquer sur le bloc Alice doit appeler onSave avec character_id: null
  // L'auto-save se déclenche après 1s — on utilise jest.useFakeTimers
  jest.useFakeTimers();
  const aliceBlock = screen.getByText("Alice").closest("[role]") ??
    screen.getByText("Alice").parentElement!.parentElement!;
  fireEvent.click(aliceBlock);
  jest.runAllTimers();
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ character_id: null }),
    })
  );
  jest.useRealTimers();
});
```

- [ ] **Step 2 : Lancer le test et vérifier l'échec**

```bash
cd frontend && npx jest --testPathPattern="NodeForm" --no-coverage
```

Expected : FAIL — le test échoue car `character_id` reste à 1.

- [ ] **Step 3 : Appliquer le toggle dans `DialogueFields`**

Dans `frontend/components/NodeForm.tsx`, dans la fonction `DialogueFields`, localiser le handler `onClick` du bloc personnage (environ ligne 128) :

```tsx
onClick={() => onChange({ ...data, character_id: c.id })}
```

Remplacer par :

```tsx
onClick={() => onChange({ ...data, character_id: selectedCharId === c.id ? null : c.id })}
```

- [ ] **Step 4 : Relancer le test et vérifier le passage**

```bash
cd frontend && npx jest --testPathPattern="NodeForm" --no-coverage
```

Expected : PASS — tous les tests NodeForm passent.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/NodeForm.tsx frontend/__tests__/NodeForm.test.tsx
git commit -m "feat: désélectionner un personnage dans NodeForm dialogue (#10)"
```

---

## Task 3 — Backend : Enrichir `SceneSummary`

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/tests/test_stories.py`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `backend/tests/test_stories.py`, ajouter :

```python
def test_story_scenes_include_character_ids_and_positions(client):
    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Sc1"}
    ).json()["id"]
    # Créer un personnage
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {}},
    ).json()["id"]
    # Assigner le personnage à la scène avec une position
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={
            "character_ids": [char_id],
            "character_positions": {str(char_id): {"x": 0.5, "y": 0.0, "scale": 1.0, "flip_x": False}},
        },
    )
    res = client.get(f"/api/stories/{story_id}")
    assert res.status_code == 200
    scene = res.json()["scenes"][0]
    assert "character_ids" in scene
    assert char_id in scene["character_ids"]
    assert "character_positions" in scene
    assert str(char_id) in scene["character_positions"]
    assert scene["character_positions"][str(char_id)]["x"] == 0.5
```

- [ ] **Step 2 : Lancer le test et vérifier l'échec**

```bash
cd backend && python -m pytest tests/test_stories.py::test_story_scenes_include_character_ids_and_positions -v
```

Expected : FAIL — `character_ids` absent de `scene`.

- [ ] **Step 3 : Mettre à jour `SceneSummary` dans `schemas.py`**

Dans `backend/schemas.py`, remplacer la classe `SceneSummary` :

```python
class SceneSummary(BaseModel):
    id: int
    story_id: int
    title: str
    order: int
    background_asset: Optional[AssetRef] = None
    background_loop: bool
    character_ids: List[int] = []
    character_positions: Dict[str, CharacterPosition] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4 : Lancer le test et vérifier le passage**

```bash
cd backend && python -m pytest tests/test_stories.py::test_story_scenes_include_character_ids_and_positions -v
```

Expected : PASS.

- [ ] **Step 5 : Lancer la suite complète backend**

```bash
cd backend && python -m pytest
```

Expected : tous les tests passent (43+1).

- [ ] **Step 6 : Commit**

```bash
git add backend/schemas.py backend/tests/test_stories.py
git commit -m "feat: ajouter character_ids/positions dans SceneSummary"
```

---

## Task 4 — Backend : Enrichir `StorySummary`

**Files:**
- Modify: `backend/schemas.py`
- Modify: `backend/routers/stories.py`
- Modify: `backend/tests/test_stories.py`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `backend/tests/test_stories.py`, ajouter :

```python
def test_list_stories_includes_first_scene_chars_and_characters(client):
    story_id = client.post("/api/stories/", json={"title": "S"}).json()["id"]
    scene_id = client.post(
        f"/api/stories/{story_id}/scenes/", json={"title": "Sc1"}
    ).json()["id"]
    char_id = client.post(
        f"/api/stories/{story_id}/characters/",
        json={"name": "Alice", "sprites": {}},
    ).json()["id"]
    client.patch(
        f"/api/stories/{story_id}/scenes/{scene_id}",
        json={
            "character_ids": [char_id],
            "character_positions": {str(char_id): {"x": -0.3, "y": 0.0, "scale": 1.0, "flip_x": False}},
        },
    )
    res = client.get("/api/stories/")
    assert res.status_code == 200
    s = res.json()[0]
    assert "first_scene_character_ids" in s
    assert char_id in s["first_scene_character_ids"]
    assert "first_scene_character_positions" in s
    assert str(char_id) in s["first_scene_character_positions"]
    assert "characters" in s
    assert any(c["id"] == char_id for c in s["characters"])
```

- [ ] **Step 2 : Lancer le test et vérifier l'échec**

```bash
cd backend && python -m pytest tests/test_stories.py::test_list_stories_includes_first_scene_chars_and_characters -v
```

Expected : FAIL.

- [ ] **Step 3 : Mettre à jour `StorySummary` dans `schemas.py`**

Dans `backend/schemas.py`, remplacer la classe `StorySummary` :

```python
class StorySummary(BaseModel):
    id: int
    title: str
    slug: str
    published: bool
    first_scene_background: Optional[AssetRef] = None
    first_scene_character_ids: List[int] = []
    first_scene_character_positions: Dict[str, CharacterPosition] = {}
    characters: List[Character] = []
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4 : Mettre à jour `list_stories` dans `routers/stories.py`**

Remplacer la fonction `list_stories` :

```python
@router.get("/", response_model=List[schemas.StorySummary])
def list_stories(db: Session = Depends(get_db)):
    stories = (
        db.query(models.Story)
        .options(selectinload(models.Story.characters))
        .order_by(models.Story.updated_at.desc())
        .all()
    )
    result = []
    for story in stories:
        first_scene = story.scenes[0] if story.scenes else None
        result.append(schemas.StorySummary(
            id=story.id,
            title=story.title,
            slug=story.slug,
            published=story.published,
            first_scene_background=first_scene.background_asset if first_scene else None,
            first_scene_character_ids=first_scene.character_ids if first_scene else [],
            first_scene_character_positions=first_scene.character_positions if first_scene else {},
            characters=[schemas.Character.model_validate(c) for c in story.characters],
            created_at=story.created_at,
            updated_at=story.updated_at,
        ))
    return result
```

- [ ] **Step 5 : Lancer le test et vérifier le passage**

```bash
cd backend && python -m pytest tests/test_stories.py::test_list_stories_includes_first_scene_chars_and_characters -v
```

Expected : PASS.

- [ ] **Step 6 : Lancer la suite complète backend**

```bash
cd backend && python -m pytest
```

Expected : tous les tests passent.

- [ ] **Step 7 : Commit**

```bash
git add backend/schemas.py backend/routers/stories.py backend/tests/test_stories.py
git commit -m "feat: enrichir StorySummary avec personnages et positions première scène"
```

---

## Task 5 — Frontend : Mettre à jour les types

**Files:**
- Modify: `frontend/types/index.ts`

- [ ] **Step 1 : Mettre à jour `SceneSummary`**

Dans `frontend/types/index.ts`, remplacer `SceneSummary` :

```ts
export interface SceneSummary {
  id: number;
  story_id: number;
  title: string;
  order: number;
  background_asset: AssetRef | null;
  background_loop: boolean;
  character_ids: number[];
  character_positions: Record<string, CharacterPosition>;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2 : Mettre à jour `StorySummary`**

Dans le même fichier, remplacer `StorySummary` :

```ts
export interface StorySummary {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  first_scene_background: AssetRef | null;
  first_scene_character_ids: number[];
  first_scene_character_positions: Record<string, CharacterPosition>;
  characters: Character[];
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/types/index.ts
git commit -m "feat: mettre à jour types SceneSummary et StorySummary"
```

---

## Task 6 — Extraire `lib/scenePositions.ts`

**Files:**
- Create: `frontend/lib/scenePositions.ts`
- Modify: `frontend/components/ScenePlayer.tsx`

- [ ] **Step 1 : Créer `frontend/lib/scenePositions.ts`**

```ts
import type { CharacterPosition } from "@/types";

export const DEFAULT_POSITIONS: CharacterPosition[] = [
  { x: -0.35, y: 0, scale: 1, flip_x: false },
  { x:  0.35, y: 0, scale: 1, flip_x: true  },
  { x: -0.7,  y: 0, scale: 1, flip_x: false },
  { x:  0.7,  y: 0, scale: 1, flip_x: true  },
];

export const FALLBACK_POSITION: CharacterPosition = { x: 0, y: 0, scale: 1, flip_x: false };
```

- [ ] **Step 2 : Mettre à jour les imports dans `ScenePlayer.tsx`**

En haut de `frontend/components/ScenePlayer.tsx`, ajouter :

```ts
import { DEFAULT_POSITIONS, FALLBACK_POSITION } from "@/lib/scenePositions";
```

Supprimer les deux constantes définies localement dans le fichier (les lignes `const DEFAULT_POSITIONS: CharacterPosition[] = [...]` et `const FALLBACK_POSITION: CharacterPosition = {...}`).

- [ ] **Step 3 : Vérifier que les tests ScenePlayer passent**

```bash
cd frontend && npx jest --testPathPattern="ScenePlayer" --no-coverage
```

Expected : tous les tests PASS (les valeurs de position sont identiques).

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/scenePositions.ts frontend/components/ScenePlayer.tsx
git commit -m "refactor: extraire DEFAULT_POSITIONS vers lib/scenePositions.ts"
```

---

## Task 7 — ScenePlayer : Wrapper scale 1920×1080

**Files:**
- Modify: `frontend/jest.setup.ts`
- Modify: `frontend/components/ScenePlayer.tsx`

- [ ] **Step 1 : Mocker `ResizeObserver` dans Jest**

Dans `frontend/jest.setup.ts`, ajouter après l'import existant :

```ts
import "@testing-library/jest-dom";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

- [ ] **Step 2 : Ajouter le hook de scale dans `ScenePlayer.tsx`**

Dans `frontend/components/ScenePlayer.tsx`, ajouter les constantes après les imports (avant `interface Props`) :

```ts
const BASE_W = 1920;
const BASE_H = 1080;
```

Dans la fonction `ScenePlayer`, après la déclaration de `containerRef` (déjà existant), ajouter :

```ts
const [scale, setScale] = useState(1);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  setScale(el.getBoundingClientRect().width / BASE_W);
  const ro = new ResizeObserver(([entry]) => {
    setScale(entry.contentRect.width / BASE_W);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

- [ ] **Step 3 : Restructurer le JSX pour intégrer le scale wrapper**

Remplacer l'intégralité du JSX renvoyé par `ScenePlayer` (depuis le `// End screen` jusqu'à la fin de la fonction — les deux early-return et le return principal) par :

```tsx
return (
  <div
    ref={containerRef}
    className="relative w-full overflow-hidden rounded-xl select-none"
    style={{ aspectRatio: "16/9" }}
  >
    {isEndState ? (
      /* ── Écran de fin ── */
      <div className="absolute inset-0 flex items-center justify-center bg-[#0b1120]">
        <button
          onClick={restart}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          Recommencer
        </button>
      </div>
    ) : !node && !isPreviewMode ? (
      /* ── Aucun nœud ── */
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        Aucun nœud à afficher
      </div>
    ) : (
      /* ── Contenu scalé 1920×1080 ── */
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-slate-800"
          style={
            backgroundAsset
              ? {
                  backgroundImage: `url(${resolveAsset(backgroundAsset)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* SVG filter */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <filter id="outline-white" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="dilated" />
              <feFlood floodColor="white" floodOpacity="1" result="white" />
              <feComposite in="white" in2="dilated" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Characters */}
        {showMode !== "background-only" && (
          <div className="absolute inset-0 pointer-events-none">
            {displayChars.map((c) => {
              const isSpeaking = !isPreviewMode && node?.type === "dialogue" && speakingChar?.id === c.id;
              const pos = getCharPosition(c);
              const spriteKeys = node?.type === "dialogue"
                ? (data.sprite_keys as Record<string, string> | undefined)
                : undefined;
              const poseKey = spriteKeys?.[String(c.id)];
              const resolvedSprite = (poseKey && c.sprites[poseKey])
                ? c.sprites[poseKey]
                : Object.values(c.sprites)[0];
              return (
                <img
                  key={c.id}
                  src={resolvedSprite ? resolveAsset(resolvedSprite) : ""}
                  alt={c.name}
                  className="absolute object-contain transition-all duration-200"
                  style={{
                    height: "100%",
                    bottom: `calc(-10% + ${pos.y * 50}%)`,
                    left: `${((pos.x + 1) / 2) * 100}%`,
                    transform: `translateX(-50%) scale(${pos.scale}) scaleX(${pos.flip_x ? -1 : 1})`,
                    filter: isSpeaking ? "url(#outline-white)" : "none",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Dialogue box */}
        {!isPreviewMode && node?.type === "dialogue" && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] cursor-pointer"
            onClick={advance}
          >
            <div className="bg-slate-900/85 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
              {speakingChar && (
                <div className="text-sm font-semibold text-blue-300 mb-1">
                  {speakingChar.name}
                </div>
              )}
              <div className="flex items-end justify-between gap-4">
                <p className="text-white text-sm leading-relaxed flex-1">
                  {data.text as string}
                </p>
                <button className="flex-shrink-0 text-blue-300 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5l10 7-10 7V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Text node */}
        {!isPreviewMode && node?.type === "text" && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer p-8"
            onClick={advance}
          >
            <div className="bg-slate-900/85 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-6 max-w-xl w-full flex flex-col gap-4">
              <div className="prose prose-invert prose-sm max-w-none text-white leading-relaxed
                prose-p:my-1 prose-headings:text-white prose-headings:font-bold
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-strong:text-white prose-em:text-slate-200
                prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                prose-blockquote:border-blue-400 prose-blockquote:text-slate-300
                prose-code:text-blue-200 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded
                prose-a:text-blue-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.text as string}
                </ReactMarkdown>
              </div>
              <div className="flex justify-end">
                <button className="text-blue-300 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5l10 7-10 7V5z" />
                  </svg>
                  Continuer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz */}
        {!isPreviewMode && node?.type === "quiz" && quizState && (
          <QuizPanel
            data={data as unknown as QuizNodeData}
            quizState={quizState}
            showFeedback={showFeedback}
            onSelect={(idx) => {
              if (quizState.confirmed) return;
              const qd = data as unknown as QuizNodeData;
              if (qd.type === "qcu") {
                setQuizState({ selectedIndices: [idx], confirmed: false });
              } else {
                const already = quizState.selectedIndices.includes(idx);
                setQuizState({
                  selectedIndices: already
                    ? quizState.selectedIndices.filter((i) => i !== idx)
                    : [...quizState.selectedIndices, idx],
                  confirmed: false,
                });
              }
            }}
            onConfirm={() => {
              if (quizState.selectedIndices.length === 0) return;
              setQuizState((s) => s && { ...s, confirmed: true });
              setShowFeedback(true);
            }}
            onContinue={advance}
          />
        )}

        {/* Progress indicator */}
        {!isPreviewMode && (
          <div className="absolute top-3 right-3 text-xs text-white/50">
            {index + 1} / {nodes.length}
          </div>
        )}

        {/* Fullscreen toggle */}
        {!compact && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 left-3 text-white/50 hover:text-white transition-colors"
            title={activeFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {activeFullscreen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
              </svg>
            )}
          </button>
        )}
      </div>
    )}
  </div>
);
```

- [ ] **Step 4 : Lancer les tests ScenePlayer**

```bash
cd frontend && npx jest --testPathPattern="ScenePlayer" --no-coverage
```

Expected : tous les tests PASS (le scale CSS ne change pas les attributs DOM testés).

- [ ] **Step 5 : Lancer toute la suite Jest**

```bash
cd frontend && npm test -- --no-coverage
```

Expected : tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add frontend/jest.setup.ts frontend/components/ScenePlayer.tsx
git commit -m "feat: ScenePlayer scale uniforme 1920x1080 (TEL-15a)"
```

---

## Task 8 — Créer `ScenePreviewThumbnail`

**Files:**
- Create: `frontend/components/ScenePreviewThumbnail.tsx`
- Create: `frontend/__tests__/ScenePreviewThumbnail.test.tsx`

- [ ] **Step 1 : Écrire les tests**

Créer `frontend/__tests__/ScenePreviewThumbnail.test.tsx` :

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
import type { AssetRef, Character, CharacterPosition } from "@/types";

jest.mock("@/lib/api", () => ({
  resolveAsset: (ref: string | AssetRef | null | undefined) => {
    if (!ref) return "";
    if (typeof ref === "string") return ref;
    return ref.url ?? "";
  },
}));

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  story_id: 1,
  name: "Alice",
  sprites: {
    default: { type: "local", url: "/sprite_woman.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null },
  },
  ...overrides,
});

describe("ScenePreviewThumbnail", () => {
  it("rend le fond si backgroundAsset est fourni", () => {
    const bg: AssetRef = { type: "local", url: "/bg.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null };
    const { container } = render(
      <ScenePreviewThumbnail backgroundAsset={bg} characters={[]} characterPositions={{}} />
    );
    const bgDiv = container.querySelector("[style*='bg.png']");
    expect(bgDiv).toBeInTheDocument();
  });

  it("rend les sprites des personnages fournis", () => {
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1, name: "Alice" })]}
        characterPositions={{}}
      />
    );
    expect(screen.getByAltText("Alice")).toBeInTheDocument();
  });

  it("applique la position stockée si disponible", () => {
    const pos: CharacterPosition = { x: 0.5, y: 0, scale: 1, flip_x: false };
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1 })]}
        characterPositions={{ "1": pos }}
      />
    );
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    // x=0.5 → left = ((0.5+1)/2)*100 = 75%
    expect(img).toHaveStyle({ left: "75%" });
  });

  it("utilise DEFAULT_POSITIONS[0] si aucune position stockée (x=-0.35 → left=32.5%)", () => {
    render(
      <ScenePreviewThumbnail
        backgroundAsset={null}
        characters={[makeChar({ id: 1 })]}
        characterPositions={{}}
      />
    );
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img).toHaveStyle({ left: "32.5%" });
  });

  it("n'affiche pas de personnages si la liste est vide", () => {
    render(
      <ScenePreviewThumbnail backgroundAsset={null} characters={[]} characterPositions={{}} />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

```bash
cd frontend && npx jest --testPathPattern="ScenePreviewThumbnail" --no-coverage
```

Expected : FAIL — module introuvable.

- [ ] **Step 3 : Créer `ScenePreviewThumbnail.tsx`**

Créer `frontend/components/ScenePreviewThumbnail.tsx` :

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import type { AssetRef, Character, CharacterPosition } from "@/types";
import { resolveAsset } from "@/lib/api";
import { DEFAULT_POSITIONS, FALLBACK_POSITION } from "@/lib/scenePositions";

const BASE_W = 1920;
const BASE_H = 1080;

interface Props {
  backgroundAsset: AssetRef | null;
  characters: Character[];
  characterPositions: Record<string, CharacterPosition>;
  className?: string;
}

export default function ScenePreviewThumbnail({
  backgroundAsset,
  characters,
  characterPositions,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setScale(el.getBoundingClientRect().width / BASE_W);
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / BASE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getCharPosition = (c: Character): CharacterPosition => {
    const stored = characterPositions[String(c.id)];
    if (stored) return stored;
    const idx = characters.findIndex((ch) => ch.id === c.id);
    return DEFAULT_POSITIONS[idx >= 0 ? idx : 0] ?? FALLBACK_POSITION;
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-slate-800"
          style={
            backgroundAsset
              ? {
                  backgroundImage: `url(${resolveAsset(backgroundAsset)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* Characters */}
        <div className="absolute inset-0 pointer-events-none">
          {characters.map((c) => {
            const pos = getCharPosition(c);
            const sprite = Object.values(c.sprites)[0];
            return (
              <img
                key={c.id}
                src={sprite ? resolveAsset(sprite) : ""}
                alt={c.name}
                className="absolute object-contain"
                style={{
                  height: "100%",
                  bottom: `calc(-10% + ${pos.y * 50}%)`,
                  left: `${((pos.x + 1) / 2) * 100}%`,
                  transform: `translateX(-50%) scale(${pos.scale}) scaleX(${pos.flip_x ? -1 : 1})`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Lancer les tests et vérifier le passage**

```bash
cd frontend && npx jest --testPathPattern="ScenePreviewThumbnail" --no-coverage
```

Expected : tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/ScenePreviewThumbnail.tsx frontend/__tests__/ScenePreviewThumbnail.test.tsx
git commit -m "feat: composant ScenePreviewThumbnail — vignette statique avec personnages (TEL-15b)"
```

---

## Task 9 — Page story : `SceneCard` avec vignette

**Files:**
- Modify: `frontend/app/stories/[id]/page.tsx`

- [ ] **Step 1 : Ajouter l'import**

En haut de `frontend/app/stories/[id]/page.tsx`, ajouter :

```ts
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
```

Et ajouter `Character` aux types importés depuis `@/types` si pas déjà présent :

```ts
import type { SceneSummary, Story, Character } from "@/types";
```

- [ ] **Step 2 : Passer `characters` à `SceneCard`**

Dans la liste des scènes (la div `className="flex flex-col gap-3"`, environ ligne 259), remplacer chaque `<SceneCard ... />` par :

```tsx
<SceneCard
  key={scene.id}
  scene={scene}
  index={i}
  total={scenes.length}
  storyId={storyId}
  characters={characters}
  onMove={moveScene}
  onDelete={() => setConfirmDeleteSceneId(scene.id)}
/>
```

- [ ] **Step 3 : Mettre à jour la signature de `SceneCard`**

Remplacer la signature de la fonction `SceneCard` et son destructuring :

```tsx
function SceneCard({
  scene,
  index,
  total,
  storyId,
  characters,
  onMove,
  onDelete,
}: {
  scene: SceneSummary;
  index: number;
  total: number;
  storyId: number;
  characters: Character[];
  onMove: (id: number, dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  const router = useRouter();

  const sceneCharacters: Character[] = scene.character_ids
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
```

- [ ] **Step 4 : Remplacer la vignette par `ScenePreviewThumbnail`**

Dans `SceneCard`, localiser le bloc `{/* Thumbnail */}` et remplacer les deux branches (bgUrl et pas de bgUrl) par :

```tsx
{/* Thumbnail */}
<ScenePreviewThumbnail
  backgroundAsset={scene.background_asset}
  characters={sceneCharacters}
  characterPositions={scene.character_positions}
  className="w-40 h-[90px] flex-shrink-0 rounded-xl"
/>
```

Supprimer la ligne `const bgUrl = bg ? resolveAsset(bg) : null;` et la variable `bg` qui ne sont plus utilisées (si c'est le cas).

- [ ] **Step 5 : Vérifier la compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 6 : Vérifier visuellement**

Lancer `npm run dev`, ouvrir une story avec des scènes ayant des personnages assignés → les vignettes affichent fond + personnages à `160×90px`.

- [ ] **Step 7 : Commit**

```bash
git add frontend/app/stories/[id]/page.tsx
git commit -m "feat: vignettes scènes avec personnages dans la page story (TEL-15b)"
```

---

## Task 10 — Page d'accueil : `StoryCard` avec vignette

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

En haut de `frontend/app/page.tsx`, ajouter :

```ts
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
```

Ajouter `Character` aux types importés :

```ts
import type { StorySummary, Character } from "@/types";
```

- [ ] **Step 2 : Mettre à jour `StoryCard`**

Remplacer la fonction `StoryCard` en entier :

```tsx
function StoryCard({
  story,
  onDelete,
}: {
  story: StorySummary;
  onDelete: () => void;
}) {
  const router = useRouter();

  const firstSceneChars: Character[] = story.first_scene_character_ids
    .map((id) => story.characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  return (
    <div
      onClick={() => router.push(`/stories/${story.id}`)}
      className="group relative bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-black/20 cursor-pointer"
    >
      {/* Preview 16:9 avec personnages */}
      <ScenePreviewThumbnail
        backgroundAsset={story.first_scene_background}
        characters={firstSceneChars}
        characterPositions={story.first_scene_character_positions}
        className="w-full aspect-video"
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="font-semibold text-white leading-tight">{story.title}</h2>
          {story.published && (
            <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
              Publié
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-4">
          {new Date(story.updated_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {story.published && (
            <Link
              href={`/s/${story.slug}`}
              target="_blank"
              className="py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
              title="Voir la page publique"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          )}
          <button
            onClick={onDelete}
            className="py-2 px-3 rounded-lg bg-slate-700 hover:bg-red-900/40 text-slate-400 hover:text-red-300 text-sm transition-colors"
            title="Supprimer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 4 : Lancer la suite Jest complète**

```bash
cd frontend && npm test -- --no-coverage
```

Expected : tous les tests passent.

- [ ] **Step 5 : Vérifier visuellement**

Page d'accueil : les cartes de stories affichent la première scène en vignette 16:9 avec les personnages positionnés.

- [ ] **Step 6 : Commit final**

```bash
git add frontend/app/page.tsx
git commit -m "feat: vignettes stories avec personnages sur la page d'accueil (TEL-15b)"
```

---

## Checklist de validation finale

- [ ] `cd backend && python -m pytest` → tous les tests passent
- [ ] `cd frontend && npm test -- --no-coverage` → tous les tests passent
- [ ] `cd frontend && npx tsc --noEmit` → aucune erreur TypeScript
- [ ] Vérification visuelle : preview éditeur identique à plein écran (proportions 1920×1080)
- [ ] Vérification visuelle : vignettes scènes `160×90px` avec personnages sur la page story
- [ ] Vérification visuelle : cartes stories en 16:9 avec personnages sur la page d'accueil
- [ ] Bug #9 : avance dans la preview pendant l'édition → nœud suivant correct
- [ ] Feature #10 : clic sur personnage sélectionné → désélectionné
