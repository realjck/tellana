# Modale de paramètres d'embranchement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de définir 2 à 5 choix labellisés et ordonnés sur un nœud branch via une modale (double-clic), corrigeant le bug où tous les choix s'affichent « Choix 1 ».

**Architecture:** Les choix deviennent une propriété du nœud branch (`data.choices = [{id,label}]`). Chaque edge sortant mémorise `source_handle = choice.id` (nouvelle colonne) pour relier un choix à sa cible. La modale édite `data` (titre, show_visited, choix) ; le raccordement reste sur le canvas.

**Tech Stack:** FastAPI + SQLAlchemy + SQLite (backend), Next.js 16 / React 19 / @xyflow/react (frontend), pytest + Jest.

Spec : `docs/superpowers/specs/2026-06-13-branch-settings-modal-design.md`.

---

## File Structure

**Backend**
- Modify `backend/models.py` — colonne `GraphEdge.source_handle`.
- Modify `backend/main.py` — migration safe ALTER TABLE.
- Modify `backend/schemas.py` — `source_handle` sur `GraphEdge` / `GraphEdgeCreate`.
- Modify `backend/routers/graph.py` — persiste `source_handle` à la création d'edge.
- Modify `backend/tests/test_graph.py` — test source_handle.

**Frontend — données**
- Modify `frontend/types/index.ts` — `GraphChoice`, `choices` sur `GraphNodeData`, `source_handle` sur `GraphEdge`.
- Modify `frontend/lib/api.ts` — `source_handle` dans `createEdge`.

**Frontend — player**
- Modify `frontend/components/BranchOverlay.tsx` — prop `options`.
- Modify `frontend/components/GraphPlayer.tsx` — branch mappe `choices` via `source_handle`.
- Modify `frontend/__tests__/BranchOverlay.test.tsx`, `frontend/__tests__/GraphPlayer.test.tsx`.

**Frontend — éditeur**
- Create `frontend/components/BranchSettingsModal.tsx` — la modale (+ `makeChoiceId` exporté).
- Create `frontend/__tests__/BranchSettingsModal.test.tsx`.
- Modify `frontend/components/canvas/BranchNode.tsx` — handles dynamiques, sans rename inline.
- Modify `frontend/app/stories/[id]/canvas/page.tsx` — double-clic → modale, `onConnect`/`toFlowEdge`/`toFlowNode`/`createNode`/reconciliation.

---

## Task 1: Backend — colonne `source_handle`

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`
- Modify: `backend/schemas.py`
- Modify: `backend/routers/graph.py`
- Test: `backend/tests/test_graph.py`

- [ ] **Step 1: Write the failing test**

Ajouter à la fin de `backend/tests/test_graph.py` :

```python
# ── source_handle ───────────────────────────────────────────────────────────

def test_create_edge_with_source_handle(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id, "source_handle": "c_abc"},
    )
    assert res.status_code == 201
    assert res.json()["source_handle"] == "c_abc"

    graph = client.get(f"/api/stories/{story_id}/graph").json()
    assert graph["edges"][0]["source_handle"] == "c_abc"


def test_create_edge_source_handle_defaults_null(client, story_id, start_node_id):
    end_id = client.post(
        f"/api/stories/{story_id}/graph/nodes",
        json={"type": "end", "data": {"type": "good", "title": "Fin", "text": ""}},
    ).json()["id"]
    res = client.post(
        f"/api/stories/{story_id}/graph/edges",
        json={"source_node_id": start_node_id, "target_node_id": end_id},
    )
    assert res.status_code == 201
    assert res.json()["source_handle"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_graph.py::test_create_edge_with_source_handle -v`
Expected: FAIL (`source_handle` absent de la réponse → `KeyError` / `assert None == "c_abc"`).

- [ ] **Step 3: Add the column on the model**

Dans `backend/models.py`, classe `GraphEdge`, ajouter le champ après `label` :

```python
class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    source_node_id = Column(Integer, ForeignKey("graph_nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("graph_nodes.id"), nullable=False)
    label = Column(String, nullable=True)
    source_handle = Column(String, nullable=True)
    order = Column(Integer, nullable=False, default=0)

    story = relationship("Story", back_populates="graph_edges")
```

- [ ] **Step 4: Add the safe migration**

Dans `backend/main.py`, après le bloc de migration `published_at` (vers la ligne 34), ajouter :

```python
# Safe migration: add source_handle column to graph_edges if it doesn't exist yet
with engine.begin() as _conn:
    try:
        _conn.execute(text("ALTER TABLE graph_edges ADD COLUMN source_handle TEXT"))
    except Exception:
        pass  # Column already exists
```

- [ ] **Step 5: Add the field on the schemas**

Dans `backend/schemas.py`, ajouter `source_handle` à `GraphEdgeCreate` et `GraphEdge` :

```python
class GraphEdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    label: Optional[str] = None
    source_handle: Optional[str] = None
    order: int = 0


class GraphEdge(BaseModel):
    id: int
    story_id: int
    source_node_id: int
    target_node_id: int
    label: Optional[str] = None
    source_handle: Optional[str] = None
    order: int

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Persist it in the router**

Dans `backend/routers/graph.py`, fonction `create_graph_edge`, compléter la construction du `GraphEdge` :

```python
    db_edge = models.GraphEdge(
        story_id=story_id,
        source_node_id=edge.source_node_id,
        target_node_id=edge.target_node_id,
        label=edge.label,
        source_handle=edge.source_handle,
        order=edge.order,
    )
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_graph.py -v`
Expected: PASS (tous les tests graph, dont les 2 nouveaux). Supprimer `backend/tellana.db` au préalable si présent, pour que `create_all` régénère le schéma : `rm -f backend/tellana.db`.

- [ ] **Step 8: Commit**

```bash
git add backend/models.py backend/main.py backend/schemas.py backend/routers/graph.py backend/tests/test_graph.py
git commit -m "feat: TEL-24 source_handle sur graph_edges (lien choix→edge)"
```

---

## Task 2: Frontend — types & api

**Files:**
- Modify: `frontend/types/index.ts`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add the types**

Dans `frontend/types/index.ts`, dans le bloc Graph, ajouter `GraphChoice`, le champ `choices` sur `GraphNodeData`, et `source_handle` sur `GraphEdge` :

```ts
export type GraphNodeType = "start" | "scene" | "branch" | "end";
export type EndNodeEndType = "good" | "bad" | "neutral";

export interface GraphChoice {
  id: string;
  label: string;
}

export interface GraphNodeData {
  scene_id?: number;
  title?: string | null;
  replay?: boolean;
  show_visited?: boolean;
  choices?: GraphChoice[];
  type?: EndNodeEndType;
  text?: string;
}

export interface GraphEdge {
  id: number;
  story_id: number;
  source_node_id: number;
  target_node_id: number;
  label: string | null;
  source_handle?: string | null;
  order: number;
}
```

- [ ] **Step 2: Add source_handle to api.createEdge**

Dans `frontend/lib/api.ts`, élargir le type du paramètre `data` de `createEdge` :

```ts
    createEdge: (
      storyId: number,
      data: { source_node_id: number; target_node_id: number; label?: string | null; order?: number; source_handle?: string | null }
    ) =>
      request<GraphEdge>(`/api/stories/${storyId}/graph/edges`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur introduite par ces fichiers (des erreurs subsisteront tant que BranchOverlay/GraphPlayer ne sont pas mis à jour — vérifier seulement qu'aucune ne concerne `types/index.ts` ni `lib/api.ts`).

- [ ] **Step 4: Commit**

```bash
git add frontend/types/index.ts frontend/lib/api.ts
git commit -m "feat: TEL-24 types GraphChoice + source_handle (front)"
```

---

## Task 3: Frontend — BranchOverlay (prop `options`)

**Files:**
- Modify: `frontend/components/BranchOverlay.tsx`
- Test: `frontend/__tests__/BranchOverlay.test.tsx`

- [ ] **Step 1: Rewrite the test**

Remplacer **tout** le contenu de `frontend/__tests__/BranchOverlay.test.tsx` par :

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchOverlay from "@/components/BranchOverlay";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveAsset: () => "",
  randomCharacterColor: () => "#FF6B6B",
}));

describe("BranchOverlay", () => {
  it("affiche les boutons de choix", () => {
    const options = [
      { label: "Option A", edgeId: 1, targetNodeId: 11, visited: false },
      { label: "Option B", edgeId: 2, targetNodeId: 12, visited: false },
    ];
    render(<BranchOverlay options={options} onChoice={() => {}} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("appelle onChoice avec edgeId et targetNodeId au clic", () => {
    const onChoice = jest.fn();
    const options = [{ label: "Aller voir", edgeId: 5, targetNodeId: 99, visited: false }];
    render(<BranchOverlay options={options} onChoice={onChoice} />);
    fireEvent.click(screen.getByText("Aller voir"));
    expect(onChoice).toHaveBeenCalledWith(5, 99);
  });

  it("ne fait rien au clic sur un choix non raccordé", () => {
    const onChoice = jest.fn();
    const options = [{ label: "Non relié", edgeId: null, targetNodeId: null, visited: false }];
    render(<BranchOverlay options={options} onChoice={onChoice} />);
    fireEvent.click(screen.getByText("Non relié"));
    expect(onChoice).not.toHaveBeenCalled();
  });

  it("applique la classe visited sur les choix visités", () => {
    const options = [
      { label: "Chemin A", edgeId: 1, targetNodeId: 11, visited: true },
      { label: "Chemin B", edgeId: 2, targetNodeId: 12, visited: false },
    ];
    render(<BranchOverlay options={options} onChoice={() => {}} />);
    expect(screen.getByText("Chemin A").closest("button")?.className).toContain("player-branch-option-visited");
    expect(screen.getByText("Chemin B").closest("button")?.className).not.toContain("player-branch-option-visited");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- BranchOverlay`
Expected: FAIL (compile/prop errors — `BranchOverlay` attend encore `edges`/`visitedEdgeIds`).

- [ ] **Step 3: Rewrite the component**

Remplacer **tout** le contenu de `frontend/components/BranchOverlay.tsx` par :

```tsx
"use client";

interface BranchOption {
  label: string;
  edgeId: number | null;
  targetNodeId: number | null;
  visited: boolean;
}

interface Props {
  options: BranchOption[];
  onChoice: (edgeId: number, targetNodeId: number) => void;
}

export default function BranchOverlay({ options, onChoice }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center player-branch-overlay">
      <div className="flex flex-col gap-3 w-full max-w-md px-8">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (opt.edgeId !== null && opt.targetNodeId !== null) {
                onChoice(opt.edgeId, opt.targetNodeId);
              }
            }}
            className={`w-full px-6 py-3.5 rounded-md text-left text-base font-medium border cursor-pointer transition-all player-option ${opt.visited ? "player-branch-option-visited" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- BranchOverlay`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/BranchOverlay.tsx frontend/__tests__/BranchOverlay.test.tsx
git commit -m "feat: TEL-24 BranchOverlay options (labels par choix)"
```

---

## Task 4: Frontend — GraphPlayer (mapping choices ↔ edges)

**Files:**
- Modify: `frontend/components/GraphPlayer.tsx`
- Test: `frontend/__tests__/GraphPlayer.test.tsx`

- [ ] **Step 1: Update the test fixtures and branch test**

Dans `frontend/__tests__/GraphPlayer.test.tsx` :

Remplacer le helper `makeEdge` :

```tsx
const makeEdge = (id: number, src: number, tgt: number, label: string | null = null, order = 0, source_handle: string | null = null): GraphEdge => ({
  id, story_id: 1, source_node_id: src, target_node_id: tgt, label, order, source_handle,
});
```

Remplacer la constante `BRANCH` :

```tsx
const BRANCH = makeNode(3, "branch", { title: null, show_visited: true, choices: [{ id: "c1", label: "Choix A" }] });
```

Remplacer le test « affiche BranchOverlay pour un nœud branch » :

```tsx
  it("affiche BranchOverlay pour un nœud branch (via localStorage)", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 3, visitedEdgeIds: [] }));
    const graph: GraphResponse = {
      nodes: [START, BRANCH, END],
      edges: [makeEdge(10, 3, 4, null, 0, "c1")],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    expect(screen.getByText("Choix A")).toBeInTheDocument();
  });

  it("affiche un choix non raccordé sans cible", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 3, visitedEdgeIds: [] }));
    const branch = makeNode(3, "branch", {
      show_visited: true,
      choices: [{ id: "c1", label: "Relié" }, { id: "c2", label: "Orphelin" }],
    });
    const graph: GraphResponse = {
      nodes: [START, branch, END],
      edges: [makeEdge(10, 3, 4, null, 0, "c1")],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    expect(screen.getByText("Relié")).toBeInTheDocument();
    expect(screen.getByText("Orphelin")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- GraphPlayer`
Expected: FAIL (le branch lit encore `edges`/`edge.label`, « Choix A » introuvable / « Orphelin » absent).

- [ ] **Step 3: Update the branch rendering in GraphPlayer**

Dans `frontend/components/GraphPlayer.tsx`, remplacer **tout** le bloc `if (currentNode.type === "branch") { ... }` par :

```tsx
  // ── Branch node ────────────────────────────────────────────────────────────

  if (currentNode.type === "branch") {
    const d = currentNode.data as { show_visited?: boolean; choices?: { id: string; label: string }[] };
    const showVisited = d.show_visited !== false;
    const choices = d.choices ?? [];
    const outgoing = edgesFrom.get(currentNode.id) ?? [];
    const options = choices.map((choice) => {
      const edge = outgoing.find((e) => e.source_handle === choice.id) ?? null;
      return {
        label: choice.label,
        edgeId: edge?.id ?? null,
        targetNodeId: edge?.target_node_id ?? null,
        visited: showVisited && edge ? visitedEdgeIds.includes(edge.id) : false,
      };
    });
    const sceneChars: Character[] = lastScene
      ? lastScene.character_ids
          .map((id) => story.characters.find((c) => c.id === id))
          .filter((c): c is Character => !!c)
      : [];
    return (
      <div className="relative w-full rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <ScenePreviewThumbnail
          backgroundAsset={lastScene?.background_asset ?? null}
          characters={sceneChars}
          characterPositions={lastScene?.character_positions ?? {}}
          className="absolute inset-0"
        />
        <BranchOverlay
          options={options}
          onChoice={(edgeId, targetNodeId) => navigate(targetNodeId, edgeId)}
        />
      </div>
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- GraphPlayer`
Expected: PASS (tous les tests GraphPlayer).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/GraphPlayer.tsx frontend/__tests__/GraphPlayer.test.tsx
git commit -m "feat: TEL-24 GraphPlayer mappe choices via source_handle"
```

---

## Task 5: Frontend — BranchSettingsModal

**Files:**
- Create: `frontend/components/BranchSettingsModal.tsx`
- Test: `frontend/__tests__/BranchSettingsModal.test.tsx`

- [ ] **Step 1: Write the test**

Créer `frontend/__tests__/BranchSettingsModal.test.tsx` :

```tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchSettingsModal from "@/components/BranchSettingsModal";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveAsset: () => "",
  randomCharacterColor: () => "#FF6B6B",
}));

const initial = {
  title: "Embranchement 1",
  show_visited: true,
  choices: [
    { id: "c1", label: "Choix 1" },
    { id: "c2", label: "Choix 2" },
  ],
};

describe("BranchSettingsModal", () => {
  it("affiche les choix initiaux", () => {
    render(<BranchSettingsModal initial={initial} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByDisplayValue("Choix 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Choix 2")).toBeInTheDocument();
  });

  it("ajoute un choix (max 5)", () => {
    render(<BranchSettingsModal initial={initial} onSave={() => {}} onCancel={() => {}} />);
    const add = screen.getByText("+ Ajouter un choix");
    fireEvent.click(add); // 3
    fireEvent.click(add); // 4
    fireEvent.click(add); // 5
    expect(screen.getByDisplayValue("Choix 5")).toBeInTheDocument();
    expect(add).toBeDisabled();
  });

  it("ne descend pas en dessous de 2 choix", () => {
    render(<BranchSettingsModal initial={initial} onSave={() => {}} onCancel={() => {}} />);
    const removeButtons = screen.getAllByTitle("Supprimer");
    removeButtons.forEach((b) => expect(b).toBeDisabled());
  });

  it("réordonne les choix vers le bas", () => {
    const onSave = jest.fn();
    render(<BranchSettingsModal initial={initial} onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getAllByTitle("Descendre")[0]); // descend Choix 1
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave.mock.calls[0][0].choices.map((c: { label: string }) => c.label)).toEqual(["Choix 2", "Choix 1"]);
  });

  it("rétablit le label par défaut si vide", () => {
    const onSave = jest.fn();
    render(<BranchSettingsModal initial={initial} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByDisplayValue("Choix 1"), { target: { value: "  " } });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave.mock.calls[0][0].choices[0].label).toBe("Choix 1");
  });

  it("renvoie title et show_visited via onSave", () => {
    const onSave = jest.fn();
    render(<BranchSettingsModal initial={initial} onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Afficher les liens/));
    fireEvent.click(screen.getByText("Enregistrer"));
    const payload = onSave.mock.calls[0][0];
    expect(payload.title).toBe("Embranchement 1");
    expect(payload.show_visited).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- BranchSettingsModal`
Expected: FAIL (`Cannot find module '@/components/BranchSettingsModal'`).

- [ ] **Step 3: Write the component**

Créer `frontend/components/BranchSettingsModal.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import type { GraphChoice } from "@/types";

export function makeChoiceId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface BranchData {
  title: string;
  show_visited: boolean;
  choices: GraphChoice[];
}

interface Props {
  initial: BranchData;
  onSave: (data: BranchData) => void;
  onCancel: () => void;
}

export default function BranchSettingsModal({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [showVisited, setShowVisited] = useState(initial.show_visited !== false);
  const [choices, setChoices] = useState<GraphChoice[]>(
    initial.choices && initial.choices.length >= 2
      ? initial.choices
      : [
          { id: makeChoiceId(), label: "Choix 1" },
          { id: makeChoiceId(), label: "Choix 2" },
        ]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const updateLabel = (id: string, label: string) =>
    setChoices((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)));

  const addChoice = () =>
    setChoices((cs) => (cs.length >= 5 ? cs : [...cs, { id: makeChoiceId(), label: `Choix ${cs.length + 1}` }]));

  const removeChoice = (id: string) =>
    setChoices((cs) => (cs.length <= 2 ? cs : cs.filter((c) => c.id !== id)));

  const move = (index: number, dir: -1 | 1) =>
    setChoices((cs) => {
      const j = index + dir;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const handleSave = () => {
    const cleaned = choices.map((c, i) => ({ id: c.id, label: c.label.trim() || `Choix ${i + 1}` }));
    onSave({ title: title.trim(), show_visited: showVisited, choices: cleaned });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-elevated border border-white/10 rounded-lg shadow-2xl px-6 py-5 w-full max-w-md mx-4">
        <h2 className="text-fore text-base font-semibold mb-4">Paramètres de l&apos;embranchement</h2>

        <label className="block text-xs text-muted mb-1">Titre</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Embranchement"
          className="w-full bg-raised border border-white/15 rounded px-3 py-2 text-fore text-sm focus:outline-none mb-4"
        />

        <div className="text-xs text-muted mb-2">Choix ({choices.length}/5)</div>
        <div className="flex flex-col gap-2 mb-3">
          {choices.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                value={c.label}
                onChange={(e) => updateLabel(c.id, e.target.value)}
                placeholder={`Choix ${i + 1}`}
                className="flex-1 bg-raised border border-white/15 rounded px-3 py-1.5 text-fore text-sm focus:outline-none"
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter"
                className="w-7 h-7 rounded bg-raised hover:bg-surface text-muted disabled:opacity-30 text-sm">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === choices.length - 1} title="Descendre"
                className="w-7 h-7 rounded bg-raised hover:bg-surface text-muted disabled:opacity-30 text-sm">▼</button>
              <button onClick={() => removeChoice(c.id)} disabled={choices.length <= 2} title="Supprimer"
                className="w-7 h-7 rounded bg-raised hover:bg-red-600/70 text-muted disabled:opacity-30 text-sm">✕</button>
            </div>
          ))}
        </div>

        <button onClick={addChoice} disabled={choices.length >= 5}
          className="text-sm text-primary hover:underline disabled:opacity-40 disabled:no-underline mb-4">
          + Ajouter un choix
        </button>

        <label className="flex items-center gap-2 text-sm text-fore mb-5 cursor-pointer">
          <input type="checkbox" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} />
          Afficher les liens déjà visités
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded bg-raised hover:bg-elevated/80 text-fore/70 text-sm transition-colors">
            Annuler
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- BranchSettingsModal`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/BranchSettingsModal.tsx frontend/__tests__/BranchSettingsModal.test.tsx
git commit -m "feat: TEL-24 BranchSettingsModal (choix 2-5, ordre, show_visited)"
```

---

## Task 6: Frontend — BranchNode (handles dynamiques, sans rename inline)

**Files:**
- Modify: `frontend/components/canvas/BranchNode.tsx`

Pas de test unitaire (rendu React Flow, dépend du contexte canvas). Vérification par compilation + build.

- [ ] **Step 1: Rewrite the component**

Remplacer **tout** le contenu de `frontend/components/canvas/BranchNode.tsx` par :

```tsx
"use client";

import { Handle, Position } from "@xyflow/react";
import type { GraphChoice } from "@/types";

interface BranchNodeData {
  title: string;
  choices: GraphChoice[];
  selected: boolean;
}

export default function BranchNode({ data }: { data: BranchNodeData }) {
  const choices = data.choices ?? [];
  const n = choices.length;
  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-amber-200 text-sm font-medium truncate max-w-[150px]">
          {data.title || <span className="text-amber-400/50 italic">Embranchement</span>}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mb-1">
        {choices.map((c) => (
          <div key={c.id} className="text-amber-100/70 text-xs truncate max-w-[150px]">
            {c.label}
          </div>
        ))}
      </div>
      {choices.map((c, i) => (
        <Handle
          key={c.id}
          type="source"
          position={Position.Bottom}
          id={c.id}
          style={{ left: `${((i + 1) / (n + 1)) * 100}%` }}
          className="!bg-amber-400"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur concernant `BranchNode.tsx` (des erreurs sur `canvas/page.tsx` peuvent subsister tant que la Task 7 n'est pas faite — c'est attendu).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/canvas/BranchNode.tsx
git commit -m "feat: TEL-24 BranchNode handles dynamiques par choix"
```

---

## Task 7: Frontend — Canvas wiring

**Files:**
- Modify: `frontend/app/stories/[id]/canvas/page.tsx`

Pas de test unitaire (page React Flow). Vérification par build + checklist manuelle finale (Task 8).

- [ ] **Step 1: Add imports**

En haut de `frontend/app/stories/[id]/canvas/page.tsx`, après l'import de `EndNode`, ajouter :

```tsx
import BranchSettingsModal, { makeChoiceId } from "@/components/BranchSettingsModal";
import type { GraphChoice } from "@/types";
```

- [ ] **Step 2: Update toFlowNode (branch branch)**

Dans la fonction `toFlowNode`, remplacer le bloc `if (n.type === "branch") { ... }` par :

```tsx
  if (n.type === "branch") {
    return {
      ...base, type: "branch",
      data: {
        title: (n.data as { title?: string }).title ?? "",
        choices: (n.data as { choices?: GraphChoice[] }).choices ?? [],
        selected: id === selectedId,
      },
    };
  }
```

- [ ] **Step 3: Update toFlowEdge**

Remplacer la fonction `toFlowEdge` par :

```tsx
function toFlowEdge(e: GraphEdge): Edge {
  return {
    id: String(e.id),
    source: String(e.source_node_id),
    target: String(e.target_node_id),
    sourceHandle: e.source_handle ?? undefined,
    label: e.label ?? undefined,
    data: { dbId: e.id },
  };
}
```

- [ ] **Step 4: Add modal state**

Dans `CanvasInner`, après la ligne `const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);`, ajouter :

```tsx
  const [branchModalNodeId, setBranchModalNodeId] = useState<number | null>(null);
```

- [ ] **Step 5: Update onConnect to pass source_handle**

Remplacer le corps de `onConnect` par :

```tsx
  const onConnect: OnConnect = useCallback(async (params) => {
    const sourceId = Number(params.source);
    const targetId = Number(params.target);
    try {
      const dbEdge = await api.graph.createEdge(storyId, {
        source_node_id: sourceId,
        target_node_id: targetId,
        label: null,
        order: 0,
        source_handle: params.sourceHandle ?? null,
      });
      setEdges((eds) => addEdge({ ...params, id: String(dbEdge.id), data: { dbId: dbEdge.id } }, eds));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      alert(msg);
    }
  }, [storyId, setEdges]);
```

- [ ] **Step 6: Open the modal on branch double-click**

Remplacer `handleNodeDoubleClick` par :

```tsx
  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type === "branch") {
      setBranchModalNodeId(Number(node.id));
      return;
    }
    const cb = (node.data as { onDoubleClick?: () => void }).onDoubleClick;
    if (cb) cb();
  }, []);
```

- [ ] **Step 7: Auto-numbered branch + default choices in createNode**

Dans `createNode`, remplacer la branche `else if (type === "branch")` par :

```tsx
    } else if (type === "branch") {
      const branchCount = nodes.filter((n) => n.type === "branch").length;
      data = {
        title: `Embranchement ${branchCount + 1}`,
        show_visited: true,
        choices: [
          { id: makeChoiceId(), label: "Choix 1" },
          { id: makeChoiceId(), label: "Choix 2" },
        ],
      };
```

- [ ] **Step 8: Add handleBranchSave**

Dans `CanvasInner`, après `createNode`, ajouter :

```tsx
  // ── branch settings save (data + edge reconciliation) ───────────────────

  const handleBranchSave = useCallback(
    async (nodeId: number, data: { title: string; show_visited: boolean; choices: GraphChoice[] }) => {
      await api.graph.updateNode(storyId, nodeId, { data: data as Record<string, unknown> });
      const validIds = new Set(data.choices.map((c) => c.id));
      const orphans = edges.filter(
        (e) => e.source === String(nodeId) && e.sourceHandle != null && !validIds.has(e.sourceHandle)
      );
      for (const e of orphans) {
        const dbId = (e.data as { dbId?: number })?.dbId;
        if (dbId) await api.graph.deleteEdge(storyId, dbId);
      }
      const orphanIds = new Set(orphans.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !orphanIds.has(e.id)));
      setNodes((nds) =>
        nds.map((n) => (n.id === String(nodeId) ? { ...n, data: { ...n.data, ...data } } : n))
      );
      setBranchModalNodeId(null);
    },
    [storyId, edges, setEdges, setNodes]
  );
```

- [ ] **Step 9: Render the modal**

Dans le `return` de `CanvasInner`, juste avant la fermeture `</div>` du conteneur racine (après le bloc `{contextMenu && (...)}`), ajouter :

```tsx
      {branchModalNodeId != null && (() => {
        const node = nodes.find((n) => n.id === String(branchModalNodeId));
        if (!node) return null;
        const d = node.data as { title?: string; show_visited?: boolean; choices?: GraphChoice[] };
        return (
          <BranchSettingsModal
            initial={{
              title: d.title ?? "",
              show_visited: d.show_visited !== false,
              choices: d.choices ?? [],
            }}
            onSave={(data) => handleBranchSave(branchModalNodeId, data)}
            onCancel={() => setBranchModalNodeId(null)}
          />
        );
      })()}
```

- [ ] **Step 10: Verify it compiles and builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 11: Commit**

```bash
git add frontend/app/stories/[id]/canvas/page.tsx
git commit -m "feat: TEL-24 canvas: modale branch (double-clic), source_handle, reconciliation"
```

---

## Task 8: Vérification globale

**Files:** aucun (validation).

- [ ] **Step 1: Backend test suite**

Run: `cd backend && rm -f tellana.db && python -m pytest`
Expected: tous les tests PASS.

- [ ] **Step 2: Frontend test suite**

Run: `cd frontend && npm test`
Expected: tous les tests PASS (BranchOverlay, GraphPlayer, BranchSettingsModal inclus).

- [ ] **Step 3: Player bundle build**

Run: `cd frontend && npm run build:player`
Expected: build OK (le standalone lit `data/graph.json` avec `source_handle`).

- [ ] **Step 4: Manual smoke test (canvas + player)**

Backend `uvicorn main:app --reload` + frontend `npm run dev`, puis :
1. Ouvrir `/stories/{id}/canvas` → clic droit → « Embranchement » : le nœud s'appelle « Embranchement 1 », 2 handles « Choix 1 » / « Choix 2 ».
2. Créer un 2e embranchement → « Embranchement 2 ».
3. Double-clic sur l'embranchement → la modale s'ouvre ; ajouter un 3e choix, renommer, réordonner, décocher show_visited, Enregistrer.
4. Le nœud affiche 3 handles avec les nouveaux labels.
5. Tirer un lien depuis chaque handle vers une scène/fin.
6. Recharger la page → les liens restent attachés aux bons handles.
7. Supprimer un choix dans la modale → le lien associé disparaît.
8. « Tester » → le player affiche les labels distincts (plus de « Choix 1 » partout) ; un choix non raccordé s'affiche mais le clic ne fait rien ; les choix visités sont grisés si show_visited.

- [ ] **Step 5: Final commit (si ajustements manuels)**

```bash
git add -A
git commit -m "test: TEL-24 vérification modale embranchement"
```

---

## Self-Review notes

- **Couverture spec** : colonne `source_handle` (T1), types (T2), BranchOverlay options (T3), GraphPlayer mapping + choix non raccordés inertes (T4), modale 2-5/ordre/show_visited/label défaut (T5), BranchNode sans rename inline + titre auto « Embranchement N » (T6/T7), `onConnect`/`toFlowEdge`/reconciliation (T7). ✓
- **Cohérence des noms** : `GraphChoice {id,label}`, `makeChoiceId`, `source_handle`, prop `options` `{label,edgeId,targetNodeId,visited}` identiques entre tâches. ✓
- **Décision d'implémentation** : `makeChoiceId` utilise un générateur local (pas `crypto.randomUUID`) pour fiabilité en jsdom et dans le bundle standalone — divergence assumée vs spec, sans impact fonctionnel.
