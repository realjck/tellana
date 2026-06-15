"use client";

import { useState } from "react";
import type { Asset, AssetRef, Character } from "@/types";
import { api, resolveAsset } from "@/lib/api";
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";

interface Props {
  storyId: number;
  character: Character;
  onSaved: (c: Character) => void;
  onBack: () => void;
  onPoseSelect?: (key: string) => void;
}

interface PoseRow {
  key: string;
  ref: AssetRef;
  /** Key at the time of last API save (for rename-warning detection) */
  savedKey: string;
}

function buildRows(sprites: Record<string, AssetRef>): PoseRow[] {
  return Object.entries(sprites).map(([key, ref]) => ({ key, ref, savedKey: key }));
}

export default function CharacterPosesManager({
  storyId,
  character,
  onSaved,
  onBack,
  onPoseSelect,
}: Props) {
  const [rows, setRows] = useState<PoseRow[]>(() => buildRows(character.sprites));
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMediaLibOpen, setIsMediaLibOpen] = useState(false);

  const toSpritesDict = (r: PoseRow[]): Record<string, AssetRef> =>
    Object.fromEntries(r.map((row) => [row.key, row.ref]));

  const saveToApi = async (newRows: PoseRow[], savingKey?: string): Promise<Character> => {
    setSaving(savingKey ?? null);
    try {
      const updated = await api.characters.update(storyId, character.id, {
        sprites: toSpritesDict(newRows),
      });
      onSaved(updated);
      return updated;
    } catch {
      alert("Erreur lors de l'enregistrement");
      throw new Error("save failed");
    } finally {
      setSaving(null);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────

  const handleRenameChange = (idx: number, newKey: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, key: newKey } : row))
    );
  };

  const handleRenameCommit = async (idx: number) => {
    const row = rows[idx];
    const trimmed = row.key.trim();
    if (!trimmed || trimmed === row.savedKey) return;

    const duplicate = rows.some((r, i) => i !== idx && r.key === trimmed);
    if (duplicate) {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, key: row.savedKey } : r))
      );
      setErrorMessage(`La pose "${trimmed}" existe déjà.`);
      return;
    }

    const newRows = rows.map((r, i) => (i === idx ? { ...r, key: trimmed, savedKey: trimmed } : r));
    setRows(newRows);
    await saveToApi(newRows, trimmed);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
    await saveToApi(newRows);
  };

  // ── Add new pose from media library ──────────────────────────────────────

  const handleAddPose = async (asset: Asset) => {
    const ref: AssetRef = {
      type: "upload",
      url: asset.url,
      opfs_key: null,
      job_id: null,
      mime_type: asset.content_type,
      width: null,
      height: null,
    };
    let n = 1;
    while (rows.some((r) => r.key === `pose_${n}` || r.savedKey === `pose_${n}`)) n++;
    const newKey = `pose_${n}`;
    const newRows: PoseRow[] = [...rows, { key: newKey, ref, savedKey: newKey }];
    setRows(newRows);
    setIsMediaLibOpen(false);
    await saveToApi(newRows, newKey);
  };

  const poseCount = rows.filter((r) => r.key !== "default").length;

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setErrorMessage(null)}
        >
          <div
            className="bg-elevated border border-white/10 rounded-lg shadow-2xl px-6 py-5 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-fore text-sm mb-5 leading-relaxed">{errorMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white cursor-pointer text-sm font-semibold transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 hover:border-white/20 bg-elevated hover:bg-raised text-muted hover:text-fore text-sm transition-colors self-start"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      <div className="text-xs font-semibold text-subtle uppercase tracking-wide">
        Poses de {character.name}
        {poseCount > 0 && (
          <span className="ml-1 text-subtle/60">({poseCount} pose{poseCount > 1 ? "s" : ""})</span>
        )}
      </div>

      {/* Pose rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => {
          const isDefault = row.key === "default";
          const hasRenameWarning = !isDefault && row.key !== row.savedKey && row.savedKey !== "";
          const isBeingSaved = saving === row.key;

          return (
            <div
              key={row.savedKey || idx}
              className="bg-amber-900/10 border border-amber-700/40 rounded-md p-2.5 flex items-center gap-2.5"
            >
              {/* Thumbnail — click to preview in drawer */}
              <div
                className="flex-shrink-0 cursor-pointer"
                onClick={() => onPoseSelect?.(row.key)}
              >
                <img
                  src={resolveAsset(row.ref)}
                  alt={row.key}
                  className="h-12 w-8 object-contain rounded bg-raised"
                />
              </div>

              {/* Key name */}
              <div className="flex-1 min-w-0">
                {isDefault ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded-full">
                      default
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => handleRenameChange(idx, e.target.value)}
                      onFocus={() => onPoseSelect?.(row.key)}
                      onBlur={() => handleRenameCommit(idx)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                      className="w-full bg-elevated border border-white/10 rounded px-2 py-1 text-xs text-fore focus:outline-none focus:border-white/25"
                      placeholder="Nom de la pose"
                    />
                    {hasRenameWarning && (
                      <p className="text-[10px] text-amber-400 leading-tight">
                        ⚠ Les nœuds utilisant &quot;{row.savedKey}&quot; afficheront le sprite par défaut après renommage.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Delete / saving indicator */}
              <div className="flex-shrink-0">
                {isBeingSaved ? (
                  <span className="text-[10px] text-muted">…</span>
                ) : !isDefault ? (
                  <button
                    onClick={() => handleDelete(idx)}
                    className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    title="Supprimer cette pose"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new pose */}
      <button
        onClick={() => setIsMediaLibOpen(true)}
        className="w-full py-2 rounded border border-dashed border-amber-700/50 hover:border-amber-500 text-amber-600 hover:text-amber-400 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter une pose
      </button>

      <MediaLibraryModal
        config={{
          mode: "selector",
          filter: "images",
          allowedFolders: ["characters"],
          onSelect: handleAddPose,
        }}
        isOpen={isMediaLibOpen}
        onClose={() => setIsMediaLibOpen(false)}
      />
    </div>
  );
}
