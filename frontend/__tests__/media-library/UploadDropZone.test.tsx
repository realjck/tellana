import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import UploadDropZone from "@/components/media-library/UploadDropZone";
import type { MediaLibraryConfig } from "@/types";

const mockMutate = jest.fn().mockResolvedValue(undefined);

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: {
    assets: {
      uploadMedia: jest.fn(),
    },
  },
  randomCharacterColor: () => "#FF6B6B",
}));

jest.mock("@/lib/assetBust", () => ({
  bustAssetCache: jest.fn(),
}));

import { api } from "@/lib/api";
import { bustAssetCache } from "@/lib/assetBust";
const mockUploadMedia = api.assets.uploadMedia as jest.Mock;
const mockBustAssetCache = bustAssetCache as jest.Mock;

const navConfig: MediaLibraryConfig = { mode: "navigation" };
const selectorConfig: MediaLibraryConfig = { mode: "selector", onSelect: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockMutate.mockResolvedValue(undefined);
  mockUploadMedia.mockResolvedValue({ ok: true, asset: { id: 1 } });
});

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("UploadDropZone", () => {
  it("rend la zone de drop en mode navigation", () => {
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    expect(screen.getByTestId("upload-drop-zone")).toBeInTheDocument();
    expect(screen.getByText(/déposer des fichiers/i)).toBeInTheDocument();
  });

  it("rend la zone de drop en mode selector", () => {
    render(<UploadDropZone folder="backgrounds" config={selectorConfig} />);
    expect(screen.getByTestId("upload-drop-zone")).toBeInTheDocument();
  });

  it("rend la zone de drop en mode folder-selector", () => {
    render(<UploadDropZone folder="characters" config={{ mode: "folder-selector" }} />);
    expect(screen.getByTestId("upload-drop-zone")).toBeInTheDocument();
  });

  it("appelle uploadMedia et mutate après sélection de fichier", async () => {
    render(<UploadDropZone folder="characters/alice" config={navConfig} />);
    const file = new File(["x"], "portrait.png", { type: "image/png" });
    await act(async () => {
      selectFile(file);
    });
    expect(mockUploadMedia).toHaveBeenCalledWith(file, "characters/alice", false);
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"]);
    });
    expect(mockMutate).toHaveBeenCalledWith("asset-folders");
  });

  it("affiche ConfirmModal après réponse 409 avec le message incluant characters", async () => {
    mockUploadMedia.mockResolvedValueOnce({
      ok: false,
      status: 409,
      existing_id: 5,
      references: { scenes: 2, nodes: 1, characters: 3 },
    });
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    const file = new File(["x"], "portrait.png", { type: "image/png" });
    await act(async () => {
      selectFile(file);
    });
    await waitFor(() => {
      expect(screen.getByText(/Ce fichier remplacera "portrait\.png"/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2 scène\(s\), 1 nœud\(s\) et 3 personnage\(s\)/)).toBeInTheDocument();
  });

  it("affiche le bouton 'Remplacer' (pas 'Supprimer') dans le ConfirmModal", async () => {
    mockUploadMedia.mockResolvedValueOnce({
      ok: false,
      status: 409,
      existing_id: 5,
      references: { scenes: 0, nodes: 0, characters: 0 },
    });
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    const file = new File(["x"], "portrait.png", { type: "image/png" });
    await act(async () => { selectFile(file); });
    await waitFor(() => screen.getByText("Remplacer"));
    expect(screen.getByText("Remplacer")).toBeInTheDocument();
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();
  });

  it("confirme le remplacement : uploadMedia appelé avec replace=true, bustAssetCache appelé", async () => {
    mockUploadMedia
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        existing_id: 5,
        references: { scenes: 1, nodes: 0, characters: 0 },
      })
      .mockResolvedValueOnce({ ok: true, asset: { id: 5, url: "/uploads/backgrounds/photo.png" } });
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    const file = new File(["x"], "photo.png", { type: "image/png" });
    await act(async () => {
      selectFile(file);
    });
    await waitFor(() => screen.getByText("Remplacer"));
    await act(async () => {
      fireEvent.click(screen.getByText("Remplacer"));
    });
    await waitFor(() => {
      expect(mockUploadMedia).toHaveBeenNthCalledWith(2, file, "backgrounds", true);
    });
    expect(mockMutate).toHaveBeenCalledWith(["assets", "backgrounds"]);
    expect(mockBustAssetCache).toHaveBeenCalled();
  });

  it("drop de fichier → uploadMedia et mutate appelés", async () => {
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    const file = new File(["x"], "bg.png", { type: "image/png" });
    const zone = screen.getByTestId("upload-drop-zone");
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    });
    expect(mockUploadMedia).toHaveBeenCalledWith(file, "backgrounds", false);
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(["assets", "backgrounds"]);
    });
    expect(mockMutate).toHaveBeenCalledWith("asset-folders");
  });

  it("annule le conflit : uploadMedia replace non appelé, modal fermé", async () => {
    mockUploadMedia.mockResolvedValueOnce({
      ok: false,
      status: 409,
      existing_id: 5,
      references: { scenes: 0, nodes: 0, characters: 0 },
    });
    render(<UploadDropZone folder="backgrounds" config={navConfig} />);
    const file = new File(["x"], "audio.mp3", { type: "audio/mpeg" });
    await act(async () => {
      selectFile(file);
    });
    await waitFor(() => screen.getByText("Annuler"));
    await act(async () => {
      fireEvent.click(screen.getByText("Annuler"));
    });
    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText(/Ce fichier remplacera/)).not.toBeInTheDocument();
    });
  });
});
