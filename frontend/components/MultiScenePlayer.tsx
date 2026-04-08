"use client";

import { useState } from "react";
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

  if (!scenes.length) {
    return (
      <div
        className="w-full bg-slate-800/40 border border-slate-700 rounded-xl flex items-center justify-center text-slate-500 text-sm"
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
        {title && <p className="text-slate-400 text-sm">{title}</p>}
        <button
          onClick={() => { setSceneIndex(0); setEnded(false); }}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          Rejouer depuis le début
        </button>
        <div className="text-xs text-slate-600 mt-4">
          Créé avec <span className="text-slate-400">Tellana</span>
        </div>
      </div>
    );
  }

  const currentScene = scenes[sceneIndex];
  const sceneCharacters = currentScene.character_ids
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  return (
    <ScenePlayer
      key={currentScene.id}
      nodes={currentScene.nodes}
      characters={sceneCharacters}
      characterPositions={currentScene.character_positions}
      backgroundAsset={currentScene.background_asset}
      backgroundLoop={currentScene.background_loop}
      onEnd={() => {
        if (sceneIndex < scenes.length - 1) {
          setSceneIndex((i) => i + 1);
        } else {
          setEnded(true);
        }
      }}
    />
  );
}
