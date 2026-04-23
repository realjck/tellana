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
import SceneCharacterEditorOverlay from "@/components/SceneCharacterEditorOverlay";

type Params = Promise<{ id: string; sceneId: string }>;

type Tab = "nodes" | "perso" | "background";

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  dialogue: "Dialogue",
  text: "Texte",
  quiz: "Quiz",
};
const NODE_TYPE_COLORS: Record<NodeType, string> = {
  dialogue: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
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
  const [autoSaving, setAutoSaving] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [bgCustomUploads, setBgCustomUploads] = useState<string[]>([]);
  const bgCustomInitialized = useRef(false);
  const [localPositions, setLocalPositions] = useState<Record<string, CharacterPosition>>({});
  const positionsInitialized = useRef(false);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);

  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [previewPct, setPreviewPct] = useState(() => {
    if (typeof window === "undefined") return 42;
    const saved = sessionStorage.getItem("editor-preview-pct");
    return saved ? Number(saved) : 42;
  });
  const dragState = useRef<{ startY: number; startPct: number } | null>(null);

  useEffect(() => {
    sessionStorage.setItem("editor-preview-pct", String(previewPct));
  }, [previewPct]);

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
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        Chargement…
      </div>
    );
  }
  if (!scene) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        Scène introuvable.{" "}
        <Link href={`/stories/${storyId}`} className="text-fore/60 hover:text-fore ml-2 transition-colors">
          Retour
        </Link>
      </div>
    );
  }

  const nodes = scene.nodes ?? [];
  const allCharacters = story?.characters ?? [];
  const sceneCharacters: Character[] = scene.character_ids
    .map((cid) => allCharacters.find((c) => c.id === cid))
    .filter((c): c is Character => !!c);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const previewNodes = previewPatch && selectedNodeId !== null
    ? nodes.map((n) => n.id === selectedNodeId ? { ...n, type: previewPatch.type, data: previewPatch.data as unknown as StoryNode["data"] } : n)
    : nodes;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const addNode = async (type: NodeType = "dialogue") => {
    let defaultData: StoryNode["data"];
    if (type === "dialogue") {
      const dialogueData: DialogueNodeData = { character_id: null, text: "" };
      if (selectedNode?.type === "dialogue") {
        const d = selectedNode.data as unknown as DialogueNodeData;
        if (d.sprite_keys) dialogueData.sprite_keys = d.sprite_keys;
      }
      defaultData = dialogueData as unknown as StoryNode["data"];
    } else if (type === "quiz") {
      defaultData = {
        question: "",
        type: "qcu",
        feedback: "",
        options: [
          { text: "", is_correct: true },
          { text: "", is_correct: false },
        ],
      } as unknown as StoryNode["data"];
    } else {
      defaultData = { text: "" } as unknown as StoryNode["data"];
    }
    const node = await api.nodes.create(storyId, sceneId, {
      type,
      data: defaultData,
      order: nodes.length,
    });

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
    setPreviewPatch(null);
    setPreviewIndex(newIndex >= 0 ? newIndex : newNodes.length - 1);
    setTab("nodes");
  };

  const saveNode = async (patch: Partial<StoryNode>) => {
    if (!selectedNodeId) return;
    setAutoSaving(true);
    try {
      await api.nodes.update(storyId, sceneId, selectedNodeId, patch);
      await mutateScene();
    } finally {
      setAutoSaving(false);
    }
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

  const handleCharacterReorder = async (newIds: number[]) => {
    await api.scenes.update(storyId, sceneId, { character_ids: newIds });
    await mutateScene();
  };

  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startPct: previewPct };
  };
  const onDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const containerH = mainAreaRef.current?.getBoundingClientRect().height ?? 1;
    const delta = e.clientY - dragState.current.startY;
    const newPct = Math.max(15, Math.min(82, dragState.current.startPct + (delta / containerH) * 100));
    setPreviewPct(newPct);
  };
  const onDividerPointerUp = () => {
    dragState.current = null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-white/5 bg-sidebar/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href={`/stories/${storyId}`}
            className="w-8 h-8 rounded-full bg-raised hover:bg-elevated text-muted hover:text-fore transition-colors flex-shrink-0 flex items-center justify-center"
            title="Retour à la story"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{story?.title}</span>
            <span className="text-subtle">/</span>
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
                className="bg-raised border border-white/30 rounded px-3 py-1 text-fore text-sm focus:outline-none max-w-48"
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(scene.title); setEditingTitle(true); }}
                className="text-fore font-semibold hover:text-fore/70 transition-colors flex items-center gap-1.5"
              >
                {scene.title}
                <svg className="w-3.5 h-3.5 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/stories/${storyId}/scenes/${sceneId}/play`}
              target="_blank"
              className="px-4 py-1.5 rounded bg-raised hover:bg-elevated text-fore/80 text-sm font-medium transition-colors flex items-center gap-2"
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
        <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-sidebar flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            {(["nodes", "perso", "background"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors capitalize ${
                  tab === t
                    ? "text-fore border-b-2 border-white/50"
                    : "text-subtle hover:text-muted"
                }`}
              >
                {t === "nodes" ? "Script" : t === "perso" ? "Perso." : "Décor"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
              <div className="flex-1 overflow-y-auto p-3">
                <SceneCharacterSelector
                  allCharacters={allCharacters}
                  selectedIds={scene.character_ids}
                  characterPositions={localPositions}
                  selectedCharId={selectedCharId}
                  onChange={updateCharacters}
                  onSelectCharacter={setSelectedCharId}
                  onReorder={handleCharacterReorder}
                />
              </div>
            )}
            {tab === "background" && (
              <div className="flex-1 overflow-y-auto p-3">
                <BackgroundTab
                  currentAsset={scene.background_asset}
                  uploading={uploadingBg}
                  fileRef={bgFileRef}
                  onSelect={setBackground}
                  onUpload={uploadBackground}
                  customUploads={bgCustomUploads}
                  onRemoveCustom={removeBgCustom}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Main area */}
        <div ref={mainAreaRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Scene preview */}
          <div
            className="bg-bg overflow-hidden flex items-center justify-center"
            style={tab === "nodes" ? { flexShrink: 0, height: `${previewPct}%` } : { flex: 1, padding: "1rem" }}
          >
            <div
              className={tab !== "nodes" ? "w-full max-w-2xl" : ""}
              style={tab === "nodes" ? { height: "100%", aspectRatio: "16/9", maxWidth: "100%" } : {}}
            >
              {nodes.length > 0 || tab !== "nodes" ? (
                <div className={tab === "perso" ? "relative" : ""}>
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
                      setPreviewPatch(null);
                      if (idx < nodes.length) setSelectedNodeId(nodes[idx].id);
                    } : undefined}
                  />
                  {tab === "perso" && (
                    <SceneCharacterEditorOverlay
                      characters={sceneCharacters}
                      characterPositions={localPositions}
                      selectedCharId={selectedCharId}
                      onCharacterSelect={setSelectedCharId}
                      onPositionChange={handlePositionChange}
                      onPositionCommit={handlePositionCommit}
                    />
                  )}
                </div>
              ) : (
                <div
                  className="w-full bg-elevated/40 border border-white/7 rounded-md flex items-center justify-center text-subtle text-sm"
                  style={{ aspectRatio: "16/9" }}
                >
                  Ajoutez des nœuds pour prévisualiser la scène
                </div>
              )}
            </div>
          </div>

          {/* Drag divider */}
          {tab === "nodes" && (
            <div
              className="flex-shrink-0 h-2 bg-transparent hover:bg-white/5 cursor-ns-resize flex items-center justify-center group select-none border-y border-white/5"
              onPointerDown={onDividerPointerDown}
              onPointerMove={onDividerPointerMove}
              onPointerUp={onDividerPointerUp}
            >
              <div className="flex gap-0.5">
                <div className="w-1 h-1 rounded-full bg-white/15 group-hover:bg-white/30 transition-colors" />
                <div className="w-1 h-1 rounded-full bg-white/15 group-hover:bg-white/30 transition-colors" />
                <div className="w-1 h-1 rounded-full bg-white/15 group-hover:bg-white/30 transition-colors" />
              </div>
            </div>
          )}

          {/* Node editor form */}
          {tab === "nodes" && (
            <div className="flex-1 overflow-y-auto p-6">
              {selectedNode ? (
                <div className="max-w-2xl mx-auto">
                  <div className="mb-4 flex items-center justify-between text-xs text-subtle uppercase tracking-wide font-semibold">
                    Édition du nœud #{nodes.findIndex((n) => n.id === selectedNode.id) + 1}
                    {autoSaving && (
                      <svg className="animate-spin w-3 h-3 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                  </div>
                  <NodeForm
                    key={selectedNode.id}
                    node={selectedNode}
                    characters={sceneCharacters}
                    onSave={saveNode}
                    onDelete={deleteNode}
                    onPreview={(type, data) => setPreviewPatch({ type, data })}
                    onAdd={() => addNode("dialogue")}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-subtle text-sm">
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
  onAdd: (type: NodeType) => void;
  onMove: (id: number, dir: "up" | "down") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const NODE_TYPE_OPTIONS: { type: NodeType; label: string; color: string }[] = [
    { type: "dialogue", label: "Dialogue", color: "text-zinc-300 hover:bg-raised" },
    { type: "text", label: "Texte narratif", color: "text-purple-300 hover:bg-purple-900/30" },
    { type: "quiz", label: "Quiz", color: "text-amber-300 hover:bg-amber-900/30" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Fixed button with submenu */}
      <div className="flex-shrink-0 p-3 pb-2 relative">
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-3 right-3 top-full mt-1 bg-elevated border border-white/10 rounded-md shadow-2xl z-20 overflow-hidden">
              {NODE_TYPE_OPTIONS.map(({ type, label, color }) => (
                <button
                  key={type}
                  onClick={() => { onAdd(type); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${color}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full py-2 rounded bg-primary hover:bg-primary-hover text-white cursor-pointer text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un nœud
        </button>
      </div>

      {/* Scrollable nodes list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
      {nodes.length === 0 ? (
        <p className="text-center text-subtle text-xs py-6">
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
            className={`w-full flex-shrink-0 text-left px-3 rounded-md border transition-all group cursor-pointer ${
              selectedNodeId === node.id
                ? "bg-white/8 border-white/20"
                : "bg-elevated/40 border-white/7 hover:border-white/15"
            } ${node.type === "dialogue" ? "py-1.5" : "py-2 "}`}
          >
            {node.type === "dialogue" ? (
              /* ── Dialogue : single line, no label ── */
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-subtle font-mono w-4 flex-shrink-0">{i + 1}</span>
                <p className="text-xs text-muted truncate flex-1">
                  {(() => {
                    const d = node.data as { character_id: number | null; text: string };
                    const char = d.character_id ? characters.find((c) => c.id === d.character_id) : null;
                    return char
                      ? <><span className="font-semibold text-fore/80">{char.name}</span>{" : "}{d.text || "…"}</>
                      : d.text || "…";
                  })()}
                </p>
                <div className="flex gap-1 invisible group-hover:visible flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "up"); }} disabled={i === 0}
                    className="w-6 h-6 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-[10px]">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "down"); }} disabled={i === nodes.length - 1}
                    className="w-6 h-6 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-[10px]">▼</button>
                </div>
              </div>
            ) : (
              /* ── Other types : label + text on second line ── */
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs text-subtle font-mono w-4">{i + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${NODE_TYPE_COLORS[node.type]}`}>
                    {NODE_TYPE_LABELS[node.type]}
                  </span>
                  <div className="ml-auto flex gap-1 invisible group-hover:visible">
                    <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "up"); }} disabled={i === 0}
                      className="w-6 h-6 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-[10px]">▲</button>
                    <button onClick={(e) => { e.stopPropagation(); onMove(node.id, "down"); }} disabled={i === nodes.length - 1}
                      className="w-6 h-6 rounded-full bg-raised hover:bg-elevated disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-muted hover:text-fore transition-colors flex items-center justify-center text-[10px]">▼</button>
                  </div>
                </div>
                <p className="text-xs text-muted truncate pl-5.5">
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
      <div className="text-xs font-semibold text-subtle uppercase tracking-wide mb-1">
        Décors disponibles
      </div>

      {DEFAULT_BACKGROUNDS.map((bg) => (
        <button
          key={bg.url}
          onClick={() =>
            onSelect({ type: "local", url: bg.url, opfs_key: null, job_id: null, mime_type: null, width: null, height: null })
          }
          className={`relative rounded-md overflow-hidden border-2 transition-all ${
            currentUrl === bg.url ? "border-white/50" : "border-transparent hover:border-white/20"
          }`}
        >
          <img src={bg.url} alt={bg.label} className="w-full h-24 object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">{bg.label}</div>
          {currentUrl === bg.url && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-zinc-900" fill="currentColor" viewBox="0 0 20 20">
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
              className={`relative w-full rounded-md overflow-hidden border-2 transition-all ${
                currentUrl === url ? "border-white/50" : "border-transparent hover:border-white/20"
              }`}
            >
              <img src={src} alt="Décor importé" className="w-full h-24 object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white">Décor importé</div>
              {currentUrl === url && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-zinc-900" fill="currentColor" viewBox="0 0 20 20">
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
        className="w-full py-4 rounded-md border-2 border-dashed border-white/10 hover:border-white/25 text-muted hover:text-fore text-sm transition-colors flex flex-col items-center gap-2"
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
