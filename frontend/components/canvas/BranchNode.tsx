"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";

interface BranchNodeData {
  title: string | null;
  onRename: (title: string) => void;
  selected: boolean;
}

export default function BranchNode({ data }: { data: BranchNodeData }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const val = draft.trim();
    if (val !== (data.title ?? "")) {
      data.onRename(val);
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    if (data.selected) {
      e.stopPropagation();
      setEditing(true);
    }
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 min-w-[160px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setEditing(false); setDraft(data.title ?? ""); }
            }}
            placeholder="Titre…"
            className="bg-raised border border-white/20 rounded px-2 py-0.5 text-fore text-sm focus:outline-none w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-amber-200 text-sm font-medium truncate max-w-[140px] cursor-text"
            onClick={handleTitleClick}
            title={data.selected ? "Cliquer pour renommer" : undefined}
          >
            {data.title || <span className="text-amber-400/50 italic">Embranchement</span>}
          </span>
        )}
      </div>
      {/* 5 source handles stacked */}
      <Handle type="source" position={Position.Bottom} id="0" style={{ left: "10%" }} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} id="1" style={{ left: "30%" }} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} id="2" style={{ left: "50%" }} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} id="3" style={{ left: "70%" }} className="!bg-amber-400" />
      <Handle type="source" position={Position.Bottom} id="4" style={{ left: "90%" }} className="!bg-amber-400" />
    </div>
  );
}
