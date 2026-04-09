import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ScenePlayer from "@/components/ScenePlayer";
import type { AssetRef, StoryNode, Character } from "@/types";

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  resolveImage: (url: string | null | undefined) => url ?? "",
  resolveAsset: (ref: string | AssetRef | null | undefined) => {
    if (!ref) return "";
    if (typeof ref === "string") return ref;
    return ref.url ?? "";
  },
}));

const makeNode = (overrides: Partial<StoryNode> = {}): StoryNode => ({
  id: 1,
  scene_id: 1,
  order: 0,
  type: "dialogue",
  data: { character_id: null, text: "Bonjour" } as StoryNode["data"],
  ...overrides,
});

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  story_id: 1,
  name: "Alice",
  sprites: {
    default: {
      type: "local",
      url: "/sprite_woman.png",
      opfs_key: null,
      job_id: null,
      mime_type: null,
      width: null,
      height: null,
    },
  },
  ...overrides,
});

describe("ScenePlayer — navigation", () => {
  it("affiche le texte du premier nœud", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Hello" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("avance au nœud suivant au clic", () => {
    const nodes = [
      makeNode({ id: 1, order: 0, data: { character_id: null, text: "Nœud 1" } as StoryNode["data"] }),
      makeNode({ id: 2, order: 1, data: { character_id: null, text: "Nœud 2" } as StoryNode["data"] }),
    ];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} />);
    expect(screen.getByText("Nœud 1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Nœud 1"));
    expect(screen.getByText("Nœud 2")).toBeInTheDocument();
  });

  it("affiche l'écran de fin après le dernier nœud", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Dernier" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} />);
    fireEvent.click(screen.getByText("Dernier"));
    expect(screen.getByText("Recommencer")).toBeInTheDocument();
  });

  it("le bouton Recommencer remet l'index à 0", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Premier" } as StoryNode["data"] })];
    render(<ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} />);
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
      <ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} onIndexChange={onIndexChange} />
    );
    expect(onIndexChange).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByText("A"));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});

describe("ScenePlayer — showMode", () => {
  it("characters-only : la bulle dialogue n'est pas rendue", () => {
    const nodes = [makeNode({ data: { character_id: null, text: "Bulle cachée" } as StoryNode["data"] })];
    render(
      <ScenePlayer nodes={nodes} characters={[]} backgroundAsset={null} showMode="characters-only" />
    );
    expect(screen.queryByText("Bulle cachée")).not.toBeInTheDocument();
  });

  it("characters-only : les personnages sont affichés", () => {
    const nodes = [makeNode()];
    const characters = [makeChar({ name: "Alice" })];
    render(
      <ScenePlayer nodes={nodes} characters={characters} backgroundAsset={null} showMode="characters-only" />
    );
    expect(screen.getByAltText("Alice")).toBeInTheDocument();
  });

  it("background-only : les personnages ne sont pas rendus", () => {
    const nodes = [makeNode()];
    const characters = [makeChar({ name: "Alice" })];
    render(
      <ScenePlayer nodes={nodes} characters={characters} backgroundAsset={null} showMode="background-only" />
    );
    expect(screen.queryByAltText("Alice")).not.toBeInTheDocument();
  });
});

describe("ScenePlayer — positionnement personnages", () => {
  // DEFAULT_POSITIONS: slot 0 → x=-0.35 → left=32.5%, slot 1 → x=0.35 → left=67.5%
  it("1 personnage en dialogue : left=32.5% (slot 0)", () => {
    const nodes = [makeNode({ type: "dialogue", data: { character_id: 1, text: "Hi" } as StoryNode["data"] })];
    const characters = [makeChar({ id: 1 })];
    render(<ScenePlayer nodes={nodes} characters={characters} backgroundAsset={null} />);
    const img = screen.getByAltText("Alice");
    expect(img).toHaveStyle({ left: "32.5%" });
  });

  it("2 personnages : char[0] left=32.5% (slot 0), char[1] left=67.5% (slot 1)", () => {
    const nodes = [makeNode({ type: "dialogue", data: { character_id: 1, text: "Hi" } as StoryNode["data"] })];
    const characters = [
      makeChar({ id: 1, name: "Alice" }),
      makeChar({ id: 2, name: "Bob" }),
    ];
    render(<ScenePlayer nodes={nodes} characters={characters} backgroundAsset={null} />);
    expect(screen.getByAltText("Alice")).toHaveStyle({ left: "32.5%" });
    expect(screen.getByAltText("Bob")).toHaveStyle({ left: "67.5%" });
  });
});

describe("ScenePlayer — expressions (sprite_keys)", () => {
  it("utilise le sprite de la pose spécifiée pour le personnage", () => {
    const happyRef: AssetRef = {
      type: "local",
      url: "/sprites/alice_question.png",
      opfs_key: null,
      job_id: null,
      mime_type: null,
      width: null,
      height: null,
    };
    const char = makeChar({
      id: 1,
      sprites: {
        default: { type: "local", url: "/sprite_woman.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null },
        question: happyRef,
      },
    });
    const node = makeNode({
      type: "dialogue",
      data: { character_id: 1, text: "Bonjour", sprite_keys: { "1": "question" } } as StoryNode["data"],
    });
    render(<ScenePlayer nodes={[node]} characters={[char]} backgroundAsset={null} />);
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img.src).toContain("alice_question.png");
  });

  it("utilise le sprite par défaut si aucune pose n'est définie pour le personnage", () => {
    const char = makeChar({ id: 1 });
    const node = makeNode({
      type: "dialogue",
      data: { character_id: 1, text: "Bonjour" } as StoryNode["data"],
    });
    render(<ScenePlayer nodes={[node]} characters={[char]} backgroundAsset={null} />);
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img.src).toContain("sprite_woman.png");
  });

  it("utilise le sprite par défaut si la clé de pose est introuvable (pose supprimée)", () => {
    const char = makeChar({ id: 1 });
    const node = makeNode({
      type: "dialogue",
      data: { character_id: 1, text: "Bonjour", sprite_keys: { "1": "missing_pose" } } as StoryNode["data"],
    });
    render(<ScenePlayer nodes={[node]} characters={[char]} backgroundAsset={null} />);
    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img.src).toContain("sprite_woman.png");
  });
});

describe("ScenePlayer — quiz masquage des personnages", () => {
  it("masque les personnages sur un nœud quiz", () => {
    const quizNode = makeNode({
      type: "quiz",
      data: {
        question: "Question ?",
        type: "qcu",
        feedback: "",
        options: [{ text: "A", is_correct: true }],
      } as StoryNode["data"],
    });
    render(<ScenePlayer nodes={[quizNode]} characters={[makeChar({ name: "Alice" })]} backgroundAsset={null} />);
    expect(screen.queryByAltText("Alice")).not.toBeInTheDocument();
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
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundAsset={null} />);
    expect(screen.getByText("Quelle est la réponse ?")).toBeInTheDocument();
    expect(screen.getByText("Bonne réponse")).toBeInTheDocument();
    expect(screen.getByText("Mauvaise réponse")).toBeInTheDocument();
  });

  it("le bouton Valider est désactivé si rien n'est sélectionné", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundAsset={null} />);
    expect(screen.getByText("Valider")).toBeDisabled();
  });

  it("affiche le feedback après validation", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundAsset={null} />);
    fireEvent.click(screen.getByText("Bonne réponse"));
    fireEvent.click(screen.getByText("Valider"));
    expect(screen.getByText("Bravo !")).toBeInTheDocument();
  });

  it("QCU : sélectionner une option remplace la précédente", () => {
    render(<ScenePlayer nodes={[quizNode]} characters={[]} backgroundAsset={null} />);
    fireEvent.click(screen.getByText("Bonne réponse"));
    fireEvent.click(screen.getByText("Mauvaise réponse"));
    expect(screen.getByText("Valider")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Valider"));
    expect(screen.getByText("Bravo !")).toBeInTheDocument();
  });
});
