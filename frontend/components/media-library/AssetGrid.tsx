"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { api, resolveAsset } from "@/lib/api";
import { useAssetBust } from "@/lib/assetBust";
import type { MediaLibraryConfig, Asset, AssetRef } from "@/types";
import ConfirmModal from "@/components/ConfirmModal";
import AlertModal from "@/components/AlertModal";
import UploadDropZone from "./UploadDropZone";
import ContextMenu from "./ContextMenu";

interface Props {
  config: MediaLibraryConfig;
  folder: string | null;
  onClose: () => void;
  onNavigate?: (folder: string) => void;
}

type ContextMenuPayload =
  | { type: "file"; asset: Asset }
  | { type: "folder"; folderPath: string };

type ContextMenuState = ({ x: number; y: number } & ContextMenuPayload) | null;

export default function AssetGrid({ config, folder, onClose, onNavigate }: Props) {
  const { data: allAssets = [] } = useSWR<Asset[]>(
    folder ? ["assets", folder] : null,
    () => api.assets.list(folder!)
  );
  const { data: allFolders = [] } = useSWR<string[]>("asset-folders", api.assets.getFolders);
  const { mutate } = useSWRConfig();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const escapeRef = useRef(false);
  const bust = useAssetBust(); // re-render this grid when an asset is replaced in place

  const assets = allAssets.filter(
    (a) =>
      a.filename !== ".keep" &&
      (config.filter !== "images" || a.content_type.startsWith("image/"))
  );

  const imageAssets = allAssets.filter(
    (a) => a.filename !== ".keep" && a.content_type.startsWith("image/")
  );

  const childFolders = folder
    ? allFolders.filter(
        (f) => f.startsWith(folder + "/") && !f.slice(folder.length + 1).includes("/")
      )
    : [];

  if (!folder) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
        Sélectionnez un dossier
      </div>
    );
  }

  const handleClick = (asset: Asset) => {
    if (config.mode === "selector") {
      config.onSelect?.(asset);
      onClose();
    }
  };

  const commitRename = async (asset: Asset, name: string) => {
    setEditingId(null);
    if (!name.trim() || name.trim() === asset.filename) return;
    try {
      await api.assets.rename(asset.id, name.trim());
      await mutate(["assets", folder!]);
      await mutate("asset-folders");
    } catch {
      setAlertMessage("Un fichier avec ce nom existe déjà dans ce dossier.");
    }
  };

  const commitFolderRename = async (folderPath: string, newName: string) => {
    setEditingFolder(null);
    const currentName = folderPath.slice(folder!.length + 1);
    if (!newName.trim() || newName.trim() === currentName) return;
    const newPath = folder + "/" + newName.trim();
    try {
      await api.assets.renameFolder(folderPath, newPath);
      await mutate("asset-folders");
      await mutate(["assets", folder!]);
      await mutate((key) => typeof key === "string" && (key.startsWith("story-") || key.startsWith("scene-")));
    } catch {
      setAlertMessage("Un dossier avec ce nom existe déjà.");
    }
  };

  const openContextMenu = (e: React.MouseEvent, payload: ContextMenuPayload) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, ...payload });
  };

  const handleSelectFolder = () => {
    const sprites = mapSpritesFromAssets(imageAssets);
    config.onSelectFolderWithSprites?.(folder, sprites);
    onClose();
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
      <UploadDropZone folder={folder} config={config} />
      {childFolders.length === 0 && assets.length === 0 ? (
        <div className="text-muted text-sm text-center py-4">Dossier vide</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {childFolders.map((f) => {
            const name = f.slice(folder.length + 1);
            return (
              <div
                key={f}
                onClick={() => {
                  if (editingFolder === f) return;
                  onNavigate?.(f);
                }}
                onContextMenu={(e) =>
                  openContextMenu(e, { type: "folder", folderPath: f })
                }
                className="relative rounded-lg overflow-hidden border border-white/10 bg-elevated group cursor-pointer hover:border-primary/60"
              >
                <div className="aspect-square bg-bg flex items-center justify-center">
                  <FolderIcon />
                </div>
                <div className="p-1.5">
                  {editingFolder === f ? (
                    <input
                      autoFocus
                      className="text-xs text-fore bg-transparent border-b border-primary outline-none w-full"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={() => {
                        if (escapeRef.current) { escapeRef.current = false; return; }
                        commitFolderRename(f, editingFolderName);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") { escapeRef.current = true; setEditingFolder(null); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="text-xs text-fore truncate" title={name}>{name}</p>
                  )}
                  <p className="text-xs text-subtle">dossier</p>
                </div>
              </div>
            );
          })}
          {assets.map((asset) => (
            <div
              key={asset.id}
              data-testid="asset-card"
              onClick={() => handleClick(asset)}
              onContextMenu={(e) =>
                openContextMenu(e, { type: "file", asset })
              }
              className={`relative rounded-lg overflow-hidden border border-white/10 bg-elevated group ${
                config.mode === "selector" ? "cursor-pointer hover:border-primary/60" : ""
              }`}
            >
              <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
                {asset.content_type.startsWith("image/") ? (
                  <img
                    src={resolveAsset(asset.url, bust)}
                    alt={asset.filename}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-muted text-xs text-center px-1">
                    {asset.content_type}
                  </span>
                )}
              </div>
              <div className="p-1.5">
                {editingId === asset.id ? (
                  <input
                    autoFocus
                    className="text-xs text-fore bg-transparent border-b border-primary outline-none w-full"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                      if (escapeRef.current) { escapeRef.current = false; return; }
                      commitRename(asset, editingName);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") { escapeRef.current = true; setEditingId(null); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className="text-xs text-fore truncate"
                    title={asset.filename}
                  >
                    {asset.filename}
                  </p>
                )}
                <p className="text-xs text-subtle">{_typeLabel(asset.content_type)}</p>
              </div>
              {asset.is_seed && (
                <span className="absolute top-1 right-1 bg-amber-600/80 text-white text-[10px] px-1 rounded leading-tight">
                  seed
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {config.mode === "folder-selector" && imageAssets.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={handleSelectFolder}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-md text-sm font-semibold transition-colors"
          >
            Choisir ce dossier personnage
          </button>
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.type === "file"
              ? [
                  {
                    label: "Renommer",
                    onClick: () => {
                      setContextMenu(null);
                      setEditingId(contextMenu.asset.id);
                      setEditingName(contextMenu.asset.filename);
                    },
                  },
                  {
                    label: "Supprimer",
                    onClick: () => {
                      setContextMenu(null);
                      setPendingDelete(contextMenu.asset);
                    },
                    variant: "danger",
                  },
                ]
              : [
                  {
                    label: "Renommer",
                    onClick: () => {
                      const name = contextMenu.folderPath.slice(folder.length + 1);
                      setContextMenu(null);
                      setEditingFolder(contextMenu.folderPath);
                      setEditingFolderName(name);
                    },
                  },
                  {
                    label: "Supprimer",
                    onClick: () => {
                      setContextMenu(null);
                      setPendingDeleteFolder(contextMenu.folderPath);
                    },
                    variant: "danger",
                  },
                ]
          }
        />
      )}
      {pendingDelete && (
        <ConfirmModal
          message={`Supprimer "${pendingDelete.filename}" ?`}
          onConfirm={async () => {
            const target = pendingDelete;
            setPendingDelete(null);
            await api.assets.delete(target.id);
            await mutate(["assets", folder!]);
            await mutate("asset-folders");
            await mutate((key) => typeof key === "string" && (key.startsWith("story-") || key.startsWith("scene-")));
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {pendingDeleteFolder && (
        <ConfirmModal
          message={`Supprimer le dossier "${pendingDeleteFolder.slice(folder.length + 1)}" et tous ses contenus ?`}
          onConfirm={async () => {
            const target = pendingDeleteFolder;
            setPendingDeleteFolder(null);
            await api.assets.deleteFolder(target);
            await mutate("asset-folders");
            await mutate(["assets", folder!]);
            await mutate((key) => typeof key === "string" && (key.startsWith("story-") || key.startsWith("scene-")));
          }}
          onCancel={() => setPendingDeleteFolder(null)}
        />
      )}
      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </div>
  );
}

function mapSpritesFromAssets(images: Asset[]): Record<string, AssetRef> {
  const toRef = (a: Asset): AssetRef => ({
    type: "upload",
    url: a.url,
    opfs_key: null,
    job_id: null,
    mime_type: a.content_type,
    width: null,
    height: null,
  });

  const defaultImg = images.find((a) => a.filename.replace(/\.[^.]+$/, "") === "default") ?? images[0];
  if (!defaultImg) return {};

  // Insert "default" first so it always appears first in the poses list
  const sprites: Record<string, AssetRef> = { default: toRef(defaultImg) };
  for (const a of images) {
    if (a === defaultImg) continue;
    sprites[a.filename.replace(/\.[^.]+$/, "")] = toRef(a);
  }
  return sprites;
}

function FolderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-muted/60">
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        fill="currentColor"
      />
    </svg>
  );
}

function _typeLabel(contentType: string): string {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  return contentType.split("/")[1] ?? contentType;
}
