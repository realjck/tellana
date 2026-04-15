"use client";

import { useState } from "react";
import type { Character, CharacterPosition } from "@/types";
import { resolveAsset } from "@/lib/api";

// Default positions assigned when a character is added to the scene.
// Order matches the slot index (0-based).
const DEFAULT_POSITIONS: CharacterPosition[] = [
  { x: -0.35, y: 0, scale: 1, flip_x: false },
  { x:  0.35, y: 0, scale: 1, flip_x: true  },
  { x: -0.7,  y: 0, scale: 1, flip_x: false },
  { x:  0.7,  y: 0, scale: 1, flip_x: true  },
];

interface Props {
  allCharacters: Character[];
  selectedIds: number[];
  characterPositions: Record<string, CharacterPosition>;
  /** Called when the character list changes (add/remove). Positions are included
   *  so the parent can persist both fields in a single PATCH. */
  onChange: (ids: number[], positions: Record<string, CharacterPosition>) => void;
  /** Called on every slider/switch interaction for real-time preview (no API). */
  onPositionChange: (charId: number, pos: CharacterPosition) => void;
  /** Called when the user finishes dragging a slider (pointer up) to persist. */
  onPositionCommit: (charId: number, pos: CharacterPosition) => void;
}

const MAX = 4;

export default function SceneCharacterSelector({
  allCharacters,
  selectedIds,
  characterPositions,
  onChange,
  onPositionChange,
  onPositionCommit,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const selectedChars = selectedIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  const availableChars = allCharacters.filter((c) => !selectedIds.includes(c.id));

  const add = (id: number) => {
    if (selectedIds.length >= MAX) return;
    const newIds = [...selectedIds, id];
    const defaultPos = DEFAULT_POSITIONS[selectedIds.length] ?? DEFAULT_POSITIONS[0];
    const newPositions = { ...characterPositions, [String(id)]: defaultPos };
    onChange(newIds, newPositions);
    setExpandedId(id);
  };

  const remove = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id), characterPositions);
    if (expandedId === id) setExpandedId(null);
  };

  const getPos = (charId: number, slotIndex: number): CharacterPosition =>
    characterPositions[String(charId)] ?? DEFAULT_POSITIONS[slotIndex] ?? DEFAULT_POSITIONS[0];

  const updatePos = (charId: number, slotIndex: number, partial: Partial<CharacterPosition>) => {
    const current = getPos(charId, slotIndex);
    return { ...current, ...partial };
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
            {selectedChars.map((c, slotIndex) => {
              const firstSprite = Object.values(c.sprites)[0];
              const isExpanded = expandedId === c.id;
              const pos = getPos(c.id, slotIndex);

              return (
                <div key={c.id} className="rounded-md border border-white/7 overflow-hidden">
                  {/* Header row — click to expand/collapse */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    onKeyDown={(e) => e.key === "Enter" && setExpandedId(isExpanded ? null : c.id)}
                    className="flex items-center gap-2 bg-elevated/60 px-3 py-2 cursor-pointer hover:bg-elevated transition-colors select-none"
                  >
                    {firstSprite && (
                      <img
                        src={resolveAsset(firstSprite)}
                        alt={c.name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    )}
                    <span className="flex-1 text-sm text-fore truncate">{c.name}</span>
                    <svg
                      className={`w-3.5 h-3.5 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                      className="p-1 text-muted hover:text-red-400 transition-colors"
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

                  {/* Expanded: position controls */}
                  {isExpanded && (
                    <div className="px-3 py-3 bg-bg/60 border-t border-white/7 flex flex-col gap-3">
                      {/* Position X */}
                      <SliderRow
                        label="Pos. X"
                        min={-1} max={1} step={0.01}
                        value={pos.x}
                        display={pos.x.toFixed(2)}
                        onChange={(v) => {
                          const next = updatePos(c.id, slotIndex, { x: v });
                          onPositionChange(c.id, next);
                        }}
                        onCommit={(v) => {
                          const next = updatePos(c.id, slotIndex, { x: v });
                          onPositionCommit(c.id, next);
                        }}
                      />

                      {/* Position Y */}
                      <SliderRow
                        label="Pos. Y"
                        min={-3} max={1} step={0.01}
                        value={pos.y}
                        display={pos.y.toFixed(2)}
                        onChange={(v) => {
                          const next = updatePos(c.id, slotIndex, { y: v });
                          onPositionChange(c.id, next);
                        }}
                        onCommit={(v) => {
                          const next = updatePos(c.id, slotIndex, { y: v });
                          onPositionCommit(c.id, next);
                        }}
                      />

                      {/* Scale */}
                      <SliderRow
                        label="Échelle"
                        min={0.1} max={2.5} step={0.05}
                        value={pos.scale}
                        display={`${Math.round(pos.scale * 100)}%`}
                        onChange={(v) => {
                          const next = updatePos(c.id, slotIndex, { scale: v });
                          onPositionChange(c.id, next);
                        }}
                        onCommit={(v) => {
                          const next = updatePos(c.id, slotIndex, { scale: v });
                          onPositionCommit(c.id, next);
                        }}
                      />

                      {/* Flip X toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Orientation</span>
                        <div className="flex rounded overflow-hidden border border-white/10">
                          <button
                            onClick={() => {
                              const next = updatePos(c.id, slotIndex, { flip_x: false });
                              onPositionChange(c.id, next);
                              onPositionCommit(c.id, next);
                            }}
                            className={`px-3 py-1 text-xs transition-colors ${
                              !pos.flip_x
                                ? "bg-white/15 text-fore font-medium"
                                : "bg-elevated text-muted hover:bg-raised hover:text-fore"
                            }`}
                          >
                            → Droite
                          </button>
                          <button
                            onClick={() => {
                              const next = updatePos(c.id, slotIndex, { flip_x: true });
                              onPositionChange(c.id, next);
                              onPositionCommit(c.id, next);
                            }}
                            className={`px-3 py-1 text-xs transition-colors ${
                              pos.flip_x
                                ? "bg-white/15 text-fore font-medium"
                                : "bg-elevated text-muted hover:bg-raised hover:text-fore"
                            }`}
                          >
                            ← Gauche
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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

// ── Slider row ─────────────────────────────────────────────────────────────

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
  onCommit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs text-fore font-mono w-10 text-right">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-raised accent-white"
      />
    </div>
  );
}
