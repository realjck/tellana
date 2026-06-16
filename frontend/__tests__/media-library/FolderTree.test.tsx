import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FolderTree from "@/components/media-library/FolderTree";
import type { MediaLibraryConfig } from "@/types";

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: { assets: { getFolders: jest.fn(), list: jest.fn() } },
  randomCharacterColor: () => "#FF6B6B",
}));

import useSWR from "swr";
const mockUseSWR = useSWR as jest.Mock;

const navConfig: MediaLibraryConfig = { mode: "navigation" };
const selectorConfig: MediaLibraryConfig = { mode: "selector" };
const folderSelectorConfig: MediaLibraryConfig = { mode: "folder-selector" };

beforeEach(() => {
  mockUseSWR.mockReturnValue({
    data: ["backgrounds", "characters", "characters/alice"],
    mutate: jest.fn(),
  });
});

describe("FolderTree — affichage hiérarchique", () => {
  it("affiche les dossiers racine", () => {
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={jest.fn()} />
    );
    expect(screen.getByText("backgrounds")).toBeInTheDocument();
    expect(screen.getByText("characters")).toBeInTheDocument();
  });

  it("affiche les sous-dossiers indentés sous leur parent", () => {
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={jest.fn()} />
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("appelle onSelectFolder avec le chemin complet au clic", () => {
    const onSelect = jest.fn();
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={onSelect} />
    );
    fireEvent.click(screen.getByText("backgrounds"));
    expect(onSelect).toHaveBeenCalledWith("backgrounds");
  });

  it("appelle onSelectFolder avec le chemin complet pour un sous-dossier", () => {
    const onSelect = jest.fn();
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={onSelect} />
    );
    fireEvent.click(screen.getByText("alice"));
    expect(onSelect).toHaveBeenCalledWith("characters/alice");
  });

  it("met en évidence le dossier sélectionné", () => {
    const { container } = render(
      <FolderTree
        config={navConfig}
        selectedFolder="backgrounds"
        onSelectFolder={jest.fn()}
      />
    );
    // Le dossier sélectionné doit avoir une classe distinctive
    const selected = container.querySelector("[data-selected='true']");
    expect(selected).toBeInTheDocument();
    expect(selected).toHaveTextContent("backgrounds");
  });
});

describe("FolderTree — filtrage allowedFolders", () => {
  it("n'affiche que les dossiers autorisés", () => {
    render(
      <FolderTree
        config={{ mode: "folder-selector", allowedFolders: ["characters"] }}
        selectedFolder={null}
        onSelectFolder={jest.fn()}
      />
    );
    expect(screen.queryByText("backgrounds")).not.toBeInTheDocument();
    expect(screen.getByText("characters")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });
});

describe("FolderTree — bouton Nouveau dossier", () => {
  it("affiche le bouton Nouveau dossier en mode navigation", () => {
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={jest.fn()} />
    );
    expect(screen.getByText(/nouveau dossier/i)).toBeInTheDocument();
  });

  it("affiche le bouton Nouveau dossier en mode selector", () => {
    render(
      <FolderTree config={selectorConfig} selectedFolder={null} onSelectFolder={jest.fn()} />
    );
    expect(screen.getByText(/nouveau dossier/i)).toBeInTheDocument();
  });

  it("affiche le bouton Nouveau dossier en mode folder-selector", () => {
    render(
      <FolderTree
        config={folderSelectorConfig}
        selectedFolder={null}
        onSelectFolder={jest.fn()}
      />
    );
    expect(screen.getByText(/nouveau dossier/i)).toBeInTheDocument();
  });
});

describe("FolderTree — liste vide", () => {
  it("affiche un état vide si aucun dossier n'existe", () => {
    mockUseSWR.mockReturnValue({ data: [], mutate: jest.fn() });
    render(
      <FolderTree config={navConfig} selectedFolder={null} onSelectFolder={jest.fn()} />
    );
    expect(screen.queryByText("backgrounds")).not.toBeInTheDocument();
    expect(screen.queryByText("characters")).not.toBeInTheDocument();
  });
});
