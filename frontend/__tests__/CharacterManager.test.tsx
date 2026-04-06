import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CharacterManager from "@/components/CharacterManager";
import type { Character } from "@/types";

const mockUploadUrl = "http://localhost:8000/uploads/custom.png";

jest.mock("@/lib/api", () => ({
  api: {
    characters: {
      create: jest.fn().mockResolvedValue({ id: 99, story_id: 1, name: "Nouveau", image_url: "/sprite_man.png", position: "left" }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    assets: {
      upload: jest.fn().mockResolvedValue("http://localhost:8000/uploads/custom.png"),
    },
  },
  DEFAULT_SPRITES: [
    { label: "Homme", url: "/sprite_man.png" },
    { label: "Femme", url: "/sprite_woman.png" },
  ],
  resolveImage: (url: string) => url,
}));

const makeChar = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  story_id: 1,
  name: "Alice",
  image_url: "/sprite_woman.png",
  position: "left",
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

  it("masque le bouton Ajouter à 4 personnages", () => {
    const chars = [1, 2, 3, 4].map((i) => makeChar({ id: i, name: `Perso ${i}` }));
    render(<CharacterManager storyId={1} characters={chars} onRefresh={jest.fn()} />);
    expect(screen.queryByText("Ajouter un personnage")).not.toBeInTheDocument();
    expect(screen.getByText("Maximum 4 personnages atteint")).toBeInTheDocument();
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

describe("CharacterManager — uploads custom", () => {
  it("l'upload conserve l'image dans customUploads même si on change de sprite", async () => {
    const { api } = require("@/lib/api");
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));

    // Simulate file upload
    const file = new File(["img"], "custom.png", { type: "image/png" });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.assets.upload).toHaveBeenCalled());

    // Select a default sprite to change the selection
    fireEvent.click(screen.getByTitle("Homme"));

    // Custom upload should still be visible
    const customImg = document.querySelector(`img[src="${mockUploadUrl}"]`);
    expect(customImg).toBeInTheDocument();
  });
});
