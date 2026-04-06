import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NodeForm from "@/components/NodeForm";
import type { StoryNode } from "@/types";

const dialogueNode: StoryNode = {
  id: 1,
  story_id: 1,
  order: 0,
  type: "dialogue",
  data: { character_id: null, text: "Texte initial" } as StoryNode["data"],
};

const quizNode: StoryNode = {
  id: 2,
  story_id: 1,
  order: 1,
  type: "quiz",
  data: {
    question: "Ma question",
    type: "qcu",
    feedback: "Mon feedback",
    options: [
      { text: "Option A", is_correct: true },
      { text: "Option B", is_correct: false },
    ],
  } as StoryNode["data"],
};

describe("NodeForm — comportement général", () => {
  it("affiche le texte du nœud existant", () => {
    render(
      <NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />
    );
    expect(screen.getByDisplayValue("Texte initial")).toBeInTheDocument();
  });

  it("appelle onSave avec les données modifiées", () => {
    const onSave = jest.fn();
    render(<NodeForm node={dialogueNode} characters={[]} onSave={onSave} onDelete={jest.fn()} />);
    const textarea = screen.getByDisplayValue("Texte initial");
    fireEvent.change(textarea, { target: { value: "Nouveau texte" } });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: "Nouveau texte" }) })
    );
  });

  it("appelle onDelete au clic sur Supprimer", () => {
    const onDelete = jest.fn();
    render(<NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("NodeForm — changement de type", () => {
  it("changer de type réinitialise les champs", () => {
    render(
      <NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />
    );
    // Switch to quiz
    fireEvent.click(screen.getByText("Quiz"));
    expect(screen.getByPlaceholderText("Posez votre question...")).toBeInTheDocument();
  });

  it("revenir au type d'origine restaure les données sauvegardées", () => {
    render(
      <NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />
    );
    // Switch away then back
    fireEvent.click(screen.getByText("Quiz"));
    fireEvent.click(screen.getByText("Dialogue"));
    expect(screen.getByDisplayValue("Texte initial")).toBeInTheDocument();
  });
});

describe("NodeForm — quiz", () => {
  it("affiche les champs du quiz", () => {
    render(<NodeForm node={quizNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByDisplayValue("Ma question")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
  });

  it("peut ajouter une réponse", () => {
    render(<NodeForm node={quizNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />);
    const before = screen.getAllByPlaceholderText(/Réponse \d+/).length;
    fireEvent.click(screen.getByText("+ Ajouter une réponse"));
    expect(screen.getAllByPlaceholderText(/Réponse \d+/).length).toBe(before + 1);
  });
});
