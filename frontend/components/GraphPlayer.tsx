"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { Character, GraphEdge, GraphNode, GraphResponse, PublicStory, Scene } from "@/types";
import ScenePlayer from "@/components/ScenePlayer";
import ScenePreviewThumbnail from "@/components/ScenePreviewThumbnail";
import BranchOverlay from "@/components/BranchOverlay";

const BASE_W = 1920;
const BASE_H = 1080;

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

/** Conteneur 1920×1080 scalé — même mécanique que ScenePlayer. */
function ScaledScreen({ children, isFullscreen }: { children: React.ReactNode; isFullscreen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setScale(el.getBoundingClientRect().width / BASE_W);
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / BASE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-md"
      style={{
        aspectRatio: "16/9",
        width: "100%",
        maxHeight: isFullscreen ? "100%" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

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

  const [currentNodeId, setCurrentNodeId] = useState<number>(startNode ? startNode.id : -1);
  const [visitedEdgeIds, setVisitedEdgeIds] = useState<number[]>([]);
  const [pendingResume, setPendingResume] = useState<Progress | null>(() => {
    if (!startNode) return null;
    const saved = loadProgress(storyId, nodeIds);
    return saved && saved.currentNodeId !== startNode.id ? saved : null;
  });
  const [lastScene, setLastScene] = useState<Scene | null>(null);
  const [lastReplayNodeId, setLastReplayNodeId] = useState<number | null>(null);
  const [storyComplete, setStoryComplete] = useState(false);

  // ── Fullscreen géré ici — le containerRef ne démonte jamais ──────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

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
    setStoryComplete(false);
    setCurrentNodeId(targetId);
    setVisitedEdgeIds([]);
  };

  const handleResume = () => {
    if (pendingResume) {
      setCurrentNodeId(pendingResume.currentNodeId);
      setVisitedEdgeIds(pendingResume.visitedEdgeIds);
    }
    setPendingResume(null);
  };

  const handleRestart = () => {
    clearProgress(storyId);
    setVisitedEdgeIds([]);
    setStoryComplete(false);
    setPendingResume(null);
    setCurrentNodeId(startNode ? startNode.id : -1);
  };

  useEffect(() => {
    if (pendingResume) return;
    const node = nodeMap.get(currentNodeId);
    if (!node || node.type !== "start") return;
    const out = edgesFrom.get(node.id) ?? [];
    if (out.length > 0) navigate(out[0].target_node_id, out[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, pendingResume]);

  useEffect(() => {
    const node = nodeMap.get(currentNodeId);
    if (node?.type === "end") clearProgress(storyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId]);

  if (!startNode) {
    return (
      <div className="flex items-center justify-center bg-black rounded-md text-muted text-sm" style={{ aspectRatio: "16/9" }}>
        Aucun point de départ configuré dans le graphe.
      </div>
    );
  }

  const currentNode = nodeMap.get(currentNodeId) ?? null;

  if (!currentNode) {
    return (
      <div className="flex items-center justify-center bg-black rounded-md text-muted text-sm" style={{ aspectRatio: "16/9" }}>
        Nœud introuvable.
      </div>
    );
  }

  // Bouton fullscreen — même position/taille que dans ScenePlayer (top-10 left-10, w-20 h-20)
  const fsButton = (
    <button
      onClick={toggleFullscreen}
      className="player-next-btn absolute top-10 left-10 transition-colors z-20 cursor-pointer"
      title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
    >
      {isFullscreen ? (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
        </svg>
      )}
    </button>
  );

  // ── Rendu — containerRef est l'élément fullscreen persistant ─────────────

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none ${isFullscreen ? "bg-black flex items-center justify-center" : ""}`}
    >
      {pendingResume ? (
        <ScaledScreen isFullscreen={isFullscreen}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-16" style={{ background: "var(--player-end-bg)" }}>
            <p className="text-white text-[64px] font-medium text-center px-32">
              Reprendre votre progression&nbsp;?
            </p>
            <div className="flex flex-col items-center gap-10">
              <button
                onClick={handleResume}
                className="px-20 py-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-[44px] font-medium transition-colors cursor-pointer"
              >
                Reprendre
              </button>
              <button
                onClick={handleRestart}
                className="px-20 py-8 rounded-xl bg-surface hover:bg-elevated text-white/80 text-[44px] font-medium border border-white/10 transition-colors cursor-pointer"
              >
                Recommencer au début
              </button>
            </div>
          </div>
          {fsButton}
        </ScaledScreen>
      ) : storyComplete ? (
        <ScaledScreen isFullscreen={isFullscreen}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-16" style={{ background: "var(--player-end-bg)" }}>
            <div style={{ color: END_COLORS.neutral, fontSize: "120px", lineHeight: 1 }}>{END_ICONS.neutral}</div>
            <h2 className="text-white text-[80px] font-bold text-center px-32">Fin</h2>
            <button
              onClick={() => restart()}
              className="px-20 py-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-[44px] font-medium transition-colors cursor-pointer"
            >
              Recommencer
            </button>
            <div className="text-[28px] text-white/20">Créé avec Tellana</div>
          </div>
          {fsButton}
        </ScaledScreen>
      ) : currentNode.type === "end" ? (
        <ScaledScreen isFullscreen={isFullscreen}>
          {(() => {
            const d = currentNode.data as { type?: "good" | "bad" | "neutral"; title?: string; text?: string };
            const endType = d.type ?? "neutral";
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-16" style={{ background: "var(--player-end-bg)" }}>
                <div style={{ color: END_COLORS[endType], fontSize: "120px", lineHeight: 1 }}>{END_ICONS[endType]}</div>
                {d.title && <h2 className="text-white text-[80px] font-bold text-center px-32">{d.title}</h2>}
                {d.text && <p className="text-white/60 text-center text-[40px] leading-relaxed px-32">{d.text}</p>}
                <div className="flex flex-col items-center gap-10">
                  {lastReplayNodeId && (
                    <button
                      onClick={() => restart(lastReplayNodeId)}
                      className="px-20 py-8 rounded-xl bg-surface hover:bg-elevated text-white/80 text-[44px] font-medium border border-white/10 transition-colors cursor-pointer"
                    >
                      Rejouer depuis le dernier choix
                    </button>
                  )}
                  <button
                    onClick={() => restart()}
                    className="px-20 py-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-[44px] font-medium transition-colors cursor-pointer"
                  >
                    Recommencer
                  </button>
                </div>
                <div className="text-[28px] text-white/20">Créé avec Tellana</div>
              </div>
            );
          })()}
          {fsButton}
        </ScaledScreen>
      ) : currentNode.type === "branch" ? (
        <ScaledScreen isFullscreen={isFullscreen}>
          {(() => {
            const d = currentNode.data as { show_visited?: boolean; choices?: { id: string; label: string }[] };
            const showVisited = d.show_visited !== false;
            const choices = d.choices ?? [];
            const outgoing = edgesFrom.get(currentNode.id) ?? [];
            const options = choices
              .map((choice) => {
                const edge = outgoing.find((e) => e.source_handle === choice.id) ?? null;
                return {
                  label: choice.label,
                  edgeId: edge?.id ?? null,
                  targetNodeId: edge?.target_node_id ?? null,
                  visited: edge ? visitedEdgeIds.includes(edge.id) : false,
                };
              })
              .filter((o) => showVisited || !o.visited);
            const sceneChars: Character[] = lastScene
              ? lastScene.character_ids
                  .map((id) => story.characters.find((c) => c.id === id))
                  .filter((c): c is Character => !!c)
              : [];
            return (
              <>
                <ScenePreviewThumbnail
                  backgroundAsset={lastScene?.background_asset ?? null}
                  characters={sceneChars}
                  characterPositions={lastScene?.character_positions ?? {}}
                  className="absolute inset-0"
                />
                <BranchOverlay
                  options={options}
                  onChoice={(edgeId, targetNodeId) => navigate(targetNodeId, edgeId)}
                />
              </>
            );
          })()}
          {fsButton}
        </ScaledScreen>
      ) : currentNode.type === "scene" ? (
        (() => {
          const sceneId = (currentNode.data as { scene_id?: number }).scene_id;
          const scene = sceneId ? story.scenes.find((s) => s.id === sceneId) : undefined;

          if (!scene) {
            const out = edgesFrom.get(currentNode.id) ?? [];
            return (
              <ScaledScreen isFullscreen={isFullscreen}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-16 border border-white/10" style={{ background: "var(--player-end-bg)" }}>
                  <p className="text-muted text-[44px]">Scène manquante</p>
                  {out.length > 0 && (
                    <button
                      className="px-16 py-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-[44px] cursor-pointer"
                      onClick={() => navigate(out[0].target_node_id, out[0].id)}
                    >
                      Continuer
                    </button>
                  )}
                </div>
                {fsButton}
              </ScaledScreen>
            );
          }

          const sceneChars = scene.character_ids
            .map((id) => story.characters.find((c) => c.id === id))
            .filter((c): c is Character => !!c);

          // ScenePlayer gère son propre bouton fullscreen via external control
          return (
            <ScenePlayer
              key={scene.id}
              nodes={scene.nodes}
              characters={sceneChars}
              characterPositions={scene.character_positions}
              backgroundAsset={scene.background_asset}
              backgroundLoop={scene.background_loop}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onEnd={() => {
                setLastScene(scene);
                const out = edgesFrom.get(currentNode.id) ?? [];
                if (out.length > 0) {
                  navigate(out[0].target_node_id, out[0].id);
                } else {
                  clearProgress(storyId);
                  setStoryComplete(true);
                }
              }}
            />
          );
        })()
      ) : null}
    </div>
  );
}
