"use client";

import { useState } from "react";
import type { AssetRef, Character } from "@/types";
import { api, resolveAsset } from "@/lib/api";
import { useAssetBust } from "@/lib/assetBust";
import ConfirmModal from "@/components/ConfirmModal";
import CharacterBasicForm from "@/components/CharacterBasicForm";
import CharacterPosesManager from "@/components/CharacterPosesManager";
import CharacterPosesDrawer from "@/components/CharacterPosesDrawer";

interface Props {
  storyId: number;
  characters: Character[];
  onRefresh: () => void;
  onEditingCharacter?: (editing: boolean) => void;
}

type Mode = "list" | "add" | "edit";

export default function CharacterManager({ storyId, characters, onRefresh, onEditingCharacter }: Props) {
  const bust = useAssetBust(); // reload sprite previews when an asset is replaced in place
  const [mode, setMode] = useState<Mode>("list");
  const [selected, setSelected] = useState<Character | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewDefaultSprite, setPreviewDefaultSprite] = useState<AssetRef | null>(null);
  const [previewPoseKey, setPreviewPoseKey] = useState<string | null>(null);
  const [addPendingSprites, setAddPendingSprites] = useState<Record<string, AssetRef> | null>(null);
  const [editPendingSprites, setEditPendingSprites] = useState<Record<string, AssetRef> | null>(null);
  const [posesManagerKey, setPosesManagerKey] = useState(0);

  const goList = () => {
    setSelected(null);
    setMode("list");
    setPreviewDefaultSprite(null);
    setPreviewPoseKey(null);
    setAddPendingSprites(null);
    onEditingCharacter?.(false);
  };

  const goEdit = (c: Character) => {
    setSelected(c);
    setMode("edit");
    setPreviewDefaultSprite(null);
    setPreviewPoseKey(null);
    setAddPendingSprites(null);
    setEditPendingSprites(null);
    onEditingCharacter?.(true);
  };

  const goAdd = () => {
    setSelected(null);
    setMode("add");
    setPreviewDefaultSprite(null);
    setPreviewPoseKey(null);
    setAddPendingSprites(null);
    onEditingCharacter?.(true);
  };

  const drawerSprites = selected
    ? editPendingSprites ?? {
        ...selected.sprites,
        ...(previewDefaultSprite ? { default: previewDefaultSprite } : {}),
      }
    : {};

  // ── Add mode ────────────────────────────────────────────────────────────────
  if (mode === "add") {
    const showAddDrawer = addPendingSprites !== null && Object.keys(addPendingSprites).length > 0;
    return (
      <>
        <CharacterBasicForm
          storyId={storyId}
          characters={characters}
          onSaved={() => { onRefresh(); goList(); }}
          onCancel={goList}
          onSpritesChange={setAddPendingSprites}
        />
        {showAddDrawer && (
          <CharacterPosesDrawer
            characterName="Nouveau personnage"
            sprites={addPendingSprites}
          />
        )}
      </>
    );
  }

  // ── Edit mode ───────────────────────────────────────────────────────────────
  if (mode === "edit" && selected) {
    return (
      <>
        <div
          className="fixed left-[36rem] inset-y-0 right-0 bg-black/50 backdrop-blur-sm z-20 cursor-pointer"
          onClick={goList}
        />
        {confirmDelete && (
          <ConfirmModal
            message={`Supprimer "${selected.name}" ? Cette action est irréversible.`}
            onConfirm={async () => {
              await api.characters.delete(storyId, selected.id);
              setConfirmDelete(false);
              goList();
              onRefresh();
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
              setEditPendingSprites(null);
              setPosesManagerKey(k => k + 1);
              onRefresh();
            }}
            onCancel={goList}
            onDelete={() => setConfirmDelete(true)}
            onPreviewAsset={setPreviewDefaultSprite}
            onSpritesChange={setEditPendingSprites}
          />

          <div className="border-t border-white/10 pt-2">
            <div className="text-xs font-semibold text-subtle uppercase tracking-wide mb-3">
              Poses
            </div>
            <CharacterPosesManager
              key={posesManagerKey}
              storyId={storyId}
              character={selected}
              onSaved={(c) => {
                setSelected(c);
                onRefresh();
              }}
              onBack={goList}
              onPoseSelect={setPreviewPoseKey}
              showHeader={false}
            />
          </div>
        </div>

        <CharacterPosesDrawer
          characterName={selected.name}
          sprites={drawerSprites}
          highlightKey={previewPoseKey ?? undefined}
        />
      </>
    );
  }

  // ── List mode ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {characters.length === 0 ? (
        <p className="text-center text-subtle text-xs py-4">
          Aucun personnage. Ajoutez-en un ci-dessous.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map((c) => {
            const firstSprite = Object.values(c.sprites)[0];
            return (
              <button
                key={c.id}
                onClick={() => goEdit(c)}
                className="flex items-center gap-3 bg-elevated hover:bg-raised rounded-md px-3 py-2 border border-white/7 hover:border-white/15 transition-colors text-left w-full group"
              >
                {firstSprite ? (
                  <img
                    src={resolveAsset(firstSprite, bust)}
                    alt={c.name}
                    className="w-10 h-12 object-contain rounded bg-raised flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                ) : (
                  <div className="w-10 h-12 rounded bg-raised flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-fore truncate">{c.name}</span>
                </div>
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color ?? "#aaaaaa" }}
                />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={goAdd}
        className="w-full py-2 rounded border border-dashed border-white/10 hover:border-white/25 text-muted hover:text-fore text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un personnage
      </button>
    </div>
  );
}
