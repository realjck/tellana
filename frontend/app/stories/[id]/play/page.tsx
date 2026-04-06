"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Story } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";

type Params = Promise<{ id: string }>;

export default function PlayPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);
  const router = useRouter();

  const { data: story, isLoading } = useSWR<Story>(
    `story-play-${storyId}`,
    () => api.stories.get(storyId)
  );

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
      {/* Minimal header */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Link
          href={`/stories/${storyId}/edit`}
          className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/70 hover:text-white text-sm transition-colors backdrop-blur-sm border border-white/10 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;éditeur
        </Link>
      </div>

      {/* Story title */}
      <div className="absolute top-4 right-4 z-20">
        <span className="px-3 py-1.5 rounded-lg bg-black/50 text-white/60 text-sm backdrop-blur-sm border border-white/10">
          {story.title}
        </span>
      </div>

      {/* Scene */}
      <div className="flex-1 flex items-center justify-center p-4">
        {story.nodes.length > 0 ? (
          <div className="w-full max-w-4xl">
            <ScenePlayer
              nodes={story.nodes}
              characters={story.characters}
              backgroundUrl={story.background_url}
              onEnd={() => {
                // Show end screen
              }}
            />
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <p className="text-lg mb-4">Cette story n&apos;a aucun contenu.</p>
            <Link
              href={`/stories/${storyId}/edit`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Aller dans l&apos;éditeur
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
