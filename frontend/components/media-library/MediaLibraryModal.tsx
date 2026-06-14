"use client";

import { useEffect, useState } from "react";
import type { MediaLibraryConfig } from "@/types";
import FolderTree from "./FolderTree";

interface Props {
  config: MediaLibraryConfig;
  isOpen: boolean;
  onClose: () => void;
}

export default function MediaLibraryModal({ config, isOpen, onClose }: Props) {
  const [currentFolder, setCurrentFolder] = useState<string | null>(
    config.initialFolder ?? null
  );

  useEffect(() => {
    if (isOpen) setCurrentFolder(config.initialFolder ?? null);
  }, [isOpen, config.initialFolder]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg border border-white/10 rounded-lg shadow-2xl w-full max-w-5xl mx-4 h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-fore font-semibold">Médiathèque</h2>
          <button
            aria-label="×"
            onClick={onClose}
            className="text-muted hover:text-fore text-xl leading-none px-1"
          >
            ×
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-white/10 flex flex-col flex-shrink-0">
            <FolderTree
              config={config}
              selectedFolder={currentFolder}
              onSelectFolder={setCurrentFolder}
            />
            {config.mode === "folder-selector" && currentFolder && (
              <div className="p-3 flex-shrink-0">
                <button
                  onClick={() => {
                    config.onSelectFolder?.(currentFolder);
                    onClose();
                  }}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-sm"
                >
                  Sélectionner ce dossier
                </button>
              </div>
            )}
          </div>
          {/* Placeholder — remplacé par AssetGrid en story 2.2 */}
          <div className="flex-1 p-4 flex items-center justify-center text-muted text-sm">
            {currentFolder ? `Dossier : ${currentFolder}` : "Sélectionnez un dossier"}
          </div>
        </div>
      </div>
    </div>
  );
}
