"use client";

import { use, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type NodeMouseHandler,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import type { GraphNode, GraphEdge, Story } from "@/types";
import StartNode from "@/components/canvas/StartNode";
import SceneNode from "@/components/canvas/SceneNode";
import BranchNode from "@/components/canvas/BranchNode";
import EndNode from "@/components/canvas/EndNode";

type Params = Promise<{ id: string }>;

const NODE_TYPES = { start: StartNode, scene: SceneNode, branch: BranchNode, end: EndNode };

// ── helpers ───────────────────────────────────────────────────────────────

function toFlowNode(
  n: GraphNode,
  storyId: number,
  selectedId: string | null,
  onRename: (id: number, title: string) => void,
  onNavigateToScene: (sceneId: number) => void
): Node {
  const id = String(n.id);
  const base = { id, position: { x: n.position_x, y: n.position_y }, selected: id === selectedId };
  if (n.type === "start") return { ...base, type: "start", data: {} };
  if (n.type === "scene") {
    const sceneId = (n.data as { scene_id?: number }).scene_id;
    return {
      ...base, type: "scene",
      data: {
        title: (n.data as { title?: string }).title ?? "Scène",
        selected: id === selectedId,
        onRename: (title: string) => onRename(n.id, title),
        sceneId,
        storyId,
        onDoubleClick: sceneId ? () => onNavigateToScene(sceneId) : undefined,
      },
    };
  }
  if (n.type === "branch") {
    return {
      ...base, type: "branch",
      data: {
        title: (n.data as { title?: string }).title ?? null,
        selected: id === selectedId,
        onRename: (title: string) => onRename(n.id, title),
      },
    };
  }
  // end
  return {
    ...base, type: "end",
    data: {
      type: (n.data as { type?: string }).type ?? "neutral",
      title: (n.data as { title?: string }).title ?? "",
      selected: id === selectedId,
      onRename: (title: string) => onRename(n.id, title),
    },
  };
}

function toFlowEdge(e: GraphEdge): Edge {
  return {
    id: String(e.id),
    source: String(e.source_node_id),
    target: String(e.target_node_id),
    label: e.label ?? undefined,
    data: { dbId: e.id },
  };
}

// ── Canvas inner (needs ReactFlowProvider context) ─────────────────────────

function CanvasInner({ storyId }: { storyId: number }) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const initialized = useRef(false);
  const { screenToFlowPosition } = useReactFlow();

  const handleNavigateToScene = useCallback((sceneId: number) => {
    router.push(`/stories/${storyId}/scenes/${sceneId}/edit`);
  }, [router, storyId]);

  const handleRename = useCallback(async (nodeDbId: number, title: string) => {
    const node = (await api.graph.get(storyId)).nodes.find((n) => n.id === nodeDbId);
    if (!node) return;
    const newData = { ...node.data, title };
    await api.graph.updateNode(storyId, nodeDbId, { data: newData as Record<string, unknown> });
    if (node.type === "scene" && typeof (node.data as { scene_id?: number }).scene_id === "number") {
      await api.scenes.update(storyId, (node.data as { scene_id: number }).scene_id, { title });
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.id === String(nodeDbId) ? { ...n, data: { ...n.data, title } } : n
      )
    );
  }, [storyId, setNodes]);

  // Load graph on mount
  useSWR(`graph-${storyId}`, async () => {
    const graph = await api.graph.get(storyId);
    if (!initialized.current) {
      initialized.current = true;
      // Auto-create start node if absent
      let dbNodes = graph.nodes;
      if (!dbNodes.find((n) => n.type === "start")) {
        const startNode = await api.graph.createNode(storyId, { type: "start", position_x: 400, position_y: 80, data: {} });
        dbNodes = [startNode, ...dbNodes];
      }
      const flowNodes = dbNodes.map((n) => toFlowNode(n, storyId, selectedNodeId, handleRename, handleNavigateToScene));
      const flowEdges = graph.edges.map(toFlowEdge);
      setNodes(flowNodes);
      setEdges(flowEdges);
    }
    return graph;
  });

  // ── position auto-save ──────────────────────────────────────────────────

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    for (const change of changes) {
      if (change.type === "position" && change.dragging === false && change.id) {
        const id = change.id;
        const existing = debounceRef.current.get(id);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(async () => {
          debounceRef.current.delete(id);
          const pos = change.position;
          if (!pos) return;
          await api.graph.updateNode(storyId, Number(id), { position_x: pos.x, position_y: pos.y });
        }, 500);
        debounceRef.current.set(id, timer);
      }
    }
  }, [onNodesChange, storyId]);

  // ── edge creation ───────────────────────────────────────────────────────

  const onConnect: OnConnect = useCallback(async (params) => {
    const sourceId = Number(params.source);
    const targetId = Number(params.target);
    try {
      const dbEdge = await api.graph.createEdge(storyId, {
        source_node_id: sourceId,
        target_node_id: targetId,
        label: null,
        order: 0,
      });
      setEdges((eds) => addEdge({ ...params, id: String(dbEdge.id), data: { dbId: dbEdge.id } }, eds));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur";
      alert(msg);
    }
  }, [storyId, setEdges]);

  // ── edge delete ─────────────────────────────────────────────────────────

  const handleEdgesDelete = useCallback(async (deleted: Edge[]) => {
    for (const edge of deleted) {
      const dbId = (edge.data as { dbId?: number })?.dbId;
      if (dbId) await api.graph.deleteEdge(storyId, dbId);
    }
  }, [storyId]);

  // ── node delete ─────────────────────────────────────────────────────────

  const handleNodesDelete = useCallback(async (deleted: Node[]) => {
    for (const node of deleted) {
      if (node.type === "start") continue; // non-deletable
      await api.graph.deleteNode(storyId, Number(node.id));
    }
  }, [storyId]);

  // ── double click → navigate to scene editor ────────────────────────────

  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    const cb = (node.data as { onDoubleClick?: () => void }).onDoubleClick;
    if (cb) cb();
  }, []);

  // ── node selection ──────────────────────────────────────────────────────

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedNodeId((prev) => {
      const next = prev === node.id ? prev : node.id;
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === next } })));
      return next;
    });
  }, [setNodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: false } })));
  }, [setNodes]);

  // ── context menu (right-click or left-click on empty area) ─────────────

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, clientX: e.clientX, clientY: e.clientY });
  }, []);

  // ── create node ─────────────────────────────────────────────────────────

  const createNode = useCallback(async (type: "scene" | "branch" | "end") => {
    if (!contextMenu) return;
    setContextMenu(null);
    const { x: px, y: py } = screenToFlowPosition({ x: contextMenu.clientX, y: contextMenu.clientY });

    let data: Record<string, unknown> = {};
    let title = "";
    if (type === "scene") {
      const sceneCount = nodes.filter((n) => n.type === "scene").length;
      title = `Scène ${sceneCount + 1}`;
      const scene = await api.scenes.create(storyId, title);
      data = { scene_id: scene.id, title };
    } else if (type === "branch") {
      data = { title: null, replay: false, show_visited: false };
    } else {
      data = { type: "neutral", title: "", text: "" };
    }

    const dbNode = await api.graph.createNode(storyId, { type, position_x: px, position_y: py, data });
    const flowNode = toFlowNode(dbNode, storyId, null, handleRename, handleNavigateToScene);
    setNodes((nds) => [...nds, flowNode]);
  }, [contextMenu, nodes, storyId, handleRename, handleNavigateToScene, screenToFlowPosition, setNodes]);

  // ── "Tester" button ────────────────────────────────────────────────────

  const handleTest = useCallback(() => {
    router.push(`/stories/${storyId}/play`);
  }, [router, storyId]);

  return (
    <div className="w-full h-full relative" onClick={() => setContextMenu(null)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={handleEdgesDelete}
        onNodesDelete={handleNodesDelete}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        nodeTypes={NODE_TYPES}
        deleteKeyCode="Delete"
        fitView
        className="bg-bg"
      >
        <MiniMap
          className="!bg-sidebar !border !border-white/10 rounded-lg"
          nodeColor="#334155"
          maskColor="rgba(0,0,0,0.4)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
      </ReactFlow>

      {/* Test button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleTest}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tester
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-50 bg-elevated border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => createNode("scene")}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-fore hover:bg-raised transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Scène
          </button>
          <button
            onClick={() => createNode("branch")}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-fore hover:bg-raised transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            Embranchement
          </button>
          <button
            onClick={() => createNode("end")}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-fore hover:bg-raised transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-red-400" />
            Fin
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CanvasPage({ params }: { params: Params }) {
  const { id } = use(params);
  const storyId = Number(id);

  const { data: story } = useSWR<Story>(`story-${storyId}`, () => api.stories.get(storyId));

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Header */}
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
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-subtle uppercase tracking-wide font-medium leading-none mb-1">
              Canvas
            </span>
            <span className="text-fore font-bold text-lg truncate">{story?.title ?? "…"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-subtle">
            <span>Clic droit sur le canvas pour créer un nœud</span>
            <span className="text-subtle/40">·</span>
            <span>Double-clic sur une scène pour l&apos;éditer</span>
          </div>
        </div>
      </header>

      {/* Canvas — ReactFlowProvider required for useReactFlow inside CanvasInner */}
      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <CanvasInner storyId={storyId} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
