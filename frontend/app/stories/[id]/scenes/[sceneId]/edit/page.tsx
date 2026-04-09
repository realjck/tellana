"use client";

import { useState, useRef, useEffect, use, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { api, resolveAsset, DEFAULT_BACKGROUNDS, API_BASE } from "@/lib/api";
import type { AssetRef, CharacterPosition, Scene, Story, StoryNode, NodeType, DialogueNodeData, Character } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";
import NodeForm from "@/components/NodeForm";
import SceneCharacterSelector from "@/components/SceneCharacterSelector";

type Params = Promise<{ id: string; sceneId: string }>;

type Tab = "nodes" | "perso" | "background";

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

export default function SceneEditorPage({ params }: { params: Params }) {
  const { id, sceneId: sceneIdStr } = use(params);
  const storyId = Number(id);
  const sceneId = Number(sceneIdStr);
  const searchParams = useSearchParams();
  const initialTab = useMemo(
    () => (searchParams.get("tab") as Tab | null) ?? "nodes",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { data: scene, mutate: mutateScene, isLoading: sceneLoading } = useSWR<Scene>(
    `scene-${sceneId}`,
    () => api.scenes.get(storyId, sceneId)
  );

  const { data: story, mutate: mutateStory } = useSWR<Story>(
    `story-${storyId}`,
    () => api.stories.get(storyId)
  );

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [previewPatch, setPreviewPatch] = useState<{ type: NodeType; data: Record<string, unknown> } | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [bgCustomUploads, setBgCustomUploads] = useState<string[]>([]);
  const bgCustomInitialized = useRef(false);
  // Local character positions for real-time preview (no API call on every drag)
  const [localPositions, setLocalPositions] = useState<Record<string, CharacterPosition>>({});
  const positionsInitialized = useRef(false);

  useEffect(() => {
    if (!bgCustomInitialized.current && scene) {
      bgCustomInitialized.current = true;
      setBgCustomUploads(scene.bg_custom_uploads ?? []);
    }
    if (!positionsInitialized.current && scene) {
      positionsInitialized.current = true;
      setLocalPositions(scene.character_positions ?? {});
    }
  }, [scene]);

  if (sceneLoading) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }
  if (!scene) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-slate-400">
        Scène introuvable.{" "}
        <Link href={`/stories/${storyId}`} className="text-blue-400 ml-2">
          Retour
        </Link>
      </div>
    );
  }

  const nodes = scene.nodes ?? [];
  const allCharacters = story?.characters ?? [];
  // ScenePlayer receives only scene-assigned characters, ordered by character_ids
  const sceneCharacters: Character[] = scene.character_ids
    .map((cid) => allCharacters.find((c) => c.id === cid))
    .filter((c): c is Character => !!c);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  // Nodes with live preview patch applied to the selected node (no API call)
  const previewNodes = previewPatch && selectedNodeId !== null
    ? nodes.map((n) => n.id === selectedNodeId ? { ...n, type: previewPatch.type, data: previewPatch.data as unknown as StoryNode["data"] } : n)
    : nodes;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const addNode = async () => {
    const defaultData: DialogueNodeData = { character_id: null, text: "" };
    const node = await api.nodes.create(storyId, sceneId, {
      type: "dialogue",
      data: defaultData,
      order: nodes.length,
    });

    // Reorder: insert right after the currently selected node
    if (selectedNodeId !== null && nodes.length > 0) {
      const afterIndex = nodes.findIndex((n) => n.id === selectedNodeId);
      if (afterIndex >= 0) {
        const existingIds = nodes.map((n) => n.id);
        const newOrder = [
          ...existingIds.slice(0, afterIndex + 1),
          node.id,
          ...existingIds.slice(afterIndex + 1),
        ];
        await api.nodes.reorder(storyId, sceneId, newOrder);
      }
    }

    const refreshed = await mutateScene();
    const newNodes = refreshed?.nodes ?? [];
    const newIndex = newNodes.findIndex((n) => n.id === node.id);
    setSelectedNodeId(node.id);
    setPreviewIndex(newIndex >= 0 ? newIndex : newNodes.length - 1);
    setTab("nodes");
  };

  const saveNode = async (patch: Partial<StoryNode>) => {
    if (!selectedNodeId) return;
    await api.nodes.update(storyId, sceneId, selectedNodeId, patch);
    await mutateScene();
  };

  const deleteNode = async () => {
    if (!selectedNodeId) return;
    await api.nodes.delete(storyId, sceneId, selectedNodeId);
    setSelectedNodeId(null);
    await mutateScene();
  };

  const moveNode = async (nodeId: number, direction: "up" | "down") => {
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === nodes.length - 1) return;
    const newOrder = [...nodes.map((n) => n.id)];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await api.nodes.reorder(storyId, sceneId, newOrder);
    await mutateScene();
  };

  const setBackground = async (asset: AssetRef | null) => {
    await api.scenes.update(storyId, sceneId, { background_asset: asset ?? undefined });
    await mutateScene();
  };

  const persistBgCustomUploads = async (uploads: string[]) => {
    await api.scenes.update(storyId, sceneId, { bg_custom_uploads: uploads });
  };

  const uploadBackground = async (file: File) => {
    setUploadingBg(true);
    try {
      const ref = await api.assets.upload(file);
      const url = ref.url!;
      const next = bgCustomUploads.includes(url) ? bgCustomUploads : [...bgCustomUploads, url];
      setBgCustomUploads(next);
      await persistBgCustomUploads(next);
      await setBackground(ref);
    } catch {
      alert("Échec de l'upload");
    } finally {
      setUploadingBg(false);
    }
  };

  const removeBgCustom = async (url: string) => {
    const next = bgCustomUploads.filter((u) => u !== url);
    setBgCustomUploads(next);
    await persistBgCustomUploads(next);
    const currentUrl = scene.background_asset?.url;
    if (currentUrl === url) {
      const fallback = DEFAULT_BACKGROUNDS[0];
      await setBackground({ type: "local", url: fallback.url, opfs_key: null, job_id: null, mime_type: null, width: null, height: null });
    }
  };

  const updateCharacters = async (ids: number[], positions: Record<string, CharacterPosition>) => {
    setLocalPositions(positions);
    await api.scenes.update(storyId, sceneId, { character_ids: ids, character_positions: positions });
    await mutateScene();
  };

  const handlePositionChange = (charId: number, pos: CharacterPosition) => {
    setLocalPositions((prev) => ({ ...prev, [String(charId)]: pos }));
  };

  const saveSceneTitle = async () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== scene.title) {
      await api.scenes.update(storyId, sceneId, { title: trimmed });
      await mutateScene();
    }
    setEditingTitle(false);
  };

  const handlePositionCommit = async (charId: number, pos: CharacterPosition) => {
    const newPositions = { ...localPositions, [String(charId)]: pos };
    setLocalPositions(newPositions);
    await api.scenes.update(storyId, sceneId, { character_positions: newPositions });
    await mutateScene();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0b1120] flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href={`/stories/${storyId}`}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors flex-shrink-0 flex items-center justify-center"
            title="Retour à la story"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{story?.title}</span>
            <span className="text-slate-600">/</span>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveSceneTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveSceneTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="bg-slate-700 border border-blue-500 rounded-lg px-3 py-1 text-white text-sm focus:outline-none max-w-48"
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(scene.title); setEditingTitle(true); }}
                className="text-white font-semibold hover:text-blue-300 transition-colors flex items-center gap-1.5"
              >
                {scene.title}
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/stories/${storyId}/scenes/${sceneId}/play`}
              target="_blank"
              className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5l10 7-10 7V5z" />
              </svg>
              Prévisualiser
            </Link>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-[#0f172a] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            {(["nodes", "perso", "background"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
                  tab === t
                    ? "text-white border-b-2 border-blue-500"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "nodes" ? "Script" : t === "perso" ? "Perso." : "Décor"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">
            {tab === "nodes" && (
              <NodesTab
                nodes={nodes}
                characters={allCharacters}
                selectedNodeId={selectedNodeId}
                onSelect={(n) => {
                  setSelectedNodeId(n.id);
                  setPreviewPatch(null);
                  setPreviewIndex(nodes.findIndex((x) => x.id === n.id));
                }}
                onAdd={addNode}
                onMove={moveNode}
              />

            )}
            {tab === "perso" && (
              <SceneCharacterSelector
                allCharacters={allCharacters}
                selectedIds={scene.character_ids}
                characterPositions={localPositions}
                onChange={updateCharacters}
                onPositionChange={handlePositionChange}
                onPositionCommit={handlePositionCommit}
              />
            )}
            {tab === "background" && (
              <BackgroundTab
                currentAsset={scene.background_asset}
                uploading={uploadingBg}
                fileRef={bgFileRef}
                onSelect={setBackground}
                onUpload={uploadBackground}
                customUploads={bgCustomUploads}
                onRemoveCustom={removeBgCustom}
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
                  nodes={previewNodes}
                  characters={sceneCharacters}
                  characterPositions={localPositions}
                  backgroundAsset={scene.background_asset}
                  backgroundLoop={scene.background_loop}
                  startIndex={tab === "nodes" ? previewIndex : 0}
                  key={`${tab}-${sceneId}-${previewIndex}-${scene.background_asset?.url}-${JSON.stringify(nodes)}-${JSON.stringify(scene.character_ids)}`}
                  compact
                  onEnd={() => {}}
                  showMode={
                    tab === "perso" ? "characters-only"
                    : tab === "background" ? "background-only"
                    : undefined
                  }
                  onIndexChange={tab === "nodes" ? (idx) => {
                    setPreviewIndex(idx);
                    if (idx < nodes.length) setSelectedNodeId(nodes[idx].id);
                  } : undefined}
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

          {/* Node editor form */}
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
                    characters={sceneCharacters}
                    onSave={saveNode}
                    onDelete={deleteNode}
                    onPreview={(type, data) => setPreviewPatch({ type, data })}
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
  characters,
  selectedNodeId,
  onSelect,
  onAdd,
  onMove,
}: {
  nodes: StoryNode[];
  characters: Character[];
  selectedNodeId: number | null;
  onSelect: (n: StoryNode) => void;
  onAdd: () => void;
  onMove: (id: number, dir: "up" | "down") => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onAdd}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un nœud
      </button>

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
            className={`w-full text-left px-3 rounded-xl border transition-all group cursor-pointer ${
              selectedNodeId === node.id
                ? "bg-blue-600/10 border-blue-500/40"
                : "bg-slate-800/40 border-slate-700/50 hover:border-slate-600"
            } ${node.type === "dialogue" ? "py-1.5" : "py-2 "}`}
          >
            {node.type === "dialogue" ? (
              /* ── Dialogue : single line, no label ── */
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-mono w-4 flex-shrink-0">{i + 1}</span>
                <p className="text-xs text-slate-400 truncate flex-1">
                  {(() => {
                    const d = node.data as { character_id: number | null; text: string };
                    const char = d.character_id ? characters.find((c) => c.id === d.character_id) : null;
                    return char
                      ? <><span className="font-semibold text-slate-300">{char.name}</span>{" : "}{d.text || "…"}</>
                      : d.text || "…";
                  })()}
                </p>
                <div className="flex gap-1 invisible group-hover:visible flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "up"); }} disabled={i === 0}
                    className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-slate-400 hover:text-white transition-colors flex items-center justify-center text-[10px]">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "down"); }} disabled={i === nodes.length - 1}
                    className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-slate-400 hover:text-white transition-colors flex items-center justify-center text-[10px]">▼</button>
                </div>
              </div>
            ) : (
              /* ── Other types : label + text on second line ── */
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs text-slate-500 font-mono w-4">{i + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${NODE_TYPE_COLORS[node.type]}`}>
                    {NODE_TYPE_LABELS[node.type]}
                  </span>
                  <div className="ml-auto flex gap-1 invisible group-hover:visible">
                    <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "up"); }} disabled={i === 0}
                      className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-slate-400 hover:text-white transition-colors flex items-center justify-center text-[10px]">▲</button>
                    <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "down"); }} disabled={i === nodes.length - 1}
                      className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-slate-400 hover:text-white transition-colors flex items-center justify-center text-[10px]">▼</button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 truncate pl-5.5">
                  {node.type === "quiz"
                    ? (node.data as { question: string }).question || "Question…"
                    : (node.data as { text: string }).text || "…"}
                </p>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Background Tab ─────────────────────────────────────────────────────────

function BackgroundTab({
  currentAsset,
  uploading,
  fileRef,
  onSelect,
  onUpload,
  customUploads,
  onRemoveCustom,
}: {
  currentAsset: AssetRef | null;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (asset: AssetRef | null) => void;
  onUpload: (file: File) => void;
  customUploads: string[];
  onRemoveCustom: (url: string) => void;
}) {
  const currentUrl = currentAsset?.url ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
        Décors disponibles
      </div>

      {DEFAULT_BACKGROUNDS.map((bg) => (
        <button
          key={bg.url}
          onClick={() =>
            onSelect({ type: "local", url: bg.url, opfs_key: null, job_id: null, mime_type: null, width: null, height: null })
          }
          className={`relative rounded-xl overflow-hidden border-2 transition-all ${
            currentUrl === bg.url ? "border-blue-500" : "border-transparent hover:border-slate-500"
          }`}
        >
          <img src={bg.url} alt={bg.label} className="w-full h-24 object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">{bg.label}</div>
          {currentUrl === bg.url && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      ))}

      {customUploads.map((url) => {
        const src = url.startsWith("/uploads/") ? `${API_BASE}${url}` : url;
        return (
          <div key={url} className="relative">
            <button
              onClick={() =>
                onSelect({ type: "upload", url, opfs_key: null, job_id: null, mime_type: null, width: null, height: null })
              }
              className={`relative w-full rounded-xl overflow-hidden border-2 transition-all ${
                currentUrl === url ? "border-blue-500" : "border-transparent hover:border-slate-500"
              }`}
            >
              <img src={src} alt="Décor importé" className="w-full h-24 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">Décor importé</div>
              {currentUrl === url && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
            <button
              onClick={() => onRemoveCustom(url)}
              className="absolute top-2 left-2 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors"
              title="Supprimer ce décor"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        );
      })}

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-4 rounded-xl border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white text-sm transition-colors flex flex-col items-center gap-2"
      >
        {uploading ? "Upload en cours…" : (
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
    </div>
  );
}
