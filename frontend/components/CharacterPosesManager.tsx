"use client";

import { useRef, useState } from "react";
import type { AssetRef, Character } from "@/types";
import { api, DEFAULT_SPRITES, resolveAsset } from "@/lib/api";

interface Props {
  storyId: number;
  character: Character;
  characters: Character[];
  onSaved: (c: Character) => void;
  onBack: () => void;
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

/** Collect all uploaded images from all story characters (deduped by URL) */
function collectUploads(characters: Character[]): AssetRef[] {
  const seen = new Set<string>();
  const uploads: AssetRef[] = [];
  for (const c of characters) {
    for (const sprite of Object.values(c.sprites)) {
      if (sprite.type === "upload" && sprite.url && !seen.has(sprite.url)) {
        seen.add(sprite.url);
        uploads.push(sprite);
      }
    }
  }
  return uploads;
}

/** Small image picker overlay for choosing a sprite */
function SpritePicker({
  current,
  customUploads,
  onPick,
  onClose,
}: {
  current: AssetRef | null;
  customUploads: AssetRef[];
  onPick: (ref: AssetRef) => void;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ref = await api.assets.upload(file);
      onPick(ref);
      onClose();
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 bg-elevated border border-white/10 rounded-md p-3 z-[70] shadow-2xl w-64">
        <div className="text-xs text-muted mb-2 font-semibold">Choisir un sprite</div>

        {/* Default sprites */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {DEFAULT_SPRITES.map((s) => (
            <button
              key={s.url}
              onClick={() => {
                onPick({ type: "local", url: s.url, opfs_key: null, job_id: null, mime_type: null, width: null, height: null });
                onClose();
              }}
              className={`p-0.5 rounded border-2 transition-colors ${
                current?.url === s.url ? "border-white/50" : "border-transparent hover:border-white/20"
              }`}
              title={s.label}
            >
              <img src={s.url} alt={s.label} className="w-full h-16 object-contain" />
            </button>
          ))}
        </div>

        {/* Already uploaded images */}
        {customUploads.length > 0 && (
          <>
            <div className="text-[10px] text-subtle uppercase tracking-wide mb-1.5">Déjà uploadées</div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {customUploads.map((ref) => (
                <button
                  key={ref.url}
                  onClick={() => { onPick(ref); onClose(); }}
                  className={`p-0.5 rounded border-2 transition-colors ${
                    current?.url === ref.url ? "border-white/50" : "border-transparent hover:border-white/20"
                  }`}
                  title="Image uploadée"
                >
                  <img src={resolveAsset(ref)} alt="Uploaded" className="w-full h-16 object-contain" />
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full py-1.5 rounded border border-dashed border-white/10 hover:border-white/25 text-muted hover:text-fore text-xs transition-colors"
        >
          {uploading ? "Upload…" : "+ Uploader une nouvelle image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}

export default function CharacterPosesManager({
  storyId,
  character,
  characters,
  onSaved,
  onBack,
}: Props) {
  const [rows, setRows] = useState<PoseRow[]>(() => buildRows(character.sprites));
  const [pickerForKey, setPickerForKey] = useState<string | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const customUploads = collectUploads(characters);

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

  // ── Change image ──────────────────────────────────────────────────────────

  const handleImageChange = async (idx: number, ref: AssetRef) => {
    const newRows = rows.map((r, i) => (i === idx ? { ...r, ref } : r));
    setRows(newRows);
    await saveToApi(newRows, rows[idx].key);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
    await saveToApi(newRows);
  };

  // ── Add new pose ──────────────────────────────────────────────────────────

  const addNewPose = async (ref: AssetRef) => {
    let n = 1;
    while (rows.some((r) => r.key === `pose_${n}`)) n++;
    const newKey = `pose_${n}`;
    const newRows: PoseRow[] = [...rows, { key: newKey, ref, savedKey: newKey }];
    setRows(newRows);
    setAddPickerOpen(false);
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
              {/* Thumbnail — click to change image */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setPickerForKey(row.savedKey)}
                  className="group relative block"
                  title="Changer l'image"
                >
                  <img
                    src={resolveAsset(row.ref)}
                    alt={row.key}
                    className="h-12 w-8 object-contain rounded bg-raised"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                </button>
                {pickerForKey === row.savedKey && (
                  <SpritePicker
                    current={row.ref}
                    customUploads={customUploads}
                    onPick={(ref) => { handleImageChange(idx, ref); setPickerForKey(null); }}
                    onClose={() => setPickerForKey(null)}
                  />
                )}
              </div>

              {/* Key name */}
              <div className="flex-1 min-w-0">
                {isDefault ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded-full">
                      défaut
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => handleRenameChange(idx, e.target.value)}
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
      <div className="relative">
        <button
          onClick={() => setAddPickerOpen((v) => !v)}
          className="w-full py-2 rounded border border-dashed border-amber-700/50 hover:border-amber-500 text-amber-600 hover:text-amber-400 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter une pose
        </button>
        {addPickerOpen && (
          <SpritePicker
            current={null}
            customUploads={customUploads}
            onPick={addNewPose}
            onClose={() => setAddPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
