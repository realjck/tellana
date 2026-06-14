"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";

type EndType = "good" | "bad" | "neutral";

const END_COLORS: Record<EndType, string> = {
  good: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  bad: "bg-red-500/15 border-red-500/40 text-red-300",
  neutral: "bg-slate-500/15 border-slate-500/30 text-slate-300",
};

const END_BADGES: Record<EndType, string> = {
  good: "bg-emerald-500/30 text-emerald-200",
  bad: "bg-red-500/30 text-red-200",
  neutral: "bg-slate-500/30 text-slate-200",
};

interface EndNodeData {
  type: EndType;
  title: string;
  onRename: (title: string) => void;
  selected: boolean;
}

export default function EndNode({ data }: { data: EndNodeData }) {
  const endType: EndType = data.type ?? "neutral";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const val = draft.trim();
    if (val !== data.title) data.onRename(val);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    if (data.selected) {
      e.stopPropagation();
      setEditing(true);
    }
  };

  return (
    <div className={`border rounded-lg px-4 py-3 min-w-[160px] shadow-lg ${END_COLORS[endType]}`}>
      <Handle type="target" position={Position.Top} className="!bg-white/40 !w-4 !h-4" />
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${END_BADGES[endType]}`}>
          {endType === "good" ? "Bonne fin" : endType === "bad" ? "Mauvaise fin" : "Fin neutre"}
        </span>
      </div>
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
          placeholder="Titre de la fin…"
          className="bg-raised border border-white/20 rounded px-2 py-0.5 text-fore text-sm focus:outline-none w-full"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-sm font-medium truncate max-w-[140px] block cursor-text"
          onClick={handleTitleClick}
          title={data.selected ? "Cliquer pour renommer" : undefined}
        >
          {data.title || <span className="opacity-40 italic">Fin</span>}
        </span>
      )}
    </div>
  );
}
