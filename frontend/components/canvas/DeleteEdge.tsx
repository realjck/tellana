"use client";

import { useRef, useState, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

export default function DeleteEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const showButton = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHovered(true);
  };

  const hideButton = () => {
    hideTimerRef.current = setTimeout(() => setHovered(false), 100);
  };

  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ edges: [{ id }] });
  }, [id, deleteElements]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {/* Zone de survol élargie */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={showButton}
        onMouseLeave={hideButton}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
            onMouseEnter={showButton}
            onMouseLeave={hideButton}
          >
            <button
              onClick={onDelete}
              className="w-5 h-5 bg-raised border border-white/20 rounded flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
