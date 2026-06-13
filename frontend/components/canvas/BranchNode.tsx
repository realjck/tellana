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
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 min-w-[180px] shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-amber-200 text-sm font-medium truncate max-w-[150px]">
          {data.title || <span className="text-amber-400/50 italic">Embranchement</span>}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mb-1">
        {choices.map((c) => (
          <div key={c.id} className="text-amber-100/70 text-xs truncate max-w-[150px]">
            {c.label}
          </div>
        ))}
      </div>
      {choices.map((c, i) => (
        <Handle
          key={c.id}
          type="source"
          position={Position.Bottom}
          id={c.id}
          style={{ left: `${((i + 1) / (n + 1)) * 100}%` }}
          className="!bg-amber-400"
        />
      ))}
    </div>
  );
}
