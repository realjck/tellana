"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { AssetRef, Character, CharacterPosition } from "@/types";
import { resolveAsset } from "@/lib/api";
import { DEFAULT_POSITIONS, FALLBACK_POSITION } from "@/lib/scenePositions";

const BASE_W = 1920;
const BASE_H = 1080;

interface Props {
  backgroundAsset: AssetRef | null;
  characters: Character[];
  characterPositions: Record<string, CharacterPosition>;
  className?: string;
}

export default function ScenePreviewThumbnail({
  backgroundAsset,
  characters,
  characterPositions,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  const getCharPosition = (c: Character): CharacterPosition => {
    const stored = characterPositions[String(c.id)];
    if (stored) return stored;
    const idx = characters.findIndex((ch) => ch.id === c.id);
    return DEFAULT_POSITIONS[idx >= 0 ? idx : 0] ?? FALLBACK_POSITION;
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0 bg-slate-800"
          style={
            backgroundAsset
              ? {
                  backgroundImage: `url(${resolveAsset(backgroundAsset)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* Characters */}
        <div className="absolute inset-0 pointer-events-none">
          {characters.map((c) => {
            const pos = getCharPosition(c);
            const sprite = Object.values(c.sprites)[0];
            return (
              <img
                key={c.id}
                src={sprite ? resolveAsset(sprite) : ""}
                alt={c.name}
                className="absolute object-contain"
                style={{
                  height: "100%",
                  bottom: `calc(-10% + ${pos.y * 50}%)`,
                  left: `${((pos.x + 1) / 2) * 100}%`,
                  transform: `translateX(-50%) scale(${pos.scale}) scaleX(${pos.flip_x ? -1 : 1})`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
