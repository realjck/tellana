"use client";

import { useState, useEffect } from "react";
import type { Character, GraphEdge, GraphNode, GraphResponse, PublicStory, Scene } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
import BranchOverlay from "@/components/BranchOverlay";

interface Props {
  story: PublicStory;
  graph: GraphResponse;
  storyId: number;
}

interface Progress {
  currentNodeId: number;
  visitedEdgeIds: number[];
}

function storageKey(id: number) {
  return `tellana_progress_${id}`;
}

function loadProgress(storyId: number, nodeIds: Set<number>): Progress | null {
  try {
    const raw = localStorage.getItem(storageKey(storyId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Progress;
    if (!nodeIds.has(p.currentNodeId)) return null;
    return p;
  } catch {
    return null;
  }
}

function saveProgress(storyId: number, p: Progress) {
  try {
    localStorage.setItem(storageKey(storyId), JSON.stringify(p));
  } catch {}
}

function clearProgress(storyId: number) {
  try {
    localStorage.removeItem(storageKey(storyId));
  } catch {}
}

const END_ICONS: Record<string, string> = { good: "★", bad: "✕", neutral: "◈" };
const END_COLORS: Record<string, string> = { good: "#22c55e", bad: "#ef4444", neutral: "#94a3b8" };

export default function GraphPlayer({ story, graph, storyId }: Props) {
  // Build lookup maps
  const nodeMap = new Map<number, GraphNode>(graph.nodes.map((n) => [n.id, n]));
  const edgesFrom = new Map<number, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = edgesFrom.get(edge.source_node_id) ?? [];
    list.push(edge);
    edgesFrom.set(edge.source_node_id, list);
  }
  for (const [k, v] of edgesFrom) {
    edgesFrom.set(k, [...v].sort((a, b) => a.order - b.order));
  }

  const startNode = graph.nodes.find((n) => n.type === "start") ?? null;
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  const [currentNodeId, setCurrentNodeId] = useState<number>(() => {
    if (!startNode) return -1;
    const saved = loadProgress(storyId, nodeIds);
    return saved?.currentNodeId ?? startNode.id;
  });
  const [visitedEdgeIds, setVisitedEdgeIds] = useState<number[]>(() => {
    if (!startNode) return [];
    const saved = loadProgress(storyId, nodeIds);
    return saved?.visitedEdgeIds ?? [];
  });
  const [lastScene, setLastScene] = useState<Scene | null>(null);
  const [lastReplayNodeId, setLastReplayNodeId] = useState<number | null>(null);

  const navigate = (targetNodeId: number, edgeId?: number) => {
    const newVisited = edgeId ? [...visitedEdgeIds, edgeId] : visitedEdgeIds;
    const targetNode = nodeMap.get(targetNodeId);
    if (targetNode?.type === "branch" && (targetNode.data as { replay?: boolean }).replay) {
      setLastReplayNodeId(targetNodeId);
    }
    setCurrentNodeId(targetNodeId);
    setVisitedEdgeIds(newVisited);
    saveProgress(storyId, { currentNodeId: targetNodeId, visitedEdgeIds: newVisited });
  };

  const restart = (fromNodeId?: number) => {
    clearProgress(storyId);
    const targetId = fromNodeId ?? startNode?.id ?? -1;
    if (!fromNodeId) {
      setLastScene(null);
      setLastReplayNodeId(null);
    }
    setCurrentNodeId(targetId);
    setVisitedEdgeIds([]);
  };

  const currentNode = nodeMap.get(currentNodeId) ?? null;

  // Auto-advance from start node
  useEffect(() => {
    if (!currentNode || currentNode.type !== "start") return;
    const out = edgesFrom.get(currentNode.id) ?? [];
    if (out.length > 0) navigate(out[0].target_node_id, out[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId]);

  if (!startNode) {
    return (
      <div
        className="flex items-center justify-center bg-black rounded-md text-muted text-sm"
        style={{ aspectRatio: "16/9" }}
      >
        Aucun point de départ configuré dans le graphe.
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div
        className="flex items-center justify-center bg-black rounded-md text-muted text-sm"
        style={{ aspectRatio: "16/9" }}
      >
        Nœud introuvable.
      </div>
    );
  }

  // ── End node ───────────────────────────────────────────────────────────────

  if (currentNode.type === "end") {
    const d = currentNode.data as { type?: "good" | "bad" | "neutral"; title?: string; text?: string };
    const endType = d.type ?? "neutral";
    return (
      <div
        className="flex flex-col items-center justify-center gap-5 rounded-md"
        style={{ aspectRatio: "16/9", background: "var(--player-end-bg)" }}
      >
        <div style={{ color: END_COLORS[endType], fontSize: "2.5rem" }}>
          {END_ICONS[endType]}
        </div>
        {d.title && (
          <h2 className="text-white text-2xl font-bold text-center px-8">{d.title}</h2>
        )}
        {d.text && (
          <p className="text-white/60 text-center max-w-sm text-sm leading-relaxed px-8">
            {d.text}
          </p>
        )}
        <div className="flex flex-col items-center gap-3 mt-2">
          {lastReplayNodeId && (
            <button
              onClick={() => restart(lastReplayNodeId)}
              className="px-6 py-2.5 rounded-md bg-surface hover:bg-elevated text-white/80 text-sm font-medium border border-white/10 transition-colors cursor-pointer"
            >
              Rejouer depuis le dernier choix
            </button>
          )}
          <button
            onClick={() => restart()}
            className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Recommencer
          </button>
        </div>
        <div className="text-xs text-white/20 mt-2">Créé avec Tellana</div>
      </div>
    );
  }

  // ── Branch node ────────────────────────────────────────────────────────────

  if (currentNode.type === "branch") {
    const d = currentNode.data as { show_visited?: boolean };
    const showVisited = d.show_visited !== false;
    const out = (edgesFrom.get(currentNode.id) ?? []).slice(0, 5);
    const sceneChars: Character[] = lastScene
      ? lastScene.character_ids
          .map((id) => story.characters.find((c) => c.id === id))
          .filter((c): c is Character => !!c)
      : [];
    return (
      <div className="relative w-full rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <ScenePreviewThumbnail
          backgroundAsset={lastScene?.background_asset ?? null}
          characters={sceneChars}
          characterPositions={lastScene?.character_positions ?? {}}
          className="absolute inset-0"
        />
        <BranchOverlay
          edges={out}
          visitedEdgeIds={showVisited ? visitedEdgeIds : []}
          onChoice={(edgeId, targetNodeId) => navigate(targetNodeId, edgeId)}
        />
      </div>
    );
  }

  // ── Scene node ─────────────────────────────────────────────────────────────

  if (currentNode.type === "scene") {
    const sceneId = (currentNode.data as { scene_id?: number }).scene_id;
    const scene = sceneId ? story.scenes.find((s) => s.id === sceneId) : undefined;

    if (!scene) {
      const out = edgesFrom.get(currentNode.id) ?? [];
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-md border border-white/10"
          style={{ aspectRatio: "16/9", background: "var(--player-end-bg)" }}
        >
          <p className="text-muted text-sm">Scène manquante</p>
          {out.length > 0 && (
            <button
              className="px-4 py-2 rounded-md bg-primary hover:bg-primary-hover text-white text-sm cursor-pointer"
              onClick={() => navigate(out[0].target_node_id, out[0].id)}
            >
              Continuer
            </button>
          )}
        </div>
      );
    }

    const sceneChars = scene.character_ids
      .map((id) => story.characters.find((c) => c.id === id))
      .filter((c): c is Character => !!c);

    return (
      <ScenePlayer
        key={scene.id}
        nodes={scene.nodes}
        characters={sceneChars}
        characterPositions={scene.character_positions}
        backgroundAsset={scene.background_asset}
        backgroundLoop={scene.background_loop}
        onEnd={() => {
          setLastScene(scene);
          const out = edgesFrom.get(currentNode.id) ?? [];
          if (out.length > 0) navigate(out[0].target_node_id, out[0].id);
        }}
      />
    );
  }

  return null;
}
