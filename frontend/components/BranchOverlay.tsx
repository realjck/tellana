"use client";

import type { GraphEdge } from "@/types";

interface Props {
  edges: GraphEdge[];
  visitedEdgeIds: number[];
  onChoice: (edgeId: number, targetNodeId: number) => void;
}

export default function BranchOverlay({ edges, visitedEdgeIds, onChoice }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center player-branch-overlay">
      <div className="flex flex-col gap-3 w-full max-w-md px-8">
        {edges.map((edge) => {
          const visited = visitedEdgeIds.includes(edge.id);
          return (
            <button
              key={edge.id}
              onClick={() => onChoice(edge.id, edge.target_node_id)}
              className={`w-full px-6 py-3.5 rounded-md text-left text-base font-medium border cursor-pointer transition-all player-option ${visited ? "player-branch-option-visited" : ""}`}
            >
              {edge.label ?? `Choix ${edge.order + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
