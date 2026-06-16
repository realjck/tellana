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
  default: ({ folder }: { folder: string; onReplaceSuccess?: (id: number) => void }) => (
    <div data-testid="upload-drop-zone">{folder}</div>
  ),
}));

jest.mock("@/components/media-library/ContextMenu", () => ({
  __esModule: true,
  default: ({
    items,
    onClose,
  }: {
    items: Array<{ label: string; onClick: () => void }>;
    onClose: () => void;
  }) => (
    <div data-testid="context-menu">
      {items.map((item) => (
        <button key={item.label} onClick={() => { item.onClick(); onClose(); }}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/lib/api", () => ({
  API_BASE: "http://localhost:8000",
  api: {
    assets: {
      list: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
      getFolders: jest.fn(),
      deleteFolder: jest.fn(),
      renameFolder: jest.fn(),
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
const mockDeleteFolder = api.assets.deleteFolder as jest.Mock;
const mockRenameFolder = api.assets.renameFolder as jest.Mock;

const makeAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 1,
  filename: "portrait.png",
  url: "/uploads/characters/alice/portrait.png",
  content_type: "image/png",
  folder: "characters/alice",
  is_seed: false,
  ...overrides,
});

/** Helper: mock both SWR calls in AssetGrid (assets + asset-folders). */
function mockSWR(assets: Asset[] = [], folders: string[] = []) {
  mockUseSWR.mockImplementation((key: unknown) => {
    if (key === "asset-folders") return { data: folders };
    return { data: assets };
  });
}

const navConfig: MediaLibraryConfig = { mode: "navigation" };
const selectorConfig: MediaLibraryConfig = {
  mode: "selector",
  filter: "images",
  onSelect: jest.fn(),
};
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockSWR();
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
  mockDeleteFolder.mockResolvedValue(undefined);
  mockRenameFolder.mockResolvedValue(undefined);
});

describe("AssetGrid", () => {
  it("affiche message si pas de dossier sélectionné", () => {
    render(<AssetGrid config={navConfig} folder={null} onClose={onClose} />);
    expect(screen.getByText("Sélectionnez un dossier")).toBeInTheDocument();
  });

  it("filtre les assets .keep et affiche les vrais assets", () => {
    mockSWR([
      makeAsset({ id: 1, filename: ".keep" }),
      makeAsset({ id: 2, filename: "portrait.png" }),
    ]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.queryByTitle(".keep")).not.toBeInTheDocument();
    expect(screen.getByTitle("portrait.png")).toBeInTheDocument();
  });

  it("affiche badge seed sur asset is_seed=true", () => {
    mockSWR([makeAsset({ is_seed: true })]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.getByText("seed")).toBeInTheDocument();
  });

  it("en mode selector, clic appelle onSelect et onClose", () => {
    const asset = makeAsset();
    mockSWR([asset]);
    render(
      <AssetGrid config={selectorConfig} folder="characters/alice" onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId("asset-card"));
    expect(selectorConfig.onSelect).toHaveBeenCalledWith(asset);
    expect(onClose).toHaveBeenCalled();
  });

  it("en mode selector + filter images, les assets non-image sont exclus", () => {
    mockSWR([
      makeAsset({ id: 1, filename: "portrait.png", content_type: "image/png" }),
      makeAsset({ id: 2, filename: "theme.mp3", content_type: "audio/mpeg" }),
    ]);
    render(
      <AssetGrid config={selectorConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.getByTitle("portrait.png")).toBeInTheDocument();
    expect(screen.queryByTitle("theme.mp3")).not.toBeInTheDocument();
  });

  it("img src utilise resolveAsset (préfixe API_BASE)", () => {
    mockSWR([makeAsset()]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "http://localhost:8000/uploads/characters/alice/portrait.png"
    );
  });

  // ── Sous-dossiers ────────────────────────────────────────────────────────

  it("affiche les sous-dossiers immédiats comme cards", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses", "characters/bob"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.getByTitle("poses")).toBeInTheDocument();
    expect(screen.queryByTitle("bob")).not.toBeInTheDocument();
  });

  it("clic sur un dossier appelle onNavigate", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    const onNavigate = jest.fn();
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} onNavigate={onNavigate} />
    );
    fireEvent.click(screen.getByTitle("poses").closest("div")!.parentElement!);
    expect(onNavigate).toHaveBeenCalledWith("characters/alice/poses");
  });

  // ── Story 4.2 — Menu contextuel fichiers ─────────────────────────────────

  it("clic droit sur un fichier affiche le menu contextuel", () => {
    mockSWR([makeAsset({ filename: "portrait.png" })]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByText("Renommer")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();
  });

  it("clic droit puis Renommer sur un fichier active l'input inline", () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("portrait.png");
  });

  it("blur sur input fichier appelle api.assets.rename et mutate pair", async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Renommer"));
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

  it("Entrée sur input fichier appelle api.assets.rename", async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "new.png" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(mockRename).toHaveBeenCalledWith(asset.id, "new.png");
  });

  it("clic droit puis Supprimer sur un fichier ouvre ConfirmModal", () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Supprimer"));
    expect(screen.getByText(/Supprimer "portrait\.png"/)).toBeInTheDocument();
  });

  it('confirmer suppression fichier appelle api.assets.delete et mutate pair', async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Supprimer"));
    // "Supprimer" apparaît dans ConfirmModal comme bouton de confirmation
    const buttons = screen.getAllByText("Supprimer");
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]); });
    expect(mockDelete).toHaveBeenCalledWith(asset.id);
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"])
    );
    expect(mockMutate).toHaveBeenCalledWith("asset-folders");
  });

  it('clic "Annuler" dans ConfirmModal fichier ne supprime pas', async () => {
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Supprimer"));
    await act(async () => { fireEvent.click(screen.getByText("Annuler")); });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("erreur 409 sur rename fichier affiche AlertModal", async () => {
    mockRename.mockRejectedValueOnce(new Error("Un asset porte déjà ce nom dans ce dossier"));
    const asset = makeAsset({ filename: "portrait.png" });
    mockSWR([asset]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    fireEvent.contextMenu(screen.getByTestId("asset-card"));
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "existant.png" } });
    await act(async () => { fireEvent.blur(input); });
    await waitFor(() =>
      expect(screen.getByText("Un fichier avec ce nom existe déjà dans ce dossier.")).toBeInTheDocument()
    );
  });

  it("pas de bouton × sur les fichiers", () => {
    mockSWR([makeAsset()]);
    render(<AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />);
    expect(screen.queryByLabelText("Supprimer")).not.toBeInTheDocument();
  });

  // ── Story 4.2 — Menu contextuel dossiers ─────────────────────────────────

  it("clic droit sur un dossier affiche le menu contextuel", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByText("Renommer")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();
  });

  it("clic droit puis Renommer sur dossier active l'input inline avec le nom courant", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("poses");
  });

  it("valider renommage dossier (Enter) appelle renameFolder et mutate", async () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "poses-v2" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(mockRenameFolder).toHaveBeenCalledWith(
      "characters/alice/poses",
      "characters/alice/poses-v2"
    );
    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith("asset-folders"));
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(["assets", "characters/alice"])
    );
  });

  it("erreur 409 sur renameFolder affiche AlertModal", async () => {
    mockRenameFolder.mockRejectedValueOnce(new Error("Le dossier cible existe déjà"));
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    fireEvent.click(screen.getByText("Renommer"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "existant" } });
    await act(async () => { fireEvent.blur(input); });
    await waitFor(() =>
      expect(screen.getByText("Un dossier avec ce nom existe déjà.")).toBeInTheDocument()
    );
  });

  it("clic droit puis Supprimer sur dossier ouvre ConfirmModal", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    fireEvent.click(screen.getByText("Supprimer"));
    expect(screen.getByText(/Supprimer le dossier "poses"/)).toBeInTheDocument();
  });

  it("confirmer suppression dossier appelle deleteFolder et mutate", async () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    const folderCard = screen.getByTitle("poses").closest("div")!.parentElement!;
    fireEvent.contextMenu(folderCard);
    fireEvent.click(screen.getByText("Supprimer"));
    const buttons = screen.getAllByText("Supprimer");
    await act(async () => { fireEvent.click(buttons[buttons.length - 1]); });
    expect(mockDeleteFolder).toHaveBeenCalledWith("characters/alice/poses");
    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith("asset-folders"));
  });

  it("pas de bouton × sur les dossiers", () => {
    mockSWR([], ["characters/alice", "characters/alice/poses"]);
    render(
      <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
    );
    expect(screen.queryByLabelText("Supprimer le dossier")).not.toBeInTheDocument();
  });

  // ── Story 4.1 — Bouton "Choisir ce dossier personnage" ───────────────────

  describe("mode folder-selector", () => {
    const onSelectFolderWithSprites = jest.fn();
    const folderSelectorConfig: MediaLibraryConfig = {
      mode: "folder-selector",
      onSelectFolderWithSprites,
    };

    beforeEach(() => { onSelectFolderWithSprites.mockReset(); });

    it("affiche le bouton quand dossier contient au moins une image", () => {
      mockSWR([makeAsset({ filename: "default.png", content_type: "image/png" })]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      expect(screen.getByText("Choisir ce dossier personnage")).toBeInTheDocument();
    });

    it("n'affiche pas le bouton en mode navigation", () => {
      mockSWR([makeAsset({ filename: "default.png", content_type: "image/png" })]);
      render(
        <AssetGrid config={navConfig} folder="characters/alice" onClose={onClose} />
      );
      expect(screen.queryByText("Choisir ce dossier personnage")).not.toBeInTheDocument();
    });

    it("n'affiche pas le bouton si le dossier ne contient que des non-images", () => {
      mockSWR([makeAsset({ filename: "theme.mp3", content_type: "audio/mpeg" })]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      expect(screen.queryByText("Choisir ce dossier personnage")).not.toBeInTheDocument();
    });

    it("n'affiche pas le bouton si le dossier est vide (hors .keep)", () => {
      mockSWR([makeAsset({ filename: ".keep", content_type: "application/x-empty" })]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      expect(screen.queryByText("Choisir ce dossier personnage")).not.toBeInTheDocument();
    });

    it("clic bouton appelle onSelectFolderWithSprites avec mapping correct et ferme modale", () => {
      mockSWR([
        makeAsset({ id: 1, filename: "default.png", url: "/uploads/characters/alice/default.png", content_type: "image/png" }),
        makeAsset({ id: 2, filename: "happy.png", url: "/uploads/characters/alice/happy.png", content_type: "image/png" }),
      ]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      fireEvent.click(screen.getByText("Choisir ce dossier personnage"));
      expect(onSelectFolderWithSprites).toHaveBeenCalledWith(
        "characters/alice",
        expect.objectContaining({
          default: expect.objectContaining({ url: "/uploads/characters/alice/default.png" }),
          happy: expect.objectContaining({ url: "/uploads/characters/alice/happy.png" }),
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it("sans default.*, première image devient la clé 'default'", () => {
      mockSWR([
        makeAsset({ id: 1, filename: "alice.png", url: "/uploads/characters/alice/alice.png", content_type: "image/png" }),
        makeAsset({ id: 2, filename: "happy.png", url: "/uploads/characters/alice/happy.png", content_type: "image/png" }),
      ]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      fireEvent.click(screen.getByText("Choisir ce dossier personnage"));
      const [, sprites] = onSelectFolderWithSprites.mock.calls[0];
      expect(sprites).toHaveProperty("default");
      expect(sprites["default"].url).toBe("/uploads/characters/alice/alice.png");
      expect(sprites).toHaveProperty("happy");
      expect(sprites).not.toHaveProperty("alice");
    });

    it("mapping ignore les fichiers non-image", () => {
      mockSWR([
        makeAsset({ id: 1, filename: "default.png", url: "/uploads/characters/alice/default.png", content_type: "image/png" }),
        makeAsset({ id: 2, filename: "readme.txt", url: "/uploads/characters/alice/readme.txt", content_type: "text/plain" }),
      ]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      fireEvent.click(screen.getByText("Choisir ce dossier personnage"));
      const [, sprites] = onSelectFolderWithSprites.mock.calls[0];
      expect(Object.keys(sprites)).toEqual(["default"]);
    });

    it("la clé 'default' est toujours en première position dans les sprites", () => {
      mockSWR([
        makeAsset({ id: 1, filename: "happy.png", url: "/uploads/characters/alice/happy.png", content_type: "image/png" }),
        makeAsset({ id: 2, filename: "default.png", url: "/uploads/characters/alice/default.png", content_type: "image/png" }),
        makeAsset({ id: 3, filename: "surprised.png", url: "/uploads/characters/alice/surprised.png", content_type: "image/png" }),
      ]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      fireEvent.click(screen.getByText("Choisir ce dossier personnage"));
      const [, sprites] = onSelectFolderWithSprites.mock.calls[0];
      expect(Object.keys(sprites)[0]).toBe("default");
    });

    it("AssetRef généré a le bon format type:'upload'", () => {
      mockSWR([
        makeAsset({ id: 1, filename: "default.png", url: "/uploads/characters/alice/default.png", content_type: "image/png" }),
      ]);
      render(
        <AssetGrid config={folderSelectorConfig} folder="characters/alice" onClose={onClose} />
      );
      fireEvent.click(screen.getByText("Choisir ce dossier personnage"));
      const [, sprites] = onSelectFolderWithSprites.mock.calls[0];
      expect(sprites["default"]).toEqual({
        type: "upload",
        url: "/uploads/characters/alice/default.png",
        opfs_key: null,
        job_id: null,
        mime_type: "image/png",
        width: null,
        height: null,
      });
    });
  });
});
