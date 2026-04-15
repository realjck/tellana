import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NodeForm from "@/components/NodeForm";
import type { AssetRef, Character, StoryNode } from "@/types";

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

const dialogueNode: StoryNode = {
  id: 1,
  scene_id: 1,
  order: 0,
  type: "dialogue",
  data: { character_id: null, text: "Texte initial" } as StoryNode["data"],
};

const quizNode: StoryNode = {
  id: 2,
  scene_id: 1,
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
    jest.useFakeTimers();
    render(<NodeForm node={dialogueNode} characters={[]} onSave={onSave} onDelete={jest.fn()} />);
    const textarea = screen.getByDisplayValue("Texte initial");
    fireEvent.change(textarea, { target: { value: "Nouveau texte" } });
    jest.runAllTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: "Nouveau texte" }) })
    );
    jest.useRealTimers();
  });

  it("appelle onDelete au clic sur Supprimer", () => {
    const onDelete = jest.fn();
    render(<NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("Supprimer ce nœud"));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe("NodeForm — expression picker", () => {
  const charWithPoses = makeChar({
    id: 1,
    name: "Alice",
    sprites: {
      default: { type: "local", url: "/sprite_woman.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null },
      question: { type: "local", url: "/sprites/alice_question.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null },
    },
  });

  it("affiche les badges de poses quand le personnage a des sprites", () => {
    render(
      <NodeForm node={dialogueNode} characters={[charWithPoses]} onSave={jest.fn()} onDelete={jest.fn()} />
    );
    expect(screen.getByText("défaut")).toBeInTheDocument();
    expect(screen.getByText("question")).toBeInTheDocument();
  });

  it("cliquer sur un badge appelle onSave avec sprite_keys", () => {
    const onSave = jest.fn();
    jest.useFakeTimers();
    render(
      <NodeForm node={dialogueNode} characters={[charWithPoses]} onSave={onSave} onDelete={jest.fn()} />
    );
    fireEvent.click(screen.getByText("question"));
    jest.runAllTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sprite_keys: { "1": "question" },
        }),
      })
    );
    jest.useRealTimers();
  });

  it("affiche un message si aucun personnage dans la scène", () => {
    render(
      <NodeForm node={dialogueNode} characters={[]} onSave={jest.fn()} onDelete={jest.fn()} />
    );
    expect(screen.getByText("Aucun personnage dans la scène.")).toBeInTheDocument();
  });

  it("désélectionne le personnage si on re-clique dessus", () => {
    const char = makeChar({ id: 1 });
    const node: StoryNode = {
      id: 1, scene_id: 1, order: 0, type: "dialogue",
      data: { character_id: 1, text: "Bonjour" } as StoryNode["data"],
    };
    const onSave = jest.fn();
    jest.useFakeTimers();
    render(
      <NodeForm node={node} characters={[char]} onSave={onSave} onDelete={jest.fn()} />
    );
    // Alice is already selected (character_id: 1). Click again to deselect.
    const aliceBlock = screen.getByText("Alice").closest("div[class*='rounded-md']") as HTMLElement;
    fireEvent.click(aliceBlock);
    jest.runAllTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ character_id: null }),
      })
    );
    jest.useRealTimers();
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
