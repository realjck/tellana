"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { useSWRConfig } from "swr";
import { api, resolveAsset } from "@/lib/api";
import type { MediaLibraryConfig, Asset } from "@/types";
import ConfirmModal from "@/components/ConfirmModal";
import UploadDropZone from "./UploadDropZone";

interface Props {
  config: MediaLibraryConfig;
  folder: string | null;
  onClose: () => void;
}

export default function AssetGrid({ config, folder, onClose }: Props) {
  const { data: allAssets = [] } = useSWR<Asset[]>(
    folder ? ["assets", folder] : null,
    () => api.assets.list(folder!)
  );
  const { mutate } = useSWRConfig();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const escapeRef = useRef(false);

  const assets = allAssets.filter(
    (a) =>
      a.filename !== ".keep" &&
      (config.filter !== "images" || a.content_type.startsWith("image/"))
  );

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
    await api.assets.rename(asset.id, name.trim());
    await mutate(["assets", folder!]);
    await mutate("asset-folders");
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
      <UploadDropZone folder={folder} config={config} />
      {assets.length === 0 ? (
        <div className="text-muted text-sm text-center py-4">Dossier vide</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              data-testid="asset-card"
              onClick={() => handleClick(asset)}
              className={`relative rounded-lg overflow-hidden border border-white/10 bg-elevated group ${
                config.mode === "selector" ? "cursor-pointer hover:border-primary/60" : ""
              }`}
            >
              <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
                {asset.content_type.startsWith("image/") ? (
                  <img
                    src={resolveAsset(asset.url)}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
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
                    onDoubleClick={
                      config.mode === "navigation"
                        ? (e) => {
                            e.stopPropagation();
                            setEditingId(asset.id);
                            setEditingName(asset.filename);
                          }
                        : undefined
                    }
                  >
                    {asset.filename}
                  </p>
                )}
                <p className="text-xs text-subtle">{_typeLabel(asset.content_type)}</p>
              </div>
              {config.mode === "navigation" && (
                <button
                  aria-label="Supprimer"
                  className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-red-600 text-white rounded text-xs w-5 h-5 flex items-center justify-center leading-none transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(asset);
                  }}
                >
                  ×
                </button>
              )}
              {asset.is_seed && (
                <span className="absolute top-1 right-1 bg-amber-600/80 text-white text-[10px] px-1 rounded leading-tight">
                  seed
                </span>
              )}
            </div>
          ))}
        </div>
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
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function _typeLabel(contentType: string): string {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  return contentType.split("/")[1] ?? contentType;
}
