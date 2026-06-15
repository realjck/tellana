"use client";

import { useEffect, useState } from "react";
import type { AssetRef } from "@/types";
import { resolveAsset } from "@/lib/api";

interface Props {
  characterName: string;
  sprites: Record<string, AssetRef>;
  highlightKey?: string;
}

export default function CharacterPosesDrawer({ characterName, sprites, highlightKey }: Props) {
  const poses = Object.entries(sprites);
  const [activeKey, setActiveKey] = useState<string>(poses[0]?.[0] ?? "default");

  // If the active key disappears (pose deleted), fall back to first available
  useEffect(() => {
    if (!sprites[activeKey] && poses.length > 0) {
      setActiveKey(poses[0][0]);
    }
  }, [sprites, activeKey, poses]);

  // Sync to external highlight (pose clicked/focused in manager)
  useEffect(() => {
    if (highlightKey && sprites[highlightKey]) {
      setActiveKey(highlightKey);
    }
  }, [highlightKey, sprites]);

  const activeRef = sprites[activeKey] ?? poses[0]?.[1];

  return (
    <div
      className="fixed left-72 top-0 h-full w-72 bg-bg border-r border-white/7 z-30 shadow-2xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/7 flex-shrink-0">
        <div className="text-[10px] text-subtle uppercase tracking-widest font-semibold mb-1">
          Aperçu
        </div>
        <div className="text-2xl font-bold text-fore truncate">{characterName}</div>
      </div>

      {/* Large sprite display */}
      <div className="flex-1 flex items-end justify-center overflow-hidden px-4 pt-4">
        {activeRef ? (
          <img
            key={activeKey + resolveAsset(activeRef)}
            src={resolveAsset(activeRef)}
            alt={activeKey}
            className="max-h-full w-auto object-contain"
            style={{ maxHeight: "calc(100% - 1rem)" }}
          />
        ) : (
          <p className="text-subtle text-xs pb-8">Aucun sprite</p>
        )}
      </div>

      {/* Pose selector tabs */}
      {poses.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/7 p-3">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {poses.map(([key, ref]) => {
              const isActive = activeKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveKey(key)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-md border-2 transition-all ${
                    isActive
                      ? "border-amber-500 bg-amber-900/20"
                      : "border-transparent hover:border-amber-700 hover:bg-amber-900/10"
                  }`}
                  title={key === "default" ? "Défaut" : key}
                >
                  <img
                    src={resolveAsset(ref)}
                    alt={key}
                    className="h-12 w-8 object-contain rounded"
                  />
                  <span className={`text-[9px] font-medium leading-none ${
                    isActive ? "text-amber-400" : "text-subtle"
                  }`}>
                    {key === "default" ? "défaut" : key}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
