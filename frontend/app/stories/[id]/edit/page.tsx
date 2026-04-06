"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { use } from "react";
import { api, DEFAULT_BACKGROUNDS, API_BASE } from "@/lib/api";
import type { Story, StoryNode, NodeType } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";
import NodeForm from "@/components/NodeForm";
import CharacterManager from "@/components/CharacterManager";

type Params = Promise<{ id: string }>;

type Tab = "nodes" | "characters" | "background";

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  dialogue: "Dialogue",
  text: "Texte",
  quiz: "Quiz",
};
const NODE_TYPE_COLORS: Record<NodeType, string> = {
  dialogue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  text: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  quiz: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function EditorPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);
  const router = useRouter();

  const { data: story, mutate, isLoading } = useSWR<Story>(
    `story-${storyId}`,
    () => api.stories.get(storyId)
  );

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("nodes");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

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

  const nodes = story.nodes ?? [];
  const characters = story.characters ?? [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft !== story.title) {
      await api.stories.update(storyId, { title: titleDraft.trim() });
      mutate();
    }
    setEditingTitle(false);
  };

  const addNode = async (type: NodeType) => {
    const defaultData =
      type === "quiz"
        ? ({
            question: "",
            type: "qcu" as const,
            feedback: "",
            options: [
              { text: "", is_correct: true },
              { text: "", is_correct: false },
            ],
          } satisfies import("@/types").QuizNodeData)
        : ({ character_id: null, text: "" } satisfies import("@/types").DialogueNodeData);

    const node = await api.nodes.create(storyId, {
      type,
      data: defaultData,
      order: nodes.length,
    });
    await mutate();
    setSelectedNodeId(node.id);
    setPreviewIndex(nodes.length);
    setTab("nodes");
  };

  const saveNode = async (patch: Partial<StoryNode>) => {
    if (!selectedNodeId) return;
    await api.nodes.update(storyId, selectedNodeId, patch);
    await mutate();
  };

  const deleteNode = async () => {
    if (!selectedNodeId) return;
    await api.nodes.delete(storyId, selectedNodeId);
    setSelectedNodeId(null);
    await mutate();
  };

  const moveNode = async (nodeId: number, direction: "up" | "down") => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === nodes.length - 1) return;
    const newOrder = [...nodes.map((n) => n.id)];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await api.nodes.reorder(storyId, newOrder);
    await mutate();
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

  const setBackground = async (url: string) => {
    await api.stories.update(storyId, { background_url: url });
    await mutate();
  };

  const uploadBackground = async (file: File) => {
    setUploadingBg(true);
    try {
      const url = await api.assets.upload(file);
      await setBackground(url);
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploadingBg(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0b1120] flex flex-col">
      {/* Top bar */}
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

          {/* Title */}
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
              onClick={() => {
                setTitleDraft(story.title);
                setEditingTitle(true);
              }}
              className="text-white font-semibold hover:text-blue-300 transition-colors text-sm flex items-center gap-1.5"
            >
              {story.title}
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/stories/${storyId}/play`}
              target="_blank"
              className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5l10 7-10 7V5z" />
              </svg>
              Prévisualiser
            </Link>
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                story.published
                  ? "bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-300"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {publishing
                ? "…"
                : story.published
                ? "Dépublier"
                : "Publier"}
            </button>
            {story.published && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/s/${story.slug}`;
                  navigator.clipboard.writeText(url);
                  alert("Lien copié !");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                title="Copier le lien public"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-[#0f172a] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            {(["nodes", "characters", "background"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
                  tab === t
                    ? "text-white border-b-2 border-blue-500"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "nodes" ? "Nœuds" : t === "characters" ? "Perso." : "Décor"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">
            {tab === "nodes" && (
              <NodesTab
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelect={(n) => {
                  setSelectedNodeId(n.id);
                  setPreviewIndex(nodes.findIndex((x) => x.id === n.id));
                }}
                onAdd={addNode}
                onMove={moveNode}
              />
            )}
            {tab === "characters" && (
              <CharacterManager
                storyId={storyId}
                characters={characters}
                onRefresh={() => mutate()}
              />
            )}
            {tab === "background" && (
              <BackgroundTab
                currentUrl={story.background_url}
                uploading={uploadingBg}
                fileRef={bgFileRef}
                onSelect={setBackground}
                onUpload={uploadBackground}
              />
            )}
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Scene preview */}
          <div className={`flex-shrink-0 p-4 bg-[#0b1120] ${tab === "nodes" ? "border-b border-white/5" : ""}`}>
            <div className="max-w-2xl mx-auto">
              {nodes.length > 0 || tab !== "nodes" ? (
                <ScenePlayer
                  nodes={nodes}
                  characters={characters}
                  backgroundUrl={story.background_url}
                  startIndex={tab === "nodes" ? previewIndex : 0}
                  key={`${tab}-${previewIndex}-${story.background_url}-${JSON.stringify(nodes)}-${JSON.stringify(characters)}`}
                  compact
                  onEnd={() => {}}
                  showMode={
                    tab === "characters" ? "characters-only"
                    : tab === "background" ? "background-only"
                    : undefined
                  }
                />
              ) : (
                <div
                  className="w-full bg-slate-800/40 border border-slate-700 rounded-xl flex items-center justify-center text-slate-500 text-sm"
                  style={{ aspectRatio: "16/9" }}
                >
                  Ajoutez des nœuds pour prévisualiser la scène
                </div>
              )}
            </div>
          </div>

          {/* Node editor form — only visible on the "nodes" tab */}
          {tab === "nodes" && (
          <div className="flex-1 overflow-y-auto p-6">
            {selectedNode ? (
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 text-xs text-slate-500 uppercase tracking-wide font-semibold">
                  Édition du nœud #{nodes.findIndex((n) => n.id === selectedNode.id) + 1}
                </div>
                <NodeForm
                  key={selectedNode.id}
                  node={selectedNode}
                  characters={characters}
                  onSave={saveNode}
                  onDelete={deleteNode}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Sélectionnez un nœud dans la liste pour l&apos;éditer
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Nodes Tab ──────────────────────────────────────────────────────────────

function NodesTab({
  nodes,
  selectedNodeId,
  onSelect,
  onAdd,
  onMove,
}: {
  nodes: StoryNode[];
  selectedNodeId: number | null;
  onSelect: (n: StoryNode) => void;
  onAdd: (type: NodeType) => void;
  onMove: (id: number, dir: "up" | "down") => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {/* Add button */}
      <div className="relative">
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="w-full py-2 rounded-lg border border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un nœud
        </button>
        {addOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-10 shadow-xl">
            {(["dialogue", "text", "quiz"] as NodeType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  onAdd(t);
                  setAddOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-700 transition-colors flex items-center gap-3"
              >
                <span className={`px-2 py-0.5 rounded text-xs border ${NODE_TYPE_COLORS[t]}`}>
                  {NODE_TYPE_LABELS[t]}
                </span>
                <span className="text-slate-300">
                  {t === "dialogue"
                    ? "Un personnage parle"
                    : t === "text"
                    ? "Texte narratif"
                    : "Question QCM/QCU"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Node list */}
      {nodes.length === 0 ? (
        <p className="text-center text-slate-500 text-xs py-6">
          Aucun nœud. Cliquez sur &quot;Ajouter&quot; pour commencer.
        </p>
      ) : (
        nodes.map((node, i) => (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(node)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(node)}
            className={`w-full text-left p-3 rounded-xl border transition-all group cursor-pointer ${
              selectedNodeId === node.id
                ? "bg-blue-600/10 border-blue-500/40"
                : "bg-slate-800/40 border-slate-700/50 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 font-mono w-5">{i + 1}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${NODE_TYPE_COLORS[node.type]}`}>
                {NODE_TYPE_LABELS[node.type]}
              </span>
              <div className="ml-auto hidden group-hover:flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onMove(node.id, "up"); }}
                  disabled={i === 0}
                  className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                >▲</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMove(node.id, "down"); }}
                  disabled={i === nodes.length - 1}
                  className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                >▼</button>
              </div>
            </div>
            <p className="text-xs text-slate-400 truncate pl-7">
              {node.type === "quiz"
                ? (node.data as { question: string }).question || "Question…"
                : (node.data as { text: string }).text || "…"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ── Background Tab ─────────────────────────────────────────────────────────

function BackgroundTab({
  currentUrl,
  uploading,
  fileRef,
  onSelect,
  onUpload,
}: {
  currentUrl: string | null;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (url: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
        Décors disponibles
      </div>

      {DEFAULT_BACKGROUNDS.map((bg) => (
        <button
          key={bg.url}
          onClick={() => onSelect(bg.url)}
          className={`relative rounded-xl overflow-hidden border-2 transition-all ${
            currentUrl === bg.url
              ? "border-blue-500"
              : "border-transparent hover:border-slate-500"
          }`}
        >
          <img
            src={bg.url}
            alt={bg.label}
            className="w-full h-24 object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">
            {bg.label}
          </div>
          {currentUrl === bg.url && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      ))}

      {/* Custom upload */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-4 rounded-xl border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white text-sm transition-colors flex flex-col items-center gap-2"
      >
        {uploading ? (
          "Upload en cours…"
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Uploader une image
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />

      {/* Current custom */}
      {currentUrl &&
        !DEFAULT_BACKGROUNDS.find((b) => b.url === currentUrl) && (
          <div className="rounded-xl overflow-hidden border-2 border-blue-500">
            <img src={currentUrl.startsWith("/uploads/") ? `${API_BASE}${currentUrl}` : currentUrl} alt="Décor actuel" className="w-full h-24 object-cover" />
            <div className="bg-blue-600/20 px-2 py-1 text-xs text-blue-300 text-center">
              Décor actuel (custom)
            </div>
          </div>
        )}
    </div>
  );
}
