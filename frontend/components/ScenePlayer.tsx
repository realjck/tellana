"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssetRef, Character, CharacterPosition, QuizNodeData, StoryNode } from "@/types";
import { resolveAsset } from "@/lib/api";
import { DEFAULT_POSITIONS, FALLBACK_POSITION } from "@/lib/scenePositions";

const BASE_W = 1920;
const BASE_H = 1080;

interface Props {
  nodes: StoryNode[];
  characters: Character[];
  /** Per-character position overrides keyed by character id (as string). */
  characterPositions?: Record<string, CharacterPosition>;
  backgroundAsset: AssetRef | null;
  backgroundLoop?: boolean;
  startIndex?: number;
  onEnd?: () => void;
  /** compact mode for the editor preview panel */
  compact?: boolean;
  /** preview-only modes for the editor sidebar tabs */
  showMode?: "normal" | "characters-only" | "background-only";
  /** called whenever the displayed node index changes (for editor sync) */
  onIndexChange?: (index: number) => void;
  /** External fullscreen control — used by MultiScenePlayer to survive scene remounts */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

type QuizState = {
  selectedIndices: number[];
  confirmed: boolean;
};


export default function ScenePlayer({
  nodes,
  characters,
  characterPositions,
  backgroundAsset,
  startIndex = 0,
  onEnd,
  compact = false,
  showMode,
  onIndexChange,
  isFullscreen: externalFullscreen,
  onToggleFullscreen: externalToggle,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setScale(el.getBoundingClientRect().width / BASE_W);
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / BASE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const node = nodes[index];
  const isPreviewMode = !!showMode && showMode !== "normal";
  // End state: past the last node in normal mode
  const isEndState = !isPreviewMode && nodes.length > 0 && index >= nodes.length;

  // Notify parent when index changes (editor sidebar sync).
  // Use a ref for the callback to avoid stale-closure issues without requiring
  // the caller to memoize the function.
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; });
  useEffect(() => {
    onIndexChangeRef.current?.(index);
  }, [index]);

  // Reset quiz state on node change
  useEffect(() => {
    if (node?.type === "quiz") {
      setQuizState({ selectedIndices: [], confirmed: false });
      setShowFeedback(false);
    } else {
      setQuizState(null);
      setShowFeedback(false);
    }
  }, [index, node?.type]);

  const restart = useCallback(() => {
    setIndex(0);
  }, []);

  const advance = useCallback(() => {
    if (!node) return;
    if (node.type === "quiz" && quizState && !showFeedback) return; // must confirm first
    if (index < nodes.length - 1) {
      setIndex((i) => i + 1);
    } else {
      // Move to end state instead of immediately calling onEnd
      setIndex(nodes.length);
      onEnd?.();
    }
  }, [node, quizState, showFeedback, index, nodes.length, onEnd]);


  const externallyControlled = externalFullscreen !== undefined;
  const activeFullscreen = externallyControlled ? externalFullscreen : isFullscreen;

  const toggleFullscreen = () => {
    if (externallyControlled) {
      externalToggle?.();
      return;
    }
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (externallyControlled) return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [externallyControlled]);

  const data = node ? (node.data as unknown as Record<string, unknown>) : {};
  const charId = node?.type === "dialogue" ? (data.character_id as number | null) : null;
  const speakingChar = charId ? characters.find((c) => c.id === charId) : null;

  // ── Character display logic ────────────────────────────────────────────
  // Text nodes: dark background, no characters.
  // Quiz nodes: regular background, no characters.
  // Dialogue nodes: all scene characters are visible (ordered by caller).
  // The speaking character gets the white outline on dialogue nodes.
  const hideChars = !isPreviewMode && (node?.type === "text" || node?.type === "quiz");
  const displayChars = hideChars ? [] : characters;

  // Resolve a character's position: use stored position if available,
  // otherwise fall back to the slot default based on the character's index
  // in the full cast (not the displayChars subset).
  const getCharPosition = (c: Character): CharacterPosition => {
    const stored = characterPositions?.[String(c.id)];
    if (stored) return stored;
    const slotIndex = characters.findIndex((ch) => ch.id === c.id);
    return DEFAULT_POSITIONS[slotIndex >= 0 ? slotIndex : 0] ?? FALLBACK_POSITION;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none"
      style={{ aspectRatio: "16/9" }}
    >
      {isEndState ? (
        /* ── Écran de fin ── */
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1120]">
          <button
            onClick={restart}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            Recommencer
          </button>
        </div>
      ) : !node && !isPreviewMode ? (
        /* ── Aucun nœud ── */
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
          Aucun nœud à afficher
        </div>
      ) : (
        /* ── Contenu scalé 1920×1080 ── */
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
          {/* Background */}
          <div
            className="absolute inset-0 bg-slate-800"
            style={
              backgroundAsset
                ? {
                    backgroundImage: `url(${resolveAsset(backgroundAsset)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}
            }
          />
          <div className="absolute inset-0 bg-black/20" />

          {/* SVG filter: sharp white outline via morphological dilation of the alpha channel */}
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <filter id="outline-white" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="dilated" />
                <feFlood floodColor="white" floodOpacity="1" result="white" />
                <feComposite in="white" in2="dilated" operator="in" result="outline" />
                <feMerge>
                  <feMergeNode in="outline" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {/* Characters
              height: 100% of scene + bottom: -10% → exactly 90% visible, cut at lower leg.
              All % values are relative to the scene container, so it scales at any resolution.
              White outline only on the speaking character during dialogue nodes.
              Hidden in background-only preview mode. */}
          {showMode !== "background-only" && (
          <div className="absolute inset-0 pointer-events-none">
            {displayChars.map((c) => {
              const isSpeaking = !isPreviewMode && node?.type === "dialogue" && speakingChar?.id === c.id;
              const pos = getCharPosition(c);
              const spriteKeys = node?.type === "dialogue"
                ? (data.sprite_keys as Record<string, string> | undefined)
                : undefined;
              const poseKey = spriteKeys?.[String(c.id)];
              const resolvedSprite = (poseKey && c.sprites[poseKey])
                ? c.sprites[poseKey]
                : Object.values(c.sprites)[0];
              return (
                <img
                  key={c.id}
                  src={resolvedSprite ? resolveAsset(resolvedSprite) : ""}
                  alt={c.name}
                  className="absolute object-contain transition-all duration-200"
                  style={{
                    height: "100%",
                    bottom: `calc(-10% + ${pos.y * 50}%)`,
                    left: `${((pos.x + 1) / 2) * 100}%`,
                    transform: `translateX(-50%) scale(${pos.scale}) scaleX(${pos.flip_x ? -1 : 1})`,
                    filter: isSpeaking ? "url(#outline-white)" : "none",
                  }}
                />
              );
            })}
          </div>
          )}

          {/* ── Dialogue box (bottom) ── */}
          {!isPreviewMode && node?.type === "dialogue" && (
            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%] cursor-pointer"
              onClick={advance}
            >
              <div className="bg-slate-900/85 backdrop-blur-sm border border-white/10 rounded-2xl px-16 py-10 shadow-2xl">
                {speakingChar && (
                  <div className="text-[52px] font-semibold text-blue-300 mb-3">
                    {speakingChar.name}
                  </div>
                )}
                <div className="flex items-end justify-between gap-10">
                  <p className="text-white text-[48px] leading-relaxed flex-1">
                    {data.text as string}
                  </p>
                  <button className="flex-shrink-0 text-blue-300 hover:text-white transition-colors">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5l10 7-10 7V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Text node: centered narrative block with thick blue border ── */}
          {!isPreviewMode && node?.type === "text" && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer p-24"
              onClick={advance}
            >
              <div className="bg-slate-900/85 backdrop-blur-sm border border-white/10 rounded-2xl px-24 py-16 max-w-5xl w-full flex flex-col gap-10">
                <div className="prose prose-invert max-w-none text-white leading-relaxed
                  prose-p:my-2 prose-headings:text-white prose-headings:font-bold
                  prose-strong:text-white prose-em:text-slate-200
                  prose-ul:my-2 prose-ol:my-2 prose-li:my-0
                  prose-blockquote:border-blue-400 prose-blockquote:text-slate-300
                  prose-code:text-blue-200 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded
                  prose-a:text-blue-300"
                  style={{ fontSize: "48px" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.text as string}
                  </ReactMarkdown>
                </div>
                <div className="flex justify-end">
                  <button className="text-blue-300 hover:text-white transition-colors flex items-center gap-6 text-[48px]">
                    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5l10 7-10 7V5z" />
                    </svg>
                    Continuer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quiz box */}
          {!isPreviewMode && node?.type === "quiz" && quizState && (
            <QuizPanel
              data={data as unknown as QuizNodeData}
              quizState={quizState}
              showFeedback={showFeedback}
              onSelect={(idx) => {
                if (quizState.confirmed) return;
                const qd = data as unknown as QuizNodeData;
                if (qd.type === "qcu") {
                  setQuizState({ selectedIndices: [idx], confirmed: false });
                } else {
                  const already = quizState.selectedIndices.includes(idx);
                  setQuizState({
                    selectedIndices: already
                      ? quizState.selectedIndices.filter((i) => i !== idx)
                      : [...quizState.selectedIndices, idx],
                    confirmed: false,
                  });
                }
              }}
              onConfirm={() => {
                if (quizState.selectedIndices.length === 0) return;
                setQuizState((s) => s && { ...s, confirmed: true });
                setShowFeedback(true);
              }}
              onContinue={advance}
            />
          )}

          {/* Progress indicator — hidden in preview modes */}
          {!isPreviewMode && (
            <div className="absolute top-10 right-10 text-[44px] text-white/50">
              {index + 1} / {nodes.length}
            </div>
          )}

          {/* Fullscreen toggle */}
          {!compact && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-10 left-10 text-white/50 hover:text-white transition-colors"
              title={activeFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {activeFullscreen ? (
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quiz Panel ─────────────────────────────────────────────────────────────

function QuizPanel({
  data,
  quizState,
  showFeedback,
  onSelect,
  onConfirm,
  onContinue,
}: {
  data: QuizNodeData;
  quizState: QuizState;
  showFeedback: boolean;
  onSelect: (idx: number) => void;
  onConfirm: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%]">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-2xl px-16 py-12 shadow-2xl">
        <p className="text-white font-semibold mb-10 text-[52px]">{data.question}</p>

        {data.type === "qcm" && (
          <p className="text-[40px] text-slate-400 mb-6">
            Plusieurs réponses possibles
          </p>
        )}

        <div className="flex flex-col gap-6">
          {data.options.map((opt, i) => {
            const selected = quizState.selectedIndices.includes(i);
            const revealed = showFeedback;
            let optClass =
              "px-10 py-6 rounded-xl text-[44px] font-medium border transition-all cursor-pointer text-left ";
            if (revealed) {
              if (opt.is_correct) {
                optClass += "bg-green-500/20 border-green-500 text-green-300";
              } else if (selected && !opt.is_correct) {
                optClass += "bg-red-500/20 border-red-500 text-red-300";
              } else {
                optClass += "bg-white/5 border-white/10 text-slate-400";
              }
            } else {
              optClass += selected
                ? "bg-blue-500/30 border-blue-400 text-blue-200"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10";
            }

            return (
              <button
                key={i}
                className={optClass}
                onClick={() => !revealed && onSelect(i)}
                disabled={revealed}
              >
                {opt.text}
                {revealed && opt.is_correct && (
                  <span className="ml-2 text-green-400">✓</span>
                )}
                {revealed && selected && !opt.is_correct && (
                  <span className="ml-2 text-red-400">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && data.feedback && (
          <div className="mt-8 p-8 rounded-xl bg-white/5 text-[44px] text-slate-300">
            {data.feedback}
          </div>
        )}

        <div className="flex justify-end mt-10">
          {!showFeedback ? (
            <button
              onClick={onConfirm}
              disabled={quizState.selectedIndices.length === 0}
              className="px-12 py-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[44px] font-semibold transition-colors"
            >
              Valider
            </button>
          ) : (
            <button
              onClick={onContinue}
              className="px-12 py-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[44px] font-semibold transition-colors flex items-center gap-6"
            >
              Continuer
              <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5l10 7-10 7V5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
