"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AssetRef, Character, CharacterPosition, QuizNodeData, StoryNode } from "@/types";
import { resolveAsset } from "@/lib/api";
import { useAssetBust } from "@/lib/assetBust";
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
  const bust = useAssetBust(); // reload previews when an asset is replaced in place
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
  const isEndState = !isPreviewMode && nodes.length > 0 && index >= nodes.length;

  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; });
  useEffect(() => {
    onIndexChangeRef.current?.(index);
  }, [index]);

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
    if (node.type === "quiz" && quizState && !showFeedback) return;
    if (index < nodes.length - 1) {
      setIndex((i) => i + 1);
    } else {
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

  const hideChars = !isPreviewMode && (node?.type === "text" || node?.type === "quiz");
  const displayChars = hideChars ? [] : characters;

  const getCharPosition = (c: Character): CharacterPosition => {
    const stored = characterPositions?.[String(c.id)];
    if (stored) return stored;
    const slotIndex = characters.findIndex((ch) => ch.id === c.id);
    return DEFAULT_POSITIONS[slotIndex >= 0 ? slotIndex : 0] ?? FALLBACK_POSITION;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md select-none"
      style={{ aspectRatio: "16/9" }}
    >
      {isEndState ? (
        /* ── Écran de fin ── */
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--player-end-bg)" }}>
          <button
            onClick={restart}
            className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary hover:bg-primary-hover text-white cursor-pointer font-semibold transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            Recommencer
          </button>
        </div>
      ) : !node && !isPreviewMode ? (
        /* ── Aucun nœud ── */
        <div className="absolute inset-0 flex items-center justify-center bg-elevated text-muted text-sm">
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
            className="absolute inset-0 bg-elevated"
            style={
              backgroundAsset
                ? {
                    backgroundImage: `url("${resolveAsset(backgroundAsset, bust)}")`,
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

          {/* Characters */}
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
              if (!resolvedSprite) return null;
              return (
                <img
                  key={c.id}
                  src={resolveAsset(resolvedSprite, bust)}
                  alt={c.name}
                  className={`absolute object-contain ${isPreviewMode ? "" : "transition-all duration-200"}`}
                  style={{
                    height: "100%",
                    bottom: `calc(-10% + ${pos.y * 50}%)`,
                    left: `${((pos.x + 1) / 2) * 100}%`,
                    transform: `translateX(-50%) scale(${pos.scale}) scaleX(${pos.flip_x ? -1 : 1})`,
                    filter: isSpeaking ? "url(#outline-white)" : "none",
                  }}
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
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
              <div className="player-box px-16 py-10">
                {speakingChar && (
                  <div
                    className="text-[52px] font-semibold mb-3"
                    style={{ color: speakingChar.color ?? "var(--player-name-color)" }}
                  >
                    {speakingChar.name}
                  </div>
                )}
                <div className="flex items-end justify-between gap-10">
                  <p className="text-[48px] leading-relaxed flex-1" style={{ color: "var(--player-text-color)" }}>
                    {data.text as string}
                  </p>
                  <button className="player-next-btn flex-shrink-0 transition-colors">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5l10 7-10 7V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Text node: centered narrative block ── */}
          {!isPreviewMode && node?.type === "text" && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer p-24"
              onClick={advance}
            >
              <div className="player-box px-24 py-16 max-w-5xl w-full flex flex-col gap-10">
                <div
                  className="prose prose-invert max-w-none leading-relaxed
                    prose-p:my-2 prose-headings:font-bold
                    prose-ul:my-2 prose-ol:my-2 prose-li:my-0
                    prose-code:px-1 prose-code:rounded"
                  style={{ fontSize: "48px", color: "var(--player-text-color)" }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.text as string}
                  </ReactMarkdown>
                </div>
                <div className="flex justify-end">
                  <button className="player-next-btn transition-colors flex items-center gap-6 text-[48px]">
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
            <div
              className="absolute top-10 right-10 text-[44px]"
              style={{ color: "var(--player-progress-color)" }}
            >
              {index + 1} / {nodes.length}
            </div>
          )}

          {/* Fullscreen toggle */}
          {!compact && (
            <button
              onClick={toggleFullscreen}
              className="player-next-btn absolute top-10 left-10 transition-colors cursor-pointer"
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
      <div className="player-box px-16 py-12">
        <p className="font-semibold mb-10 text-[52px]" style={{ color: "var(--player-text-color)" }}>
          {data.question}
        </p>

        {data.type === "qcm" && (
          <p className="text-[40px] mb-6" style={{ color: "var(--player-progress-color)" }}>
            Plusieurs réponses possibles
          </p>
        )}

        <div className="flex flex-col gap-6">
          {data.options.map((opt, i) => {
            const selected = quizState.selectedIndices.includes(i);
            const revealed = showFeedback;
            let optClass = "px-10 py-6 rounded-lg text-[44px] font-medium border transition-all cursor-pointer text-left ";

            if (revealed) {
              if (opt.is_correct) {
                optClass += "player-option-correct";
              } else if (selected && !opt.is_correct) {
                optClass += "player-option-wrong";
              } else {
                optClass += "player-option-neutral";
              }
            } else {
              optClass += selected ? "player-option-selected" : "player-option";
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
          <div
            className="mt-8 p-8 rounded-lg text-[44px]"
            style={{ background: "var(--player-option-bg)", color: "var(--player-text-color)" }}
          >
            {data.feedback}
          </div>
        )}

        <div className="flex justify-end mt-10">
          {!showFeedback ? (
            <button
              onClick={onConfirm}
              disabled={quizState.selectedIndices.length === 0}
              className="player-confirm-btn px-12 py-6 text-[44px] font-semibold"
            >
              Valider
            </button>
          ) : (
            <button
              onClick={onContinue}
              className="player-confirm-btn px-12 py-6 text-[44px] font-semibold flex items-center gap-6"
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
