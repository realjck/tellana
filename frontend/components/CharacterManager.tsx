"use client";

import { useRef, useState } from "react";
import type { Character, Position } from "@/types";
import { api, DEFAULT_SPRITES } from "@/lib/api";

interface Props {
  storyId: number;
  characters: Character[];
  onRefresh: () => void;
}

const POSITIONS: { value: Position; label: string }[] = [
  { value: "left", label: "Gauche" },
  { value: "right", label: "Droite" },
];

export default function CharacterManager({
  storyId,
  characters,
  onRefresh,
}: Props) {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState(DEFAULT_SPRITES[0].url);
  const [position, setPosition] = useState<Position>("left");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await api.assets.upload(file);
      setImageUrl(url);
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !imageUrl) return;
    setSaving(true);
    try {
      await api.characters.create(storyId, {
        name: name.trim(),
        image_url: imageUrl,
        position,
      });
      setName("");
      setImageUrl(DEFAULT_SPRITES[0].url);
      setPosition("left");
      onRefresh();
    } catch {
      alert("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (charId: number) => {
    if (!confirm("Supprimer ce personnage ?")) return;
    await api.characters.delete(storyId, charId);
    onRefresh();
  };

  const handlePositionChange = async (char: Character, pos: Position) => {
    await api.characters.update(storyId, char.id, { position: pos });
    onRefresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Existing characters */}
      {characters.length > 0 && (
        <div className="flex flex-col gap-2">
          {characters.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700"
            >
              <img
                src={c.image_url}
                alt={c.name}
                className="w-10 h-10 object-contain rounded-lg bg-slate-700"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {c.name}
                </div>
                <select
                  value={c.position}
                  onChange={(e) =>
                    handlePositionChange(c, e.target.value as Position)
                  }
                  className="text-xs bg-slate-700 border-none rounded px-1 py-0.5 text-slate-300 mt-0.5"
                >
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-slate-500 hover:text-red-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add character form */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Ajouter un personnage
        </div>

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du personnage"
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />

        {/* Image picker */}
        <div>
          <div className="text-xs text-slate-400 mb-2">Sprite</div>
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_SPRITES.map((s) => (
              <button
                key={s.url}
                onClick={() => setImageUrl(s.url)}
                className={`p-1 rounded-lg border-2 transition-colors ${
                  imageUrl === s.url
                    ? "border-blue-500"
                    : "border-transparent hover:border-slate-500"
                }`}
                title={s.label}
              >
                <img
                  src={s.url}
                  alt={s.label}
                  className="h-14 w-10 object-contain"
                />
              </button>
            ))}

            {/* Custom upload preview */}
            {imageUrl && !DEFAULT_SPRITES.find((s) => s.url === imageUrl) && (
              <div className="p-1 rounded-lg border-2 border-blue-500">
                <img
                  src={imageUrl}
                  alt="Custom"
                  className="h-14 w-10 object-contain"
                />
              </div>
            )}

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

        {/* Position */}
        <div className="flex gap-2">
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPosition(p.value)}
              className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                position === p.value
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim() || !imageUrl || saving}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saving ? "Création…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
