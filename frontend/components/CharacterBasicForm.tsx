"use client";

import { useRef, useState } from "react";
import type { AssetRef, Character } from "@/types";
import { api, DEFAULT_SPRITES, resolveAsset } from "@/lib/api";

interface Props {
  storyId: number;
  characters: Character[];
  initial?: Character;
  onSaved: (c: Character) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onPreviewAsset?: (ref: AssetRef) => void;
}

export default function CharacterBasicForm({
  storyId,
  characters,
  initial,
  onSaved,
  onCancel,
  onDelete,
  onPreviewAsset,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");

  const defaultSprite = initial?.sprites?.["default"] ?? null;
  const initialAsset: AssetRef = defaultSprite ?? {
    type: "local",
    url: DEFAULT_SPRITES[0].url,
    opfs_key: null,
    job_id: null,
    mime_type: null,
    width: null,
    height: null,
  };
  const [activeAsset, setActiveAsset] = useState<AssetRef>(initialAsset);

  const selectAsset = (ref: AssetRef) => {
    setActiveAsset(ref);
    onPreviewAsset?.(ref);
  };

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Collect uploaded sprites from other characters for the picker (deduped by URL)
  const [customUploads, setCustomUploads] = useState<AssetRef[]>(() => {
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
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ref = await api.assets.upload(file);
      selectAsset(ref);
      setCustomUploads((prev) =>
        prev.some((r) => r.url === ref.url) ? prev : [...prev, ref]
      );
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const removeCustomUpload = (ref: AssetRef) => {
    setCustomUploads((prev) => prev.filter((r) => r.url !== ref.url));
    if (activeAsset.url === ref.url) {
      selectAsset({
        type: "local",
        url: DEFAULT_SPRITES[0].url,
        opfs_key: null,
        job_id: null,
        mime_type: null,
        width: null,
        height: null,
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // IMPORTANT: preserve existing named poses when updating the default sprite
      const existingSprites = initial?.sprites ?? {};
      const sprites = { ...existingSprites, default: activeAsset };
      let saved: Character;
      if (initial) {
        saved = await api.characters.update(storyId, initial.id, { name: name.trim(), sprites });
      } else {
        saved = await api.characters.create(storyId, { name: name.trim(), sprites });
      }
      onSaved(saved);
    } catch {
      alert("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Back */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors self-start"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {initial ? "Modifier le personnage" : "Nouveau personnage"}
      </div>

      {/* Default sprite picker */}
      <div>
        <div className="text-xs text-slate-400 mb-2">Sprite par défaut</div>
        <div className="flex gap-2 flex-wrap">
          {DEFAULT_SPRITES.map((s) => {
            const isActive = activeAsset.url === s.url;
            return (
              <button
                key={s.url}
                onClick={() =>
                  selectAsset({
                    type: "local",
                    url: s.url,
                    opfs_key: null,
                    job_id: null,
                    mime_type: null,
                    width: null,
                    height: null,
                  })
                }
                className={`p-1 rounded-lg border-2 transition-colors ${
                  isActive ? "border-blue-500" : "border-transparent hover:border-slate-500"
                }`}
                title={s.label}
              >
                <img src={s.url} alt={s.label} className="h-14 w-10 object-contain" />
              </button>
            );
          })}

          {/* Custom uploaded sprites */}
          {customUploads.map((ref) => (
            <div key={ref.url} className="relative">
              <button
                onClick={() => setActiveAsset(ref)}
                className={`p-1 rounded-lg border-2 transition-colors ${
                  activeAsset.url === ref.url
                    ? "border-blue-500"
                    : "border-transparent hover:border-slate-500"
                }`}
                title="Sprite importé"
              >
                <img src={resolveAsset(ref)} alt="Custom" className="h-14 w-10 object-contain" />
              </button>
              <button
                onClick={() => removeCustomUpload(ref)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors"
                title="Supprimer"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-16 w-12 rounded-lg border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white text-xl flex items-center justify-center transition-colors"
            title="Uploader une image"
          >
            {uploading ? "…" : "+"}
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
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du personnage"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saving
            ? "Enregistrement…"
            : initial
            ? "Enregistrer"
            : "Créer le personnage"}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-300 text-sm transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
