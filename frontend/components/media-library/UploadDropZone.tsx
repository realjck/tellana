"use client";

import { useState, useRef } from "react";
import { useSWRConfig } from "swr";
import ConfirmModal from "@/components/ConfirmModal";
import { api } from "@/lib/api";
import type { MediaLibraryConfig } from "@/types";

type ConflictInfo = {
  file: File;
  existingId: number;
  references: { scenes: number; nodes: number };
};

interface Props {
  folder: string;
  config: MediaLibraryConfig;
}

export default function UploadDropZone({ folder, config }: Props) {
  const { mutate } = useSWRConfig();
  const [dragging, setDragging] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  if (config.mode !== "navigation") return null;

  async function uploadFile(file: File, replace = false): Promise<void> {
    const result = await api.assets.uploadMedia(file, folder, replace);
    if (!result.ok) {
      setConflicts((prev) => [
        ...prev,
        { file, existingId: result.existing_id, references: result.references },
      ]);
    }
  }

  async function handleFiles(files: FileList | File[]): Promise<void> {
    await Promise.allSettled([...files].map((f) => uploadFile(f)));
    await mutate(["assets", folder]);
    await mutate("asset-folders");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  const conflict = conflicts[0];

  return (
    <>
      <div
        data-testid="upload-drop-zone"
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-md cursor-pointer transition-colors p-3 text-center text-sm ${
          dragging
            ? "border-primary bg-primary/10 text-primary"
            : "border-white/20 text-muted hover:border-white/40"
        }`}
      >
        Déposer des fichiers ici ou cliquer pour sélectionner
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {conflict && (
        <ConfirmModal
          message={`Ce fichier remplacera "${conflict.file.name}" utilisé dans ${conflict.references.scenes} scène(s) et ${conflict.references.nodes} nœud(s). Continuer ?`}
          onConfirm={() => {
            const pending = conflict;
            setConflicts((prev) => prev.slice(1));
            uploadFile(pending.file, true).then(() => {
              mutate(["assets", folder]);
              mutate("asset-folders");
            });
          }}
          onCancel={() => setConflicts((prev) => prev.slice(1))}
        />
      )}
    </>
  );
}
