"use client";

import { useState, useEffect, useRef } from "react";
import type { Character, Scene } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";

interface Props {
  scenes: Scene[];
  characters: Character[];
  title?: string;
}

export default function MultiScenePlayer({ scenes, characters, title }: Props) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [ended, setEnded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!scenes.length) {
    return (
      <div
        className="w-full bg-elevated/40 border border-white/7 rounded-md flex items-center justify-center text-muted text-sm"
        style={{ aspectRatio: "16/9" }}
      >
        Aucune scène
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="text-5xl">🎬</div>
        <p className="text-white text-xl font-semibold">Fin de la story</p>
        {title && <p className="text-white/40 text-sm">{title}</p>}
        <button
          onClick={() => { setSceneIndex(0); setEnded(false); }}
          className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary-hover text-white cursor-pointer font-medium transition-colors"
        >
          Rejouer depuis le début
        </button>
        <div className="text-xs text-white/20 mt-4">
          Créé avec <span className="text-white/40">Tellana</span>
        </div>
      </div>
    );
  }

  const currentScene = scenes[sceneIndex];
  const sceneCharacters = currentScene.character_ids
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  return (
    <div ref={containerRef}>
      <ScenePlayer
        key={currentScene.id}
        nodes={currentScene.nodes}
        characters={sceneCharacters}
        characterPositions={currentScene.character_positions}
        backgroundAsset={currentScene.background_asset}
        backgroundLoop={currentScene.background_loop}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onEnd={() => {
          if (sceneIndex < scenes.length - 1) {
            setSceneIndex((i) => i + 1);
          } else {
            setEnded(true);
          }
        }}
      />
    </div>
  );
}
