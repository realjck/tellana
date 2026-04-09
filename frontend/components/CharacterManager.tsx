"use client";

import { useState } from "react";
import type { AssetRef, Character } from "@/types";
import { api, resolveAsset } from "@/lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import CharacterBasicForm from "@/components/CharacterBasicForm";
import CharacterPosesManager from "@/components/CharacterPosesManager";
import CharacterPosesDrawer from "@/components/CharacterPosesDrawer";

interface Props {
  storyId: number;
  characters: Character[];
  onRefresh: () => void;
}

type Mode = "list" | "add" | "edit" | "poses";

export default function CharacterManager({ storyId, characters, onRefresh }: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [selected, setSelected] = useState<Character | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Preview override for the default sprite (real-time, before save) */
  const [previewDefaultSprite, setPreviewDefaultSprite] = useState<AssetRef | null>(null);

  const goList = () => {
    setSelected(null);
    setMode("list");
    setPreviewDefaultSprite(null);
  };

  const goEdit = (c: Character) => {
    setSelected(c);
    setMode("edit");
    setPreviewDefaultSprite(null);
  };

  const goAdd = () => {
    setSelected(null);
    setMode("add");
    setPreviewDefaultSprite(null);
  };

  const goPoses = (c: Character) => {
    setSelected(c);
    setMode("poses");
    setPreviewDefaultSprite(null);
  };

  const refreshAndGoList = () => {
    onRefresh();
    goList();
  };

  /** Sprites shown in the drawer: merge preview override into the saved sprites */
  const drawerSprites = selected
    ? {
        ...selected.sprites,
        ...(previewDefaultSprite ? { default: previewDefaultSprite } : {}),
      }
    : {};

  // ── Add mode ────────────────────────────────────────────────────────────────
  if (mode === "add") {
    return (
      <CharacterBasicForm
        storyId={storyId}
        characters={characters}
        onSaved={(c) => { onRefresh(); goPoses(c); }}
        onCancel={goList}
      />
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  if (mode === "edit" && selected) {
    return (
      <>
        {confirmDelete && (
          <ConfirmModal
            message={`Supprimer "${selected.name}" ? Cette action est irréversible.`}
            onConfirm={async () => {
              await api.characters.delete(storyId, selected.id);
              setConfirmDelete(false);
              refreshAndGoList();
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
        <div className="flex flex-col gap-4">
          <CharacterBasicForm
            storyId={storyId}
            characters={characters}
            initial={selected}
            onSaved={(c) => {
              setSelected(c);
              setPreviewDefaultSprite(null);
              onRefresh();
            }}
            onCancel={goList}
            onDelete={() => setConfirmDelete(true)}
            onPreviewAsset={setPreviewDefaultSprite}
          />

          {/* Manage poses shortcut */}
          <button
            onClick={() => goPoses(selected)}
            className="w-full py-2 rounded-lg border border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Gérer les poses ({Object.keys(selected.sprites).length})
          </button>
        </div>

        <CharacterPosesDrawer
          characterName={selected.name}
          sprites={drawerSprites}
        />
      </>
    );
  }

  // ── Poses mode ──────────────────────────────────────────────────────────────
  if (mode === "poses" && selected) {
    return (
      <>
        <CharacterPosesManager
          storyId={storyId}
          character={selected}
          characters={characters}
          onSaved={(c) => {
            setSelected(c);
            onRefresh();
          }}
          onBack={() => goEdit(selected)}
        />
        <CharacterPosesDrawer
          characterName={selected.name}
          sprites={selected.sprites}
        />
      </>
    );
  }

  // ── List mode ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {characters.length === 0 ? (
        <p className="text-center text-slate-500 text-xs py-4">
          Aucun personnage. Ajoutez-en un ci-dessous.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map((c) => {
            const firstSprite = Object.values(c.sprites)[0];
            const poseCount = Object.keys(c.sprites).length;
            return (
              <button
                key={c.id}
                onClick={() => goEdit(c)}
                className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 rounded-xl px-3 py-2 border border-slate-700 hover:border-slate-500 transition-colors text-left w-full group"
              >
                <img
                  src={firstSprite ? resolveAsset(firstSprite) : ""}
                  alt={c.name}
                  className="w-10 h-12 object-contain rounded-lg bg-slate-700 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {poseCount} pose{poseCount > 1 ? "s" : ""}
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
            );
          })}
        </div>
      )}

      <button
        onClick={goAdd}
        className="w-full py-2 rounded-lg border border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un personnage
      </button>
    </div>
  );
}
