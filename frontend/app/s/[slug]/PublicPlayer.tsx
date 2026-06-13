"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { GraphResponse, PublicStory } from "@/types";
import GraphPlayer from "@/components/GraphPlayer";

export default function PublicPlayer({ story }: { story: PublicStory }) {
  const { data: graph } = useSWR<GraphResponse>(
    `graph-public-${story.id}`,
    () => api.graph.get(story.id)
  );

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-blue-400" />
        <span className="text-white text-xs font-medium">Tellana</span>
      </div>

      <div className="w-full max-w-4xl">
        <h1 className="text-white/50 text-sm font-medium text-center mb-4">
          {story.title}
        </h1>

        <GraphPlayer
          story={story}
          graph={graph ?? { nodes: [], edges: [] }}
          storyId={story.id}
        />
      </div>
    </div>
  );
}
