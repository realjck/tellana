"use client";

import { Handle, Position } from "@xyflow/react";

export default function StartNode() {
  return (
    <div className="bg-emerald-600/20 border-2 border-emerald-500/60 rounded-lg px-4 py-2 min-w-[120px] text-center">
      <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Début</span>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </div>
  );
}
