import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CharacterManager from "@/components/CharacterManager";
import type { AssetRef, Character } from "@/types";

jest.mock("@/lib/api", () => ({
  api: {
    characters: {
      create: jest.fn().mockResolvedValue({
        id: 99,
        story_id: 1,
        name: "Nouveau",
        sprites: { default: { type: "upload", url: "/uploads/characters/alice/default.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null } },
      }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
  randomCharacterColor: () => "#FF6B6B",
  resolveAsset: (ref: string | AssetRef | null | undefined) => {
    if (!ref) return "";
    if (typeof ref === "string") return ref;
    return ref.url ?? "";
  },
}));

jest.mock("@/components/media-library/MediaLibraryModal", () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="media-library-modal" /> : null,
}));

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

describe("CharacterManager — liste", () => {
  it("affiche les personnages existants", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("affiche le bouton Ajouter quand < 4 personnages", () => {
    render(<CharacterManager storyId={1} characters={[]} onRefresh={jest.fn()} />);
    expect(screen.getByText("Ajouter un personnage")).toBeInTheDocument();
  });

  it("affiche toujours le bouton Ajouter même avec 4 personnages ou plus", () => {
    const chars = [1, 2, 3, 4].map((i) => makeChar({ id: i, name: `Perso ${i}` }));
    render(<CharacterManager storyId={1} characters={chars} onRefresh={jest.fn()} />);
    expect(screen.getByText("Ajouter un personnage")).toBeInTheDocument();
  });
});

describe("CharacterManager — mode édition", () => {
  it("passe en mode édition au clic sur un personnage", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getByText("Modifier le personnage")).toBeInTheDocument();
  });

  it("affiche le nom du personnage dans le formulaire", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("le bouton Retour revient à la liste", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByText("Retour"));
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

describe("CharacterManager — sélecteur médiathèque", () => {
  it("affiche le bouton médiathèque en mode édition", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));
    expect(screen.getAllByText(/médiathèque/i).length).toBeGreaterThan(0);
  });

  it("ouvre la modale médiathèque au clic sur le bouton", () => {
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByText("Changer depuis la médiathèque"));
    expect(screen.getByTestId("media-library-modal")).toBeInTheDocument();
  });
});
