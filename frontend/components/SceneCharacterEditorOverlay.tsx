"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Character, CharacterPosition } from "@/types";
import { DEFAULT_POSITIONS, FALLBACK_POSITION } from "@/lib/scenePositions";

const BASE_W = 1920;
const BASE_H = 1080;
const DEFAULT_ASPECT = 0.5; // fallback portrait ratio (width/height)

const X_MIN = -1, X_MAX = 1;
const Y_MIN = -3, Y_MAX = 1;
const SCALE_MIN = 0.1, SCALE_MAX = 2.5;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** 8 handle positions: corners + midpoints, clockwise from top-left */
const HANDLES = [
  { x: -1, y: -1 }, // top-left
  { x:  0, y: -1 }, // top-center
  { x:  1, y: -1 }, // top-right
  { x:  1, y:  0 }, // middle-right
  { x:  1, y:  1 }, // bottom-right
  { x:  0, y:  1 }, // bottom-center
  { x: -1, y:  1 }, // bottom-left
  { x: -1, y:  0 }, // middle-left
];

function getCursorForHandle(hx: number, hy: number): string {
  if (hx === 0) return "ns-resize";
  if (hy === 0) return "ew-resize";
  if ((hx === -1 && hy === -1) || (hx === 1 && hy === 1)) return "nwse-resize";
  return "nesw-resize";
}

interface CharBounds {
  cx: number; // CSS pixels from left
  cy: number; // CSS pixels from top
  w: number;  // visual width in CSS pixels
  h: number;  // visual height in CSS pixels
}

function computeBounds(pos: CharacterPosition, asset: { width: number | null; height: number | null } | undefined, scale: number): CharBounds {
  const containerW = BASE_W * scale;
  const containerH = BASE_H * scale;

  const cx = ((pos.x + 1) / 2) * containerW;

  const aspect = (asset?.width && asset?.height) ? asset.width / asset.height : DEFAULT_ASPECT;
  const h = containerH * pos.scale;
  const w = aspect * containerH * pos.scale;

  // cy = transform-origin of the character img (center of the 1080px height, scale-invariant)
  // img top = (0.1 - y*0.5)*BASE_H → center = img_top + BASE_H/2 = (0.6 - y*0.5)*BASE_H
  const cy = (0.6 - pos.y * 0.5) * containerH;

  return { cx, cy, w, h };
}

interface Props {
  characters: Character[];
  characterPositions: Record<string, CharacterPosition>;
  selectedCharId: number | null;
  onCharacterSelect: (id: number | null) => void;
  onPositionChange: (charId: number, pos: CharacterPosition) => void;
  onPositionCommit: (charId: number, pos: CharacterPosition) => void;
}

type DragMode = "move" | "resize";

interface DragState {
  mode: DragMode;
  charId: number;
  startClientX: number;
  startClientY: number;
  startPos: CharacterPosition;
  currentPos: CharacterPosition; // tracks latest computed position for commit
  hasMoved: boolean;
  handleX?: number; // -1, 0, or 1
  handleY?: number;
  startDist?: number; // for resize: initial pointer distance from center
  cx?: number;       // center in viewport coords at drag start
  cy?: number;
}

export default function SceneCharacterEditorOverlay({
  characters,
  characterPositions,
  selectedCharId,
  onCharacterSelect,
  onPositionChange,
  onPositionCommit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<DragState | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setScale(el.getBoundingClientRect().width / BASE_W);
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / BASE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getPos = (charId: number): CharacterPosition => {
    const stored = characterPositions[String(charId)];
    if (stored) return stored;
    const slotIndex = characters.findIndex((ch) => ch.id === charId);
    return DEFAULT_POSITIONS[slotIndex >= 0 ? slotIndex : 0] ?? FALLBACK_POSITION;
  };

  // ── Pointer events ──────────────────────────────────────────────────────────

  const onMovePointerDown = (e: React.PointerEvent, charId: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onCharacterSelect(charId);
    const pos = getPos(charId);
    dragRef.current = {
      mode: "move",
      charId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: { ...pos },
      currentPos: { ...pos },
      hasMoved: false,
    };
  };

  const onHandlePointerDown = (
    e: React.PointerEvent,
    charId: number,
    hx: number,
    hy: number,
    bounds: CharBounds,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPos(charId);
    // Convert container-local bounds to viewport coords for consistent distance measurement
    const rect = containerRef.current!.getBoundingClientRect();
    const centerViewX = rect.left + bounds.cx;
    const centerViewY = rect.top + bounds.cy;
    const dx = e.clientX - centerViewX;
    const dy = e.clientY - centerViewY;
    const startDist = Math.sqrt(dx * dx + dy * dy) || 1;
    dragRef.current = {
      mode: "resize",
      charId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: { ...pos },
      currentPos: { ...pos },
      hasMoved: false,
      handleX: hx,
      handleY: hy,
      startDist,
      cx: centerViewX,
      cy: centerViewY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;

    const pos = { ...d.startPos };

    if (d.mode === "move") {
      const dClientX = e.clientX - d.startClientX;
      const dClientY = e.clientY - d.startClientY;
      pos.x = clamp(d.startPos.x + (dClientX / scale) / BASE_W * 2, X_MIN, X_MAX);
      pos.y = clamp(d.startPos.y - (dClientY / scale) / (BASE_H * 0.5), Y_MIN, Y_MAX);
    } else if (d.mode === "resize" && d.cx !== undefined && d.cy !== undefined && d.startDist) {
      const dx = e.clientX - d.cx;
      const dy = e.clientY - d.cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      pos.scale = clamp(d.startPos.scale * dist / d.startDist, SCALE_MIN, SCALE_MAX);
    }

    d.hasMoved = true;
    d.currentPos = pos;
    onPositionChange(d.charId, pos);
  };

  const onPointerUp = (_e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.hasMoved) onPositionCommit(d.charId, d.currentPos);
  };

  const onContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onCharacterSelect(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ overflow: "hidden" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onContainerClick}
    >
      {characters.map((c) => {
        const pos = getPos(c.id);
        const asset = Object.values(c.sprites)[0];
        const bounds = computeBounds(pos, asset, scale);
        const isSelected = selectedCharId === c.id;

        const boxStyle: React.CSSProperties = {
          position: "absolute",
          left: bounds.cx - bounds.w / 2,
          top: bounds.cy - bounds.h / 2,
          width: bounds.w,
          height: bounds.h,
        };

        return (
          <div key={c.id} style={boxStyle}>
            {/* Click zone for selection (only when not already selected) */}
            {!isSelected && (
              <div
                className="absolute inset-0 cursor-pointer"
                onPointerDown={(e) => onMovePointerDown(e, c.id)}
              />
            )}

            {/* Selection UI */}
            {isSelected && (
              <>
                {/* Dashed border */}
                <div
                  className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/90"
                  style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }}
                />

                {/* Drag zone (whole box) */}
                <div
                  className="absolute inset-0 cursor-move"
                  onPointerDown={(e) => onMovePointerDown(e, c.id)}
                />

                {/* 8 resize handles */}
                {HANDLES.map((h, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-white border-2 border-black/50 rounded-sm z-10"
                    style={{
                      left: `${(h.x + 1) / 2 * 100}%`,
                      top: `${(h.y + 1) / 2 * 100}%`,
                      transform: "translate(-50%, -50%)",
                      cursor: getCursorForHandle(h.x, h.y),
                    }}
                    onPointerDown={(e) => onHandlePointerDown(e, c.id, h.x, h.y, bounds)}
                  />
                ))}

                {/* Mirror button (center) */}
                <MirrorButton
                  flipX={pos.flip_x}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = { ...pos, flip_x: !pos.flip_x };
                    onPositionChange(c.id, next);
                    onPositionCommit(c.id, next);
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Mirror button ────────────────────────────────────────────────────────────

function MirrorButton({ flipX, onClick }: { flipX: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
      <button
        onClick={onClick}
        className="w-7 h-7 rounded-full flex items-center justify-center select-none transition-colors cursor-pointer text-white bg-black/65 border border-white/30 backdrop-blur-sm hover:bg-black/80"
        title={flipX ? "Retourner vers la droite" : "Retourner vers la gauche"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {flipX
            ? <path d="M5 12h14M13 6l6 6-6 6" />
            : <path d="M19 12H5M11 6L5 12l6 6" />
          }
        </svg>
      </button>
    </div>
  );
}
