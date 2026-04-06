"use client";

import { useRef, useState } from "react";
import type { Character, Position } from "@/types";
import { api, DEFAULT_SPRITES, API_BASE } from "@/lib/api";

function resolveImage(url: string): string {
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return url;
}

interface Props {
  storyId: number;
  characters: Character[];
  onRefresh: () => void;
}

type Mode = "list" | "edit" | "add";

const POSITIONS: { value: Position; label: string }[] = [
  { value: "left", label: "Gauche" },
  { value: "right", label: "Droite" },
];

export default function CharacterManager({ storyId, characters, onRefresh }: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [selected, setSelected] = useState<Character | null>(null);

  const openEdit = (c: Character) => {
    setSelected(c);
    setMode("edit");
  };

  const back = () => {
    setSelected(null);
    setMode("list");
  };

  const refresh = () => {
    onRefresh();
    back();
  };

  if (mode === "add") {
    return <CharacterForm storyId={storyId} onSave={refresh} onCancel={back} />;
  }

  if (mode === "edit" && selected) {
    return (
      <CharacterForm
        storyId={storyId}
        initial={selected}
        onSave={refresh}
        onCancel={back}
        onDelete={async () => {
          if (!confirm("Supprimer ce personnage ?")) return;
          await api.characters.delete(storyId, selected.id);
          refresh();
        }}
      />
    );
  }

  // ── List mode ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {characters.length === 0 ? (
        <p className="text-center text-slate-500 text-xs py-4">
          Aucun personnage. Ajoutez-en un ci-dessous.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => openEdit(c)}
              className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-700 hover:border-slate-500 transition-colors text-left w-full group"
            >
              <img
                src={resolveImage(c.image_url)}
                alt={c.name}
                className="w-10 h-12 object-contain rounded-lg bg-slate-700 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{c.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {c.position === "left" ? "Gauche" : "Droite"}
                </div>
              </div>
              <svg
                className="w-4 h-4 text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition-colors"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {characters.length < 4 ? (
        <button
          onClick={() => setMode("add")}
          className="w-full py-2 rounded-lg border border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un personnage
        </button>
      ) : (
        <p className="text-center text-slate-600 text-xs py-2">
          Maximum 4 personnages atteint
        </p>
      )}
    </div>
  );
}

// ── Shared form (create or edit) ───────────────────────────────────────────

function CharacterForm({
  storyId,
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  storyId: number;
  initial?: Character;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? DEFAULT_SPRITES[0].url);
  const [position, setPosition] = useState<Position>(initial?.position ?? "left");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Track all custom-uploaded URLs so they persist in the picker even when another sprite is selected
  const [customUploads, setCustomUploads] = useState<string[]>(() => {
    if (initial?.image_url && !DEFAULT_SPRITES.find((s) => s.url === initial.image_url)) {
      return [initial.image_url];
    }
    return [];
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await api.assets.upload(file);
      setImageUrl(url);
      setCustomUploads((prev) => (prev.includes(url) ? prev : [...prev, url]));
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const removeCustomUpload = (url: string) => {
    setCustomUploads((prev) => prev.filter((u) => u !== url));
    if (imageUrl === url) setImageUrl(DEFAULT_SPRITES[0].url);
  };

  const handleSave = async () => {
    if (!name.trim() || !imageUrl) return;
    setSaving(true);
    try {
      if (initial) {
        await api.characters.update(storyId, initial.id, {
          name: name.trim(),
          image_url: imageUrl,
          position,
        });
      } else {
        await api.characters.create(storyId, {
          name: name.trim(),
          image_url: imageUrl,
          position,
        });
      }
      onSave();
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

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du personnage"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />

      {/* Sprite picker */}
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
              <img src={s.url} alt={s.label} className="h-14 w-10 object-contain" />
            </button>
          ))}

          {/* Custom uploaded sprites — each has a red × to remove it */}
          {customUploads.map((url) => (
            <div key={url} className="relative">
              <button
                onClick={() => setImageUrl(url)}
                className={`p-1 rounded-lg border-2 transition-colors ${
                  imageUrl === url
                    ? "border-blue-500"
                    : "border-transparent hover:border-slate-500"
                }`}
                title="Sprite importé"
              >
                <img src={resolveImage(url)} alt="Custom" className="h-14 w-10 object-contain" />
              </button>
              <button
                onClick={() => removeCustomUpload(url)}
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

      {/* Position */}
      <div>
        <div className="text-xs text-slate-400 mb-2">Position sur scène</div>
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
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || !imageUrl || saving}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {saving ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter"}
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
