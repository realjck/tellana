"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Character, Scene, Story } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";

type Params = Promise<{ id: string; sceneId: string }>;

export default function ScenePlayPage({ params }: { params: Params }) {
  const { id, sceneId: sceneIdStr } = use(params);
  const storyId = Number(id);
  const sceneId = Number(sceneIdStr);

  const { data: scene, isLoading: sceneLoading } = useSWR<Scene>(
    `scene-play-${sceneId}`,
    () => api.scenes.get(storyId, sceneId)
  );

  const { data: story } = useSWR<Story>(
    `story-play-${storyId}`,
    () => api.stories.get(storyId)
  );

  if (sceneLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-slate-400">
        Scène introuvable.
      </div>
    );
  }

  const allCharacters = story?.characters ?? [];
  const sceneCharacters: Character[] = scene.character_ids
    .map((cid) => allCharacters.find((c) => c.id === cid))
    .filter((c): c is Character => !!c);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Link
          href={`/stories/${storyId}/scenes/${sceneId}/edit`}
          className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-white/70 hover:text-white text-sm transition-colors backdrop-blur-sm border border-white/10 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;éditeur
        </Link>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <span className="px-3 py-1.5 rounded-lg bg-black/50 text-white/60 text-sm backdrop-blur-sm border border-white/10">
          {story?.title} — {scene.title}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {scene.nodes.length > 0 ? (
          <div className="w-full max-w-4xl">
            <ScenePlayer
              nodes={scene.nodes}
              characters={sceneCharacters}
              backgroundAsset={scene.background_asset}
              backgroundLoop={scene.background_loop}
              onEnd={() => {}}
            />
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <p className="text-lg mb-4">Cette scène n&apos;a aucun contenu.</p>
            <Link
              href={`/stories/${storyId}/scenes/${sceneId}/edit`}
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
