"use client";

import { useState } from "react";
import type { Story } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";

export default function PublicPlayer({ story }: { story: Story }) {
  const [ended, setEnded] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Branding */}
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-400" />
        <span className="text-white text-xs font-medium">Tellana</span>
      </div>

      <div className="w-full max-w-4xl">
        {/* Title */}
        <h1 className="text-white/60 text-sm font-medium text-center mb-4">
          {story.title}
        </h1>

        {ended ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="text-5xl">🎬</div>
            <p className="text-white text-xl font-semibold">Fin de la story</p>
            <p className="text-slate-400 text-sm">{story.title}</p>
            <button
              onClick={() => setEnded(false)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              Rejouer depuis le début
            </button>
            <div className="text-xs text-slate-600 mt-4">
              Créé avec{" "}
              <span className="text-slate-400">Tellana</span>
            </div>
          </div>
        ) : (
          <ScenePlayer
            nodes={story.nodes}
            characters={story.characters}
            backgroundUrl={story.background_url}
            onEnd={() => setEnded(true)}
          />
        )}
      </div>
    </div>
  );
}
