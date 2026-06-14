"use client";

import { Handle, Position } from "@xyflow/react";
import type { GraphChoice } from "@/types";

interface BranchNodeData {
  title: string;
  choices: GraphChoice[];
  selected: boolean;
}

export default function BranchNode({ data }: { data: BranchNodeData }) {
  const choices = data.choices ?? [];
  const n = choices.length;
  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 pt-3 pb-5 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-4 !h-4" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-amber-200 text-sm font-medium truncate max-w-[150px]">
          {data.title || <span className="text-amber-400/50 italic">Embranchement</span>}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mb-2">
        {choices.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 text-xs truncate max-w-[150px]">
            <span className="text-amber-400 font-mono text-[10px] flex-shrink-0 w-3">{i + 1}</span>
            <span className="text-amber-100/70 truncate">{c.label}</span>
          </div>
        ))}
      </div>
      {/* Numéros au-dessus des sorties */}
      <div className="relative h-4">
        {choices.map((c, i) => (
          <span
            key={c.id}
            className="absolute text-[10px] text-amber-300/70 font-mono -translate-x-1/2"
            style={{ left: `${((i + 1) / (n + 1)) * 100}%` }}
          >
            {i + 1}
          </span>
        ))}
      </div>
      {choices.map((c, i) => (
        <Handle
          key={c.id}
          type="source"
          position={Position.Bottom}
          id={c.id}
          style={{ left: `${((i + 1) / (n + 1)) * 100}%` }}
          className="!bg-amber-400 !w-4 !h-4"
        />
      ))}
    </div>
  );
}
