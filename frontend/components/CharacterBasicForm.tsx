"use client";

import { useRef, useState } from "react";
import type { AssetRef, Character } from "@/types";
import { api, randomCharacterColor, resolveAsset } from "@/lib/api";
import MediaLibraryModal from "@/components/media-library/MediaLibraryModal";

interface Props {
  storyId: number;
  characters: Character[];
  initial?: Character;
  onSaved: (c: Character) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onPreviewAsset?: (ref: AssetRef) => void;
  onSpritesChange?: (sprites: Record<string, AssetRef> | null) => void;
}

export default function CharacterBasicForm({
  storyId,
  characters,
  initial,
  onSaved,
  onCancel,
  onDelete,
  onPreviewAsset,
  onSpritesChange,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? randomCharacterColor());
  const colorInputRef = useRef<HTMLInputElement>(null);

  const [activeAsset, setActiveAsset] = useState<AssetRef | null>(
    initial?.sprites?.["default"] ?? null
  );
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [pendingSprites, setPendingSprites] = useState<Record<string, AssetRef> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFolderSelect = (_folder: string, sprites: Record<string, AssetRef>) => {
    setPendingSprites(sprites);
    const defaultSprite = sprites["default"] ?? Object.values(sprites)[0] ?? null;
    if (defaultSprite) {
      setActiveAsset(defaultSprite);
      onPreviewAsset?.(defaultSprite);
    }
    onSpritesChange?.(sprites);
    setIsMediaLibraryOpen(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const existingSprites = initial?.sprites ?? {};
      const sprites = pendingSprites
        ? { ...existingSprites, ...pendingSprites }
        : activeAsset
        ? { ...existingSprites, default: activeAsset }
        : existingSprites;
      let saved: Character;
      if (initial) {
        saved = await api.characters.update(storyId, initial.id, { name: name.trim(), color, sprites });
      } else {
        saved = await api.characters.create(storyId, { name: name.trim(), color, sprites });
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 hover:border-white/20 bg-elevated hover:bg-raised text-muted hover:text-fore text-sm transition-colors self-start"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      <div className="text-xs font-semibold text-subtle uppercase tracking-wide">
        {initial ? "Modifier le personnage" : "Nouveau personnage"}
      </div>

      {/* Media library import */}
      <div>
        <div className="text-xs text-muted mb-2">Sprites</div>
        <button
          onClick={() => setIsMediaLibraryOpen(true)}
          className="w-full py-2 rounded-md border border-white/10 hover:border-white/25 text-muted hover:text-fore text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {activeAsset ? "Changer depuis la médiathèque" : "Choisir depuis la médiathèque"}
        </button>
        {!initial && !activeAsset && (
          <p className="text-[11px] text-subtle mt-1 text-center">Requis pour créer le personnage</p>
        )}
      </div>

      {/* Inline pose list — shown for new characters after folder import */}
      {!initial && pendingSprites && Object.keys(pendingSprites).length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-subtle uppercase tracking-wide">
            Poses ({Object.keys(pendingSprites).length})
          </div>
          {Object.entries(pendingSprites).map(([key, ref]) => (
            <div
              key={key}
              className="bg-amber-900/10 border border-amber-700/40 rounded-md p-2.5 flex items-center gap-2.5"
            >
              <img
                src={resolveAsset(ref)}
                alt={key}
                className="h-12 w-8 object-contain rounded bg-raised flex-shrink-0"
              />
              {key === "default" ? (
                <span className="text-xs font-semibold text-amber-400 px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded-full">
                  default
                </span>
              ) : (
                <span className="text-xs text-fore">{key}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Name + color picker */}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          className="flex-1 bg-elevated border border-white/7 rounded px-3 py-2 text-sm text-fore placeholder-subtle focus:outline-none focus:border-white/25"
        />
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className="w-9 h-9 rounded border border-white/10 hover:border-white/25 transition-colors flex-shrink-0"
          style={{ backgroundColor: color }}
          title="Couleur du personnage"
        />
        <input
          ref={colorInputRef}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="sr-only"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving || (!initial && !activeAsset)}
          className="flex-1 py-2 rounded bg-neutral-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 text-sm font-semibold transition-colors"
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
            className="px-4 py-2 rounded bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-300 text-sm transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>

      <MediaLibraryModal
        config={{
          mode: "folder-selector",
          allowedFolders: ["characters"],
          initialFolder: "characters",
          onSelectFolderWithSprites: handleFolderSelect,
        }}
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
      />
    </div>
  );
}
