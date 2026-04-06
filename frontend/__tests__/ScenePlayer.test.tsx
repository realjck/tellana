import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ScenePlayer from "@/components/ScenePlayer";
import type { StoryNode, Character } from "@/types";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveImage: (url: string | null | undefined) => url ?? "",
}));

const makeNode = (overrides: Partial<StoryNode> = {}): StoryNode => ({
  id: 1,
  story_id: 1,
  order: 0,
  type: "dialogue",
  data: { character_id: null, text: "Bonjour" } as StoryNode["data"],
  ...overrides,
});

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  story_id: 1,
  name: "Alice",
  image_url: "/sprite_woman.png",
  position: "left",
  ...overrides,
});

describe("ScenePlayer — navigation", () => {
  it("affiche le texte du premier nœud", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Hello" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("avance au nœud suivant au clic", () => {
    const nodes = [
      makeNode({ id: 1, order: 0, data: { character_id: null, text: "Nœud 1" } as StoryNode["data"] }),
      makeNode({ id: 2, order: 1, data: { character_id: null, text: "Nœud 2" } as StoryNode["data"] }),
    ];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} />);
    expect(screen.getByText("Nœud 1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Nœud 1"));
    expect(screen.getByText("Nœud 2")).toBeInTheDocument();
  });

  it("affiche l'écran de fin après le dernier nœud", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Dernier" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} />);
    fireEvent.click(screen.getByText("Dernier"));
    expect(screen.getByText("Recommencer")).toBeInTheDocument();
  });

  it("le bouton Recommencer remet l'index à 0", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Premier" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} />);
    fireEvent.click(screen.getByText("Premier"));
    expect(screen.getByText("Recommencer")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Recommencer"));
    expect(screen.getByText("Premier")).toBeInTheDocument();
  });

  it("appelle onIndexChange avec le bon index à chaque avance", () => {
    const onIndexChange = jest.fn();
    const nodes = [
      makeNode({ id: 1, order: 0, data: { character_id: null, text: "A" } as StoryNode["data"] }),
      makeNode({ id: 2, order: 1, data: { character_id: null, text: "B" } as StoryNode["data"] }),
    ];
    render(
      <ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} onIndexChange={onIndexChange} />
    );
    // Initial call on mount (index=0)
    expect(onIndexChange).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByText("A"));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});

describe("ScenePlayer — showMode", () => {
  it("characters-only : la bulle dialogue n'est pas rendue", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Bulle cachée" } as StoryNode["data"] })];
    render(
      <ScenePlayer nodes={nodes} characters={[]} backgroundUrl={null} showMode="characters-only" />
    );
    expect(screen.queryByText("Bulle cachée")).not.toBeInTheDocument();
  });

  it("characters-only : les personnages sont affichés", () => {
    const nodes = [makeNode()];
    const characters = [makeChar({ name: "Alice" })];
    render(
      <ScenePlayer nodes={nodes} characters={characters} backgroundUrl={null} showMode="characters-only" />
    );
    expect(screen.getByAltText("Alice")).toBeInTheDocument();
  });

  it("background-only : les personnages ne sont pas rendus", () => {
    const nodes = [makeNode()];
    const characters = [makeChar({ name: "Alice" })];
    render(
      <ScenePlayer nodes={nodes} characters={characters} backgroundUrl={null} showMode="background-only" />
    );
    expect(screen.queryByAltText("Alice")).not.toBeInTheDocument();
  });
});

describe("ScenePlayer — positionnement personnages", () => {
  it("1 personnage en dialogue : left=36%", () => {
    const nodes = [makeNode({ type: "dialogue", data: { character_id: 1, text: "Hi" } as StoryNode["data"] })];
    const characters = [makeChar({ id: 1, position: "left" })];
    render(<ScenePlayer nodes={nodes} characters={characters} backgroundUrl={null} />);
    const img = screen.getByAltText("Alice");
    expect(img).toHaveStyle({ left: "36%" });
  });

  it("2 personnages en dialogue : left=16%, right=16%", () => {
    const nodes = [makeNode({ type: "dialogue", data: { character_id: 1, text: "Hi" } as StoryNode["data"] })];
    const characters = [
      makeChar({ id: 1, name: "Alice", position: "left" }),
      makeChar({ id: 2, name: "Bob", position: "right" }),
    ];
    render(<ScenePlayer nodes={nodes} characters={characters} backgroundUrl={null} />);
    expect(screen.getByAltText("Alice")).toHaveStyle({ left: "16%" });
    expect(screen.getByAltText("Bob")).toHaveStyle({ right: "16%" });
  });
});

describe("ScenePlayer — quiz", () => {
  const quizNode = makeNode({
    type: "quiz",
    data: {
      question: "Quelle est la réponse ?",
      type: "qcu",
      feedback: "Bravo !",
      options: [
        { text: "Bonne réponse", is_correct: true },
        { text: "Mauvaise réponse", is_correct: false },
      ],
    } as StoryNode["data"],
  });

  it("affiche la question et les options", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundUrl={null} />);
    expect(screen.getByText("Quelle est la réponse ?")).toBeInTheDocument();
    expect(screen.getByText("Bonne réponse")).toBeInTheDocument();
    expect(screen.getByText("Mauvaise réponse")).toBeInTheDocument();
  });

  it("le bouton Valider est désactivé si rien n'est sélectionné", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundUrl={null} />);
    expect(screen.getByText("Valider")).toBeDisabled();
  });

  it("affiche le feedback après validation", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundUrl={null} />);
    fireEvent.click(screen.getByText("Bonne réponse"));
    fireEvent.click(screen.getByText("Valider"));
    expect(screen.getByText("Bravo !")).toBeInTheDocument();
  });

  it("QCU : sélectionner une option remplace la précédente", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundUrl={null} />);
    fireEvent.click(screen.getByText("Bonne réponse"));
    fireEvent.click(screen.getByText("Mauvaise réponse"));
    // Valider should be enabled (something is selected)
    expect(screen.getByText("Valider")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Valider"));
    // Mauvaise réponse should be red (wrong), Bonne réponse should be green (correct)
    expect(screen.getByText("Bravo !")).toBeInTheDocument();
  });
});
