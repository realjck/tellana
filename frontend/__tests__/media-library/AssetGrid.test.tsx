import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import AssetGrid from "@/components/media-library/AssetGrid";
import type { MediaLibraryConfig, Asset } from "@/types";

const mockMutate = jest.fn();

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock("@/components/media-library/UploadDropZone", () => ({
  __esModule: true,
  default: ({ folder }: { folder: string }) => (
    <div data-testid="upload-drop-zone">{folder}</div>
  ),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: {
    assets: {
      list: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
    },
  },
  resolveAsset: (url: string) => `http://localhost:8000${url}`,
  randomCharacterColor: () => "#FF6B6B",
}));

import useSWR from "swr";
import { api } from "@/lib/api";
const mockUseSWR = useSWR as jest.Mock;
const mockRename = api.assets.rename as jest.Mock;
const mockDelete = api.assets.delete as jest.Mock;

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 1,
  filename: "portrait.png",
  url: "/uploads/characters/alice/portrait.png",
  content_type: "image/png",
  folder: "characters/alice",
  is_seed: false,
  ...overrides,
});

const navConfig: MediaLibraryConfig = { mode: "navigation" };
const selectorConfig: MediaLibraryConfig = {
  mode: "selector",
  filter: "images",
  onSelect: jest.fn(),
};
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: [] });
  mockMutate.mockResolvedValue(undefined);
  mockRename.mockResolvedValue({
    id: 1,
    filename: "nouveau.png",
    url: "/uploads/characters/alice/nouveau.png",
    content_type: "image/png",
    folder: "characters/alice",
    is_seed: false,
  });
  mockDelete.mockResolvedValue(undefined);
});

describe("AssetGrid", () => {
  it("affiche message si pas de dossier sélectionné", () => {
    render(<AssetGrid config={navConfig} folder={null} onClose={onClose} />);
    expect(screen.getByText("Sélectionnez un dossier")).toBeInTheDocument();
  });

  it("filtre les assets .keep et affiche les vrais assets", () => {
    mockUseSWR.mockReturnValue({
      data: [
        makeAsset({ id: 1, filename: ".keep" }),
        makeAsset({ id: 2, filename: "portrait.png" }),
      ],
    });
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.queryByTitle(".keep")).not.toBeInTheDocument();
    expect(screen.getByTitle("portrait.png")).toBeInTheDocument();
  });

  it("affiche badge seed sur asset is_seed=true", () => {
    mockUseSWR.mockReturnValue({
      data: [makeAsset({ is_seed: true })],
    });
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.getByText("seed")).toBeInTheDocument();
  });

  it("en mode selector, clic appelle onSelect et onClose", () => {
    const asset = makeAsset();
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(
      <AssetGrid config={selectorConfig} folder="characters/alice" onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId("asset-card"));
    expect(selectorConfig.onSelect).toHaveBeenCalledWith(asset);
    expect(onClose).toHaveBeenCalled();
  });

  it("en mode selector + filter images, les assets non-image sont exclus", () => {
    mockUseSWR.mockReturnValue({
      data: [
        makeAsset({ id: 1, filename: "portrait.png", content_type: "image/png" }),
        makeAsset({ id: 2, filename: "theme.mp3", content_type: "audio/mpeg" }),
      ],
    });
    render(
      <AssetGrid config={selectorConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.getByTitle("portrait.png")).toBeInTheDocument();
    expect(screen.queryByTitle("theme.mp3")).not.toBeInTheDocument();
  });

  it("img src utilise resolveAsset (préfixe API_BASE)", () => {
    mockUseSWR.mockReturnValue({ data: [makeAsset()] });
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:8000/uploads/characters/alice/portrait.png"
    );
  });

  // ── Story 2.4 — Rename inline ────────────────────────────────────────────

  it("double-clic sur nom en mode navigation affiche un input pré-rempli", () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    const nameEl = screen.getByTitle("portrait.png");
    fireEvent.dblClick(nameEl);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("portrait.png");
  });

  it("blur sur input appelle api.assets.rename et mutate pair", async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.dblClick(screen.getByTitle("portrait.png"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "nouveau.png" } });
    await act(async () => { fireEvent.blur(input); });
    expect(mockRename).toHaveBeenCalledWith(asset.id, "nouveau.png");
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"])
    );
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith("asset-folders")
    );
  });

  it("Entrée sur input appelle api.assets.rename et mutate pair", async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.dblClick(screen.getByTitle("portrait.png"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new.png" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(mockRename).toHaveBeenCalledWith(asset.id, "new.png");
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"])
    );
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith("asset-folders")
    );
  });

  // ── Story 2.4 — Delete ───────────────────────────────────────────────────

  it("clic × en mode navigation affiche ConfirmModal", () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    const btn = screen.getByLabelText("Supprimer");
    fireEvent.click(btn);
    expect(screen.getByText(/Supprimer "portrait\.png"/)).toBeInTheDocument();
  });

  it('clic "Supprimer" dans ConfirmModal appelle api.assets.delete et mutate pair', async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Supprimer"));
    // "Supprimer" apparaît deux fois : bouton × (aria-label) + bouton ConfirmModal
    const buttons = screen.getAllByText("Supprimer");
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]); });
    expect(mockDelete).toHaveBeenCalledWith(asset.id);
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"])
    );
    expect(mockMutate).toHaveBeenCalledWith("asset-folders");
  });

  it('clic "Annuler" dans ConfirmModal ne supprime pas', async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockUseSWR.mockReturnValue({ data: [asset] });
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Supprimer"));
    await act(async () => { fireEvent.click(screen.getByText("Annuler")); });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
