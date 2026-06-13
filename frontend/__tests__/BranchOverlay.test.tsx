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
