"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, resolveAsset } from "@/lib/api";
import type { SceneSummary, Story } from "@/types";
import CharacterManager from "@/components/CharacterManager";
import ConfirmModal from "@/components/ConfirmModal";

type Params = Promise<{ id: string }>;

export default function StoryEditorPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);

  const { data: story, mutate, isLoading } = useSWR<Story>(
    `story-${storyId}`,
    () => api.stories.get(storyId)
  );

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<number | null>(null);
  const [addingScene, setAddingScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [creatingScene, setCreatingScene] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }
  if (!story) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-slate-400">
        Story introuvable.{" "}
        <Link href="/" className="text-blue-400 ml-2">
          Retour
        </Link>
      </div>
    );
  }

  const scenes = story.scenes ?? [];
  const characters = story.characters ?? [];

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft !== story.title) {
      await api.stories.update(storyId, { title: titleDraft.trim() });
      mutate();
    }
    setEditingTitle(false);
  };

  const togglePublish = async () => {
    setPublishing(true);
    try {
      await api.stories.update(storyId, { published: !story.published });
      await mutate();
    } finally {
      setPublishing(false);
    }
  };

  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSceneTitle.trim()) return;
    setCreatingScene(true);
    try {
      await api.scenes.create(storyId, newSceneTitle.trim());
      await mutate();
      setAddingScene(false);
      setNewSceneTitle("");
    } catch {
      alert("Erreur lors de la création");
    } finally {
      setCreatingScene(false);
    }
  };

  const deleteScene = async (sceneId: number) => {
    try {
      await api.scenes.delete(storyId, sceneId);
      await mutate();
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const moveScene = async (sceneId: number, direction: "up" | "down") => {
    const idx = scenes.findIndex((s) => s.id === sceneId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === scenes.length - 1) return;
    const newOrder = [...scenes.map((s) => s.id)];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await api.scenes.reorder(storyId, newOrder);
    await mutate();
  };

  return (
    <div className="min-h-screen bg-[#0b1120] flex flex-col">
      {confirmDeleteSceneId !== null && (
        <ConfirmModal
          message="Supprimer cette scène et tous ses nœuds ? Cette action est irréversible."
          onConfirm={() => { deleteScene(confirmDeleteSceneId); setConfirmDeleteSceneId(null); }}
          onCancel={() => setConfirmDeleteSceneId(null)}
        />
      )}
      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition-colors"
            title="Retour au dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="flex-1 bg-slate-700 border border-blue-500 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none max-w-sm"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(story.title); setEditingTitle(true); }}
              className="text-white font-semibold hover:text-blue-300 transition-colors text-sm flex items-center gap-1.5"
            >
              {story.title}
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                story.published
                  ? "bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-300"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {publishing ? "…" : story.published ? "Dépublier" : "Publier"}
            </button>
            {story.published && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/s/${story.slug}`;
                  navigator.clipboard.writeText(url);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  linkCopied
                    ? "bg-green-600/30 text-green-400 border border-green-500/40"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                }`}
                title="Copier le lien public"
              >
                {linkCopied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Characters */}
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-[#0f172a] flex flex-col overflow-hidden">
          <div className="border-b border-white/5 px-4 py-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Personnages
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <CharacterManager
              storyId={storyId}
              characters={characters}
              onRefresh={() => mutate()}
            />
          </div>
        </aside>

        {/* Main: Scenes list */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold text-lg">Scènes</h2>
              <button
                onClick={() => setAddingScene(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouvelle scène
              </button>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <div className="text-4xl mb-4">🎬</div>
                <p className="mb-1">Aucune scène pour l&apos;instant.</p>
                <p className="text-xs">Créez une scène pour commencer à éditer votre story.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {scenes.map((scene, i) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    index={i}
                    total={scenes.length}
                    storyId={storyId}
                    onMove={moveScene}
                    onDelete={() => setConfirmDeleteSceneId(scene.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add scene modal */}
      {addingScene && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold mb-4">Nouvelle scène</h3>
            <form onSubmit={handleAddScene} className="flex flex-col gap-4">
              <input
                autoFocus
                type="text"
                value={newSceneTitle}
                onChange={(e) => setNewSceneTitle(e.target.value)}
                placeholder="Titre de la scène…"
                className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setAddingScene(false); setNewSceneTitle(""); }}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingScene || !newSceneTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  {creatingScene ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scene Card ─────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  index,
  total,
  storyId,
  onMove,
  onDelete,
}: {
  scene: SceneSummary;
  index: number;
  total: number;
  storyId: number;
  onMove: (id: number, dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  const bg = scene.background_asset;
  const bgUrl = bg ? resolveAsset(bg) : null;

  return (
    <div className="flex gap-4 items-center bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all p-3">
      {/* Thumbnail */}
      {bgUrl ? (
        <div
          className="w-24 h-16 flex-shrink-0 rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      ) : (
        <div className="w-24 h-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">{index + 1}</span>
          <h3 className="text-white font-medium truncate">{scene.title}</h3>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove(scene.id, "up")}
            disabled={index === 0}
            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors text-xs"
          >
            ▲
          </button>
          <button
            onClick={() => onMove(scene.id, "down")}
            disabled={index === total - 1}
            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors text-xs"
          >
            ▼
          </button>
        </div>
        <Link
          href={`/stories/${storyId}/scenes/${scene.id}/edit`}
          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm font-medium transition-colors border border-blue-500/20"
        >
          Éditer
        </Link>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg bg-slate-700 hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition-colors"
          title="Supprimer la scène"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
