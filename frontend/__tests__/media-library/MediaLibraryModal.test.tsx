import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";
import type { MediaLibraryConfig } from "@/types";

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ data: ["backgrounds", "characters"], mutate: jest.fn() }),
  mutate: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: { assets: { getFolders: jest.fn(), list: jest.fn() } },
  resolveAsset: (url: string) => `http://localhost:8000${url}`,
  randomCharacterColor: () => "#FF6B6B",
}));

jest.mock("@/components/media-library/AssetGrid", () => ({
  __esModule: true,
  default: ({ folder }: { folder: string | null }) => (
    <div data-testid="asset-grid">
      {folder ? `Dossier : ${folder}` : "Sélectionnez un dossier"}
    </div>
  ),
}));

const navConfig: MediaLibraryConfig = { mode: "navigation" };

describe("MediaLibraryModal — visibilité", () => {
  it("ne rend rien si isOpen=false", () => {
    const { container } = render(
      <MediaLibraryModal config={navConfig} isOpen={false} onClose={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("rend la modale si isOpen=true", () => {
    render(
      <MediaLibraryModal config={navConfig} isOpen={true} onClose={jest.fn()} />
    );
    expect(screen.getByText("Médiathèque")).toBeInTheDocument();
  });

  it("affiche FolderTree dans le panneau gauche", () => {
    render(
      <MediaLibraryModal config={navConfig} isOpen={true} onClose={jest.fn()} />
    );
    // FolderTree est rendu et les dossiers sont visibles
    expect(screen.getByText("backgrounds")).toBeInTheDocument();
    expect(screen.getByText("characters")).toBeInTheDocument();
  });
});

describe("MediaLibraryModal — fermeture", () => {
  it("appelle onClose au clic du bouton ×", () => {
    const onClose = jest.fn();
    render(
      <MediaLibraryModal config={navConfig} isOpen={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose sur la touche Escape", () => {
    const onClose = jest.fn();
    render(
      <MediaLibraryModal config={navConfig} isOpen={true} onClose={onClose} />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("MediaLibraryModal — mode folder-selector", () => {
  it("n'affiche pas de bouton de sélection dans le panneau gauche", () => {
    render(
      <MediaLibraryModal
        config={{ mode: "folder-selector", onSelectFolderWithSprites: jest.fn() }}
        isOpen={true}
        onClose={jest.fn()}
      />
    );
    // Le bouton est dans AssetGrid (non mocké ici), pas dans le panneau gauche
    expect(screen.queryByText(/sélectionner ce dossier/i)).not.toBeInTheDocument();
  });

  it("navigue dans un dossier et affiche AssetGrid", () => {
    render(
      <MediaLibraryModal
        config={{ mode: "folder-selector", onSelectFolderWithSprites: jest.fn() }}
        isOpen={true}
        onClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText("backgrounds"));
    expect(screen.getByText("Dossier : backgrounds")).toBeInTheDocument();
  });
});

describe("MediaLibraryModal — initialFolder", () => {
  it("présélectionne le dossier initial", () => {
    render(
      <MediaLibraryModal
        config={{ mode: "navigation", initialFolder: "characters" }}
        isOpen={true}
        onClose={jest.fn()}
      />
    );
    // Le placeholder droit affiche le dossier courant
    expect(screen.getByText(/dossier : characters/i)).toBeInTheDocument();
  });
});
