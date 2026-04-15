"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { StorySummary, Character } from "@/types";
import ConfirmModal from "@/components/ConfirmModal";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";

const fetcher = () => api.stories.list();

export default function DashboardPage() {
  const router = useRouter();
  const { data: stories, mutate, isLoading } = useSWR("stories", fetcher);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const story = await api.stories.create(newTitle.trim());
      mutate();
      router.push(`/stories/${story.id}`);
    } catch {
      alert("Erreur lors de la création");
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.stories.delete(id);
      mutate();
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {confirmDeleteId !== null && (
        <ConfirmModal
          message="Supprimer cette story ? Cette action est irréversible."
          onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {/* Header */}
      <header className="border-b border-white/5 bg-sidebar/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-blue-400 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-fore leading-none">Tellana</div>
              <div className="text-[10px] text-subtle leading-none mt-0.5">Animated Web Scenes</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-fore mb-2">Mes Stories</h1>
          <p className="text-muted">Créez et gérez vos scènes interactives au format Visual Novel.</p>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} className="mb-8 flex gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la nouvelle story..."
            className="flex-1 bg-elevated/60 border border-white/7 rounded-md px-4 py-3 text-fore placeholder-subtle focus:outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="px-6 py-3 rounded-md bg-neutral-100 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-zinc-900 font-semibold transition-colors flex items-center gap-2"
          >
            {creating ? (
              <span className="opacity-60">Création…</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer
              </>
            )}
          </button>
        </form>

        {/* Stories grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-lg bg-elevated/40 animate-pulse" />
            ))}
          </div>
        ) : !stories?.length ? (
          <div className="text-center py-20 text-subtle">
            <div className="text-5xl mb-4">🎬</div>
            <p>Aucune story pour l&apos;instant. Créez-en une ci-dessus !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onDelete={() => setConfirmDeleteId(story.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StoryCard({
  story,
  onDelete,
}: {
  story: StorySummary;
  onDelete: () => void;
}) {
  const router = useRouter();

  const firstSceneChars: Character[] = story.first_scene_character_ids
    .map((id) => story.characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  return (
    <div
      onClick={() => router.push(`/stories/${story.id}`)}
      className="group relative bg-elevated/40 border border-white/7 rounded-lg overflow-hidden hover:border-white/15 transition-all hover:shadow-lg hover:shadow-black/30 cursor-pointer"
    >
      <ScenePreviewThumbnail
        backgroundAsset={story.first_scene_background}
        characters={firstSceneChars}
        characterPositions={story.first_scene_character_positions}
        className="w-full aspect-video"
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="font-semibold text-fore leading-tight">{story.title}</h2>
          {story.published && (
            <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
              Publié
            </span>
          )}
        </div>

        <p className="text-xs text-subtle mb-4">
          {new Date(story.updated_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {story.published && (
            <Link
              href={`/s/${story.slug}`}
              target="_blank"
              className="py-2 px-3 rounded bg-raised hover:bg-elevated/80 text-muted hover:text-fore text-sm transition-colors"
              title="Voir la page publique"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          )}
          <button
            onClick={onDelete}
            className="py-2 px-3 rounded bg-raised hover:bg-red-900/40 text-muted hover:text-red-300 text-sm transition-colors"
            title="Supprimer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
