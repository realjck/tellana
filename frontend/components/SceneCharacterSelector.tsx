"use client";

import type { Character } from "@/types";
import { resolveAsset } from "@/lib/api";

interface Props {
  allCharacters: Character[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const MAX = 4;

export default function SceneCharacterSelector({
  allCharacters,
  selectedIds,
  onChange,
}: Props) {
  const selectedChars = selectedIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  const availableChars = allCharacters.filter((c) => !selectedIds.includes(c.id));

  const add = (id: number) => {
    if (selectedIds.length >= MAX) return;
    onChange([...selectedIds, id]);
  };

  const remove = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...selectedIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Characters in scene */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Dans la scène ({selectedIds.length}/{MAX})
        </div>
        {selectedChars.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">
            Aucun personnage. Ajoutez-en un ci-dessous.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedChars.map((c, i) => {
              const firstSprite = Object.values(c.sprites)[0];
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/50"
                >
                  {firstSprite && (
                    <img
                      src={resolveAsset(firstSprite)}
                      alt={c.name}
                      className="w-8 h-8 object-contain rounded"
                    />
                  )}
                  <span className="flex-1 text-sm text-white truncate">{c.name}</span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={i === selectedIds.length - 1}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors text-xs"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
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
                  className="flex items-center gap-2 bg-slate-800/30 rounded-xl px-3 py-2 border border-slate-700/30 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full text-left"
                >
                  {firstSprite && (
                    <img
                      src={resolveAsset(firstSprite)}
                      alt={c.name}
                      className="w-8 h-8 object-contain rounded"
                    />
                  )}
                  <span className="flex-1 text-sm text-slate-300 truncate">{c.name}</span>
                  <svg
                    className="w-4 h-4 text-slate-500"
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
