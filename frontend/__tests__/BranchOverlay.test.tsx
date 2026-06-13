import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchOverlay from "@/components/BranchOverlay";
import type { GraphEdge } from "@/types";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveAsset: () => "",
  randomCharacterColor: () => "#FF6B6B",
}));

const makeEdge = (id: number, label: string | null, order: number, targetId = id + 10): GraphEdge => ({
  id,
  story_id: 1,
  source_node_id: 1,
  target_node_id: targetId,
  label,
  order,
});

describe("BranchOverlay", () => {
  it("affiche les boutons de choix", () => {
    const edges = [makeEdge(1, "Option A", 0), makeEdge(2, "Option B", 1)];
    render(<BranchOverlay edges={edges} visitedEdgeIds={[]} onChoice={() => {}} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("affiche un label par défaut quand label est null", () => {
    const edges = [makeEdge(1, null, 0)];
    render(<BranchOverlay edges={edges} visitedEdgeIds={[]} onChoice={() => {}} />);
    expect(screen.getByText("Choix 1")).toBeInTheDocument();
  });

  it("appelle onChoice avec edgeId et targetNodeId au clic", () => {
    const onChoice = jest.fn();
    const edges = [makeEdge(5, "Aller voir", 0, 99)];
    render(<BranchOverlay edges={edges} visitedEdgeIds={[]} onChoice={onChoice} />);
    fireEvent.click(screen.getByText("Aller voir"));
    expect(onChoice).toHaveBeenCalledWith(5, 99);
  });

  it("applique la classe visited sur les edges déjà visitées", () => {
    const edges = [makeEdge(1, "Chemin A", 0), makeEdge(2, "Chemin B", 1)];
    render(<BranchOverlay edges={edges} visitedEdgeIds={[1]} onChoice={() => {}} />);
    const btnA = screen.getByText("Chemin A").closest("button");
    const btnB = screen.getByText("Chemin B").closest("button");
    expect(btnA?.className).toContain("player-branch-option-visited");
    expect(btnB?.className).not.toContain("player-branch-option-visited");
  });

  it("n'applique pas la classe visited quand visitedEdgeIds est vide", () => {
    const edges = [makeEdge(1, "Option", 0)];
    render(<BranchOverlay edges={edges} visitedEdgeIds={[]} onChoice={() => {}} />);
    const btn = screen.getByText("Option").closest("button");
    expect(btn?.className).not.toContain("player-branch-option-visited");
  });
});
