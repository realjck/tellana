import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CharacterManager from "@/components/CharacterManager";
import type { AssetRef, Character } from "@/types";

const mockUploadUrl = "/uploads/custom.png";
const mockUploadRef: AssetRef = {
  type: "upload",
  url: mockUploadUrl,
  opfs_key: null,
  job_id: null,
  mime_type: "image/png",
  width: null,
  height: null,
};

jest.mock("@/lib/api", () => ({
  api: {
    characters: {
      create: jest.fn().mockResolvedValue({
        id: 99,
        story_id: 1,
        name: "Nouveau",
        sprites: { default: { type: "local", url: "/sprite_man.png", opfs_key: null, job_id: null, mime_type: null, width: null, height: null } },
      }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    assets: {
      upload: jest.fn().mockResolvedValue({
        type: "upload",
        url: "/uploads/custom.png",
        opfs_key: null,
        job_id: null,
        mime_type: "image/png",
        width: null,
        height: null,
      }),
    },
  },
  DEFAULT_SPRITES: [
    { label: "Homme", url: "/sprite_man.png" },
    { label: "Femme", url: "/sprite_woman.png" },
  ],
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

describe("CharacterManager — uploads custom", () => {
  it("l'upload conserve l'image dans customUploads même si on change de sprite", async () => {
    const { api } = require("@/lib/api");
    render(
      <CharacterManager storyId={1} characters={[makeChar()]} onRefresh={jest.fn()} />
    );
    fireEvent.click(screen.getByText("Alice"));

    const file = new File(["img"], "custom.png", { type: "image/png" });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.assets.upload).toHaveBeenCalled());

    // Select a default sprite
    fireEvent.click(screen.getByTitle("Homme"));

    // Custom upload should still be visible
    const customImg = document.querySelector(`img[src="${mockUploadUrl}"]`);
    expect(customImg).toBeInTheDocument();
  });
});
