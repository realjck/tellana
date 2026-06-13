import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GraphPlayer from "@/components/GraphPlayer";
import type { GraphNode, GraphEdge, GraphResponse, PublicStory } from "@/types";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveAsset: () => "",
  resolveImage: () => "",
  randomCharacterColor: () => "#FF6B6B",
}));

jest.mock("@/components/ScenePlayer", () => ({
  __esModule: true,
  default: ({ onEnd }: { onEnd?: () => void }) => (
    <div data-testid="scene-player">
      <button onClick={onEnd}>Fin scène</button>
    </div>
  ),
}));

jest.mock("@/components/ScenePreviewThumbnail", () => ({
  __esModule: true,
  default: () => <div data-testid="scene-preview" />,
}));

const makeNode = (id: number, type: GraphNode["type"], data: object = {}): GraphNode => ({
  id, story_id: 1, type, position_x: 0, position_y: 0,
  data, created_at: "", updated_at: "",
});

const makeEdge = (id: number, src: number, tgt: number, label: string | null = null, order = 0, source_handle: string | null = null): GraphEdge => ({
  id, story_id: 1, source_node_id: src, target_node_id: tgt, label, order, source_handle,
});

const mockStory: PublicStory = {
  id: 1, title: "Test Story", slug: "test", published: true,
  created_at: "", updated_at: "",
  scenes: [{
    id: 10, story_id: 1, title: "Scène 1", order: 0,
    background_asset: null, background_loop: false,
    character_ids: [], character_positions: {},
    nodes: [], bg_custom_uploads: [],
    created_at: "", updated_at: "",
  }],
  characters: [],
};

const START = makeNode(1, "start");
const SCENE = makeNode(2, "scene", { scene_id: 10, title: "Scène 1" });
const BRANCH = makeNode(3, "branch", { title: null, show_visited: true, choices: [{ id: "c1", label: "Choix A" }] });
const END = makeNode(4, "end", { type: "good", title: "Bravo", text: "Fin de la story" });

describe("GraphPlayer", () => {
  beforeEach(() => localStorage.clear());

  it("affiche un message quand il n'y a pas de nœud start", () => {
    render(<GraphPlayer story={mockStory} graph={{ nodes: [], edges: [] }} storyId={1} />);
    expect(screen.getByText(/Aucun point de départ/)).toBeInTheDocument();
  });

  it("avance automatiquement depuis start vers le premier nœud", () => {
    const graph: GraphResponse = {
      nodes: [START, SCENE],
      edges: [makeEdge(1, 1, 2)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    expect(screen.getByTestId("scene-player")).toBeInTheDocument();
  });

  it("affiche la modale de reprise quand un bookmark existe", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 2, visitedEdgeIds: [1] }));
    const graph: GraphResponse = { nodes: [START, SCENE], edges: [makeEdge(1, 1, 2)] };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    expect(screen.getByText("Reprendre")).toBeInTheDocument();
    expect(screen.getByText("Recommencer au début")).toBeInTheDocument();
  });

  it("ne montre pas la modale de reprise sans bookmark", () => {
    const graph: GraphResponse = { nodes: [START, SCENE], edges: [makeEdge(1, 1, 2)] };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    expect(screen.queryByText("Reprendre")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-player")).toBeInTheDocument();
  });

  it("affiche l'écran de fin après reprise vers un nœud end", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 4, visitedEdgeIds: [] }));
    const graph: GraphResponse = { nodes: [START, END], edges: [] };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Fin de la story")).toBeInTheDocument();
    expect(screen.getByText("Recommencer")).toBeInTheDocument();
  });

  it("affiche BranchOverlay pour un nœud branch après reprise", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 3, visitedEdgeIds: [] }));
    const graph: GraphResponse = {
      nodes: [START, BRANCH, END],
      edges: [makeEdge(10, 3, 4, null, 0, "c1")],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByText("Choix A")).toBeInTheDocument();
  });

  it("affiche un choix non raccordé sans cible (après reprise)", () => {
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
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByText("Relié")).toBeInTheDocument();
    expect(screen.getByText("Orphelin")).toBeInTheDocument();
  });

  it("sauvegarde la progression dans localStorage après auto-avance depuis start", () => {
    const graph: GraphResponse = {
      nodes: [START, SCENE],
      edges: [makeEdge(1, 1, 2)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    const saved = JSON.parse(localStorage.getItem("tellana_progress_1") ?? "{}");
    expect(saved.currentNodeId).toBe(2);
    expect(saved.visitedEdgeIds).toContain(1);
  });

  it("Reprendre restaure la progression sauvegardée", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 2, visitedEdgeIds: [1] }));
    const graph: GraphResponse = {
      nodes: [START, SCENE],
      edges: [makeEdge(1, 1, 2)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByTestId("scene-player")).toBeInTheDocument();
  });

  it("ignore la progression localStorage si le nœud n'existe plus", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 999, visitedEdgeIds: [] }));
    const graph: GraphResponse = {
      nodes: [START, SCENE],
      edges: [makeEdge(1, 1, 2)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    // Bookmark invalide → pas de modale → auto-avance vers la scène
    expect(screen.queryByText("Reprendre")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-player")).toBeInTheDocument();
  });

  it("affiche 'Scène manquante' quand la scène DB est introuvable (après reprise)", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 2, visitedEdgeIds: [] }));
    const storyWithoutScene: PublicStory = { ...mockStory, scenes: [] };
    const graph: GraphResponse = { nodes: [START, SCENE], edges: [] };
    render(<GraphPlayer story={storyWithoutScene} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Reprendre"));
    expect(screen.getByText(/Scène manquante/)).toBeInTheDocument();
  });

  it("passe au nœud suivant après la fin d'une scène", () => {
    const graph: GraphResponse = {
      nodes: [START, SCENE, END],
      edges: [makeEdge(1, 1, 2), makeEdge(2, 2, 4)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    // Auto-advance to scene, then click "Fin scène"
    fireEvent.click(screen.getByText("Fin scène"));
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("efface le bookmark quand une fin est atteinte", () => {
    const graph: GraphResponse = {
      nodes: [START, SCENE, END],
      edges: [makeEdge(1, 1, 2), makeEdge(2, 2, 4)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Fin scène"));
    expect(localStorage.getItem("tellana_progress_1")).toBeNull();
  });

  it("affiche un écran de fin et efface le bookmark pour une scène sans sortie", () => {
    // SCENE (id 2) n'a aucun edge sortant → fin de l'histoire à la fin de la scène
    const graph: GraphResponse = { nodes: [START, SCENE], edges: [makeEdge(1, 1, 2)] };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Fin scène"));
    expect(screen.getByText("Fin")).toBeInTheDocument();
    expect(screen.getByText("Recommencer")).toBeInTheDocument();
    expect(localStorage.getItem("tellana_progress_1")).toBeNull();
  });

  it("Recommencer depuis une fin de scène repart du début", () => {
    const graph: GraphResponse = { nodes: [START, SCENE], edges: [makeEdge(1, 1, 2)] };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Fin scène"));
    fireEvent.click(screen.getByText("Recommencer"));
    expect(screen.getByTestId("scene-player")).toBeInTheDocument();
  });

  it("Recommencer au début efface la progression et repart du start", () => {
    localStorage.setItem("tellana_progress_1", JSON.stringify({ currentNodeId: 4, visitedEdgeIds: [1, 2] }));
    const graph: GraphResponse = {
      nodes: [START, SCENE, END],
      edges: [makeEdge(1, 1, 2), makeEdge(2, 2, 4)],
    };
    render(<GraphPlayer story={mockStory} graph={graph} storyId={1} />);
    fireEvent.click(screen.getByText("Recommencer au début"));
    // Repart du start → auto-avance vers la scène, seule l'edge 1 (start→scene) visitée
    const saved = JSON.parse(localStorage.getItem("tellana_progress_1") ?? "{}");
    expect(saved.visitedEdgeIds).toEqual([1]);
    expect(saved.visitedEdgeIds).not.toContain(2);
  });
});
