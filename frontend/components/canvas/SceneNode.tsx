"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import type { AssetRef, Character, CharacterPosition } from "@/types";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";

interface SceneNodeData {
  title: string;
  backgroundAsset: AssetRef | null;
  characters: Character[];
  characterPositions: Record<string, CharacterPosition>;
  onRename: (title: string) => void;
  onDoubleClick?: () => void;
  selected: boolean;
}

export default function SceneNode({ data }: { data: SceneNodeData }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== data.title) {
      data.onRename(draft.trim());
    } else {
      setDraft(data.title);
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    if (data.selected) {
      e.stopPropagation();
      editTimerRef.current = setTimeout(() => {
        editTimerRef.current = null;
        setEditing(true);
      }, 250);
    }
  };

  const handleBodyDoubleClick = (e: React.MouseEvent) => {
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    e.stopPropagation();
    if (data.onDoubleClick) data.onDoubleClick();
  };

  return (
    <div
      className="bg-surface border border-white/15 rounded-lg overflow-hidden w-48 shadow-lg"
      onDoubleClick={handleBodyDoubleClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/40" />
      <ScenePreviewThumbnail
        backgroundAsset={data.backgroundAsset}
        characters={data.characters}
        characterPositions={data.characterPositions}
        className="w-full aspect-video"
      />
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(data.title); }
            }}
            className="bg-raised border border-white/20 rounded px-2 py-0.5 text-fore text-sm focus:outline-none w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-fore text-sm font-medium truncate max-w-[140px] cursor-text"
            onClick={handleTitleClick}
            title={data.selected ? "Cliquer pour renommer · Double-clic pour éditer" : "Double-clic pour éditer la scène"}
          >
            {data.title}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/40" />
    </div>
  );
}
