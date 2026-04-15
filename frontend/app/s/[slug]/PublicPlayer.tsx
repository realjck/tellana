"use client";

import type { PublicStory } from "@/types";
import MultiScenePlayer from "@/components/MultiScenePlayer";

export default function PublicPlayer({ story }: { story: PublicStory }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Branding */}
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-400" />
        <span className="text-white text-xs font-medium">Tellana</span>
      </div>

      <div className="w-full max-w-4xl">
        {/* Title */}
        <h1 className="text-white/50 text-sm font-medium text-center mb-4">
          {story.title}
        </h1>

        <MultiScenePlayer
          scenes={story.scenes}
          characters={story.characters}
          title={story.title}
        />
      </div>
    </div>
  );
}
