"use client";

import type { Character, CharacterPosition } from "@/types";
import { resolveAsset } from "@/lib/api";

interface Props {
  allCharacters: Character[];
  selectedIds: number[];
  characterPositions: Record<string, CharacterPosition>;
  selectedCharId: number | null;
  onChange: (ids: number[], positions: Record<string, CharacterPosition>) => void;
  onSelectCharacter: (id: number | null) => void;
  onReorder: (newIds: number[]) => void;
}

const MAX = 4;

export default function SceneCharacterSelector({
  allCharacters,
  selectedIds,
  characterPositions,
  selectedCharId,
  onChange,
  onSelectCharacter,
  onReorder,
}: Props) {
  const selectedChars = selectedIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  const availableChars = allCharacters.filter((c) => !selectedIds.includes(c.id));

  const add = (id: number) => {
    if (selectedIds.length >= MAX) return;
    const newIds = [...selectedIds, id];
    onChange(newIds, characterPositions);
    onSelectCharacter(id);
  };

  const remove = (id: number) => {
    const newIds = selectedIds.filter((i) => i !== id);
    onChange(newIds, characterPositions);
    if (selectedCharId === id) onSelectCharacter(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...selectedIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    onReorder(newIds);
  };

  const moveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    const newIds = [...selectedIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    onReorder(newIds);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Characters in scene */}
      <div>
        <div className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">
          Dans la scène ({selectedIds.length}/{MAX})
        </div>
        {selectedChars.length === 0 ? (
          <p className="text-xs text-subtle py-3 text-center">
            Aucun personnage. Ajoutez-en un ci-dessous.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedChars.map((c, index) => {
              const firstSprite = Object.values(c.sprites)[0];
              const isActive = selectedCharId === c.id;
              return (
                <div
                  key={c.id}
                  className={`rounded-md border overflow-hidden transition-colors ${
                    isActive
                      ? "border-white/40 bg-white/8"
                      : "border-white/7 bg-elevated/60"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectCharacter(isActive ? null : c.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectCharacter(isActive ? null : c.id)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    {firstSprite && (
                      <img
                        src={resolveAsset(firstSprite)}
                        alt={c.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    )}
                    <span className={`flex-1 text-sm truncate ${isActive ? "text-fore font-medium" : "text-fore"}`}>
                      {c.name}
                    </span>

                    {/* Reorder arrows */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveUp(index); }}
                        disabled={index === 0}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-fore hover:bg-raised disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-[10px]"
                        title="Vers l'avant"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveDown(index); }}
                        disabled={index === selectedIds.length - 1}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-fore hover:bg-raised disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-[10px]"
                        title="Vers l'arrière"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                      className="p-1 text-muted hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available characters */}
      {availableChars.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-subtle uppercase tracking-wide mb-2">
            Disponibles
          </div>
          <div className="flex flex-col gap-1.5">
            {availableChars.map((c) => {
              const firstSprite = Object.values(c.sprites)[0];
              const atMax = selectedIds.length >= MAX;
              return (
                <button
                  key={c.id}
                  onClick={() => add(c.id)}
                  disabled={atMax}
                  className="flex items-center gap-2 bg-elevated/30 rounded-md px-3 py-2 border border-white/7 hover:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full text-left"
                >
                  {firstSprite && (
                    <img
                      src={resolveAsset(firstSprite)}
                      alt={c.name}
                      className="w-8 h-8 object-contain rounded"
                    />
                  )}
                  <span className="flex-1 text-sm text-fore/80 truncate">{c.name}</span>
                  <svg
                    className="w-4 h-4 text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
