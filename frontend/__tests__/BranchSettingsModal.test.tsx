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
    fireEvent.click(screen.getAllByTitle("Descendre")[0]);
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

  it("conserve show_visited à false quand décoché au départ", () => {
    const onSave = jest.fn();
    render(<BranchSettingsModal initial={{ ...initial, show_visited: false }} onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave.mock.calls[0][0].show_visited).toBe(false);
  });

  it("ne se ferme pas au clic sur le fond", () => {
    const onCancel = jest.fn();
    const { container } = render(<BranchSettingsModal initial={initial} onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(container.firstChild as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
