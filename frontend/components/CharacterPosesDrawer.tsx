"use client";

import { useEffect, useState } from "react";
import type { AssetRef } from "@/types";
import { resolveAsset } from "@/lib/api";

interface Props {
  characterName: string;
  sprites: Record<string, AssetRef>;
}

export default function CharacterPosesDrawer({ characterName, sprites }: Props) {
  const poses = Object.entries(sprites);
  const [activeKey, setActiveKey] = useState<string>(poses[0]?.[0] ?? "default");

  // If the active key disappears (pose deleted), fall back to first available
  useEffect(() => {
    if (!sprites[activeKey] && poses.length > 0) {
      setActiveKey(poses[0][0]);
    }
  }, [sprites, activeKey, poses]);

  const activeRef = sprites[activeKey] ?? poses[0]?.[1];

  return (
    <div
      className="fixed left-72 top-0 h-full w-72 bg-[#0b1120] border-r border-slate-700/60 z-30 shadow-2xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/60 flex-shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">
          Aperçu
        </div>
        <div className="text-sm font-bold text-white truncate">{characterName}</div>
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
          <p className="text-slate-600 text-xs pb-8">Aucun sprite</p>
        )}
      </div>

      {/* Pose selector tabs */}
      {poses.length > 0 && (
        <div className="flex-shrink-0 border-t border-slate-700/60 p-3">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {poses.map(([key, ref]) => {
              const isActive = activeKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveKey(key)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${
                    isActive
                      ? "border-blue-500 bg-blue-900/20"
                      : "border-transparent hover:border-slate-600 hover:bg-slate-800/60"
                  }`}
                  title={key === "default" ? "Défaut" : key}
                >
                  <img
                    src={resolveAsset(ref)}
                    alt={key}
                    className="h-12 w-8 object-contain rounded"
                  />
                  <span className={`text-[9px] font-medium leading-none ${
                    isActive ? "text-blue-300" : "text-slate-500"
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
