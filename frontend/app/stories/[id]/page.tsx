"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, API_BASE } from "@/lib/api";
import type { Character, SceneSummary, Story } from "@/types";
import CharacterManager from "@/components/CharacterManager";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
import ConfirmModal from "@/components/ConfirmModal";
import AlertModal from "@/components/AlertModal";

type Params = Promise<{ id: string }>;

export default function StoryEditorPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);
  const router = useRouter();

  const { data: story, mutate, isLoading } = useSWR<Story>(
    `story-${storyId}`,
    () => api.stories.get(storyId)
  );

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<number | null>(null);
  const [addingScene, setAddingScene] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [creatingScene, setCreatingScene] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        Chargement…
      </div>
    );
  }
  if (!story) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        Story introuvable.{" "}
        <Link href="/" className="text-fore/60 hover:text-fore ml-2 transition-colors">
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

  const handleExportZip = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/stories/${storyId}/export-zip`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${story.slug}-standalone.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Erreur lors de l'export. Vérifiez que le player bundle est compilé (npm run build:player).");
    } finally {
      setExporting(false);
    }
  };

  const hasUnpublishedChanges =
    story.published &&
    story.published_at !== null &&
    new Date(story.updated_at) > new Date(story.published_at);

  const togglePublish = async () => {
    setPublishing(true);
    try {
      if (story.published && !hasUnpublishedChanges) {
        await api.stories.unpublish(storyId);
      } else {
        await api.stories.publish(storyId);
      }
      await mutate();
    } catch {
      setExportError(
        story.published && !hasUnpublishedChanges
          ? "Erreur lors de la dépublication."
          : "Erreur lors de la publication. Vérifiez que le player bundle est compilé (npm run build:player)."
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSceneTitle.trim()) return;
    setCreatingScene(true);
    try {
      const newScene = await api.scenes.create(storyId, newSceneTitle.trim());
      await mutate();
      setAddingScene(false);
      setNewSceneTitle("");
      router.push(`/stories/${storyId}/scenes/${newScene.id}/edit?tab=background`);
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
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {exportError && (
        <AlertModal message={exportError} onClose={() => setExportError(null)} />
      )}
      {confirmDeleteSceneId !== null && (
        <ConfirmModal
          message="Supprimer cette scène et tous ses nœuds ? Cette action est irréversible."
          onConfirm={() => { deleteScene(confirmDeleteSceneId); setConfirmDeleteSceneId(null); }}
          onCancel={() => setConfirmDeleteSceneId(null)}
        />
      )}
      {/* Header */}
      <header className="flex-shrink-0 border-b border-white/5 bg-sidebar/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className={`flex items-center gap-4 min-w-0 transition-opacity duration-200 ${editingCharacter ? "opacity-20 pointer-events-none select-none" : ""}`}>
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-raised hover:bg-elevated text-muted hover:text-fore transition-colors flex-shrink-0 flex items-center justify-center"
            title="Retour au dashboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-subtle uppercase tracking-wide font-medium leading-none mb-1">
              Éditer votre story
            </span>
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
                className="bg-raised border border-white/30 rounded px-3 py-1 text-fore text-lg font-bold focus:outline-none max-w-sm"
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(story.title); setEditingTitle(true); }}
                className="text-fore font-bold hover:text-fore/70 transition-colors text-lg flex items-center gap-1.5 truncate"
              >
                {story.title}
                <svg className="w-3.5 h-3.5 text-subtle flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/stories/${storyId}/canvas`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors"
              title="Ouvrir le canvas narratif"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Canvas
            </Link>
            <button
              onClick={handleExportZip}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors disabled:opacity-50"
              title="Export pour le web"
            >
              {exporting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span>Export web</span>
            </button>
            {hasUnpublishedChanges && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                title="Modifications non publiées"
              />
            )}
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                story.published && !hasUnpublishedChanges
                  ? "bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-300"
                  : "bg-primary hover:bg-primary-hover text-white cursor-pointer"
              }`}
            >
              {publishing ? "…" : hasUnpublishedChanges ? "Republier" : story.published ? "Dépublier" : "Publier"}
            </button>
            {story.published && (
              <a
                href={`${API_BASE}/published/${story.slug}/index.html`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors"
                title="Voir la page publique"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {story.published && (
              <button
                onClick={() => {
                  const url = `${API_BASE}/published/${story.slug}/index.html`;
                  navigator.clipboard.writeText(url);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  linkCopied
                    ? "bg-green-600/30 text-green-400 border border-green-500/40"
                    : "bg-raised hover:bg-elevated text-muted hover:text-fore"
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
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-sidebar flex flex-col overflow-hidden">
          <div className="border-b border-white/5 px-4 py-3">
            <div className="text-xs font-semibold text-subtle uppercase tracking-wide">
              Personnages
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <CharacterManager
              storyId={storyId}
              characters={characters}
              onRefresh={() => mutate()}
              onEditingCharacter={setEditingCharacter}
            />
          </div>
        </aside>

        {/* Main: Scenes list */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-fore font-semibold text-lg">Scènes</h2>
              <button
                onClick={() => setAddingScene(true)}
                className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white cursor-pointer text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouvelle scène
              </button>
            </div>

            {scenes.length === 0 ? (
              <div className="text-center py-16 text-subtle">
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
                    characters={characters}
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
          <div className="bg-elevated border border-white/10 rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-fore font-semibold mb-4">Nouvelle scène</h3>
            <form onSubmit={handleAddScene} className="flex flex-col gap-4">
              <input
                autoFocus
                type="text"
                value={newSceneTitle}
                onChange={(e) => setNewSceneTitle(e.target.value)}
                placeholder="Titre de la scène…"
                className="bg-raised border border-white/10 rounded px-4 py-3 text-fore placeholder-subtle focus:outline-none focus:border-white/30 transition-colors"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setAddingScene(false); setNewSceneTitle(""); }}
                  className="px-4 py-2 rounded bg-raised hover:bg-elevated text-muted hover:text-fore text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingScene || !newSceneTitle.trim()}
                  className="px-4 py-2 rounded bg-neutral-100 hover:bg-white disabled:opacity-40 text-zinc-900 text-sm font-medium transition-colors"
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
  characters,
  onMove,
  onDelete,
}: {
  scene: SceneSummary;
  index: number;
  total: number;
  storyId: number;
  characters: Character[];
  onMove: (id: number, dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  const router = useRouter();

  const sceneCharacters: Character[] = scene.character_ids
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);

  return (
    <div
      onClick={() => router.push(`/stories/${storyId}/scenes/${scene.id}/edit`)}
      className="flex gap-3 items-center bg-elevated/40 border border-white/7 rounded-lg overflow-hidden hover:border-white/15 transition-all p-3 cursor-pointer"
    >
      {/* Order arrows — left */}
      <div className="flex flex-col gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onMove(scene.id, "up")}
          disabled={index === 0}
          className="w-7 h-7 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-xs"
        >▲</button>
        <button
          onClick={() => onMove(scene.id, "down")}
          disabled={index === total - 1}
          className="w-7 h-7 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-xs"
        >▼</button>
      </div>

      {/* Thumbnail */}
      <ScenePreviewThumbnail
        backgroundAsset={scene.background_asset}
        characters={sceneCharacters}
        characterPositions={scene.character_positions}
        className="w-40 h-[90px] flex-shrink-0 rounded-md"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle font-mono">{index + 1}</span>
          <h3 className="text-fore font-medium truncate">{scene.title}</h3>
        </div>
      </div>

      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onDelete}
          className="p-2 rounded bg-raised hover:bg-red-900/40 text-muted hover:text-red-300 transition-colors cursor-pointer"
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
