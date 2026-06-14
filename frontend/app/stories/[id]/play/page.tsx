"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { GraphResponse, PublicStory } from "@/types";
import GraphPlayer from "@/components/GraphPlayer";

type Params = Promise<{ id: string }>;

export default function PlayPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);

  const { data: story, isLoading: storyLoading } = useSWR<PublicStory>(
    `story-play-full-${storyId}`,
    () => api.stories.getForPlay(storyId)
  );

  const { data: graph, isLoading: graphLoading } = useSWR<GraphResponse>(
    story ? `graph-play-${storyId}` : null,
    () => api.graph.get(storyId)
  );

  const isLoading = storyLoading || graphLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-400">
        Story introuvable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Link
          href={`/stories/${storyId}/canvas`}
          className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/70 hover:text-white text-sm transition-colors backdrop-blur-sm border border-white/10 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour au canvas
        </Link>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <span className="px-3 py-1.5 rounded-lg bg-black/50 text-white/60 text-sm backdrop-blur-sm border border-white/10">
          {story.title}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <GraphPlayer
            story={story}
            graph={graph ?? { nodes: [], edges: [] }}
            storyId={storyId}
          />
        </div>
      </div>
    </div>
  );
}
