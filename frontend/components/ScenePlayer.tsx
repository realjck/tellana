"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetRef, Character, QuizNodeData, StoryNode } from "@/types";
import { resolveAsset } from "@/lib/api";

interface Props {
  nodes: StoryNode[];
  characters: Character[];
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
}

type QuizState = {
  selectedIndices: number[];
  confirmed: boolean;
};


export default function ScenePlayer({
  nodes,
  characters,
  backgroundAsset,
  startIndex = 0,
  onEnd,
  compact = false,
  showMode,
  onIndexChange,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept keystrokes when the user is typing in a form element
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
    },
    [advance]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // End screen
  if (isEndState) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl select-none flex items-center justify-center bg-[#0b1120]"
        style={{ aspectRatio: "16/9" }}
      >
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
    );
  }

  if (!node && !isPreviewMode) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400 text-sm rounded-xl">
        Aucun nœud à afficher
      </div>
    );
  }

  const data = node ? (node.data as unknown as Record<string, unknown>) : {};
  const charId = data.character_id as number | null;
  const speakingChar = charId ? characters.find((c) => c.id === charId) : null;

  // ── Character display logic ────────────────────────────────────────────
  // text node: only the speaking character (if any), on the left
  // all other modes: all characters visible, speaker at full opacity
  const isTextNode = !isPreviewMode && node?.type === "text";
  const displayChars = isTextNode
    ? (speakingChar ? [speakingChar] : [])
    : characters;

  const total = displayChars.length;

  // Dynamic positioning — no stored position field:
  //   1 char  → left: 36% (centered)
  //   2 chars → char[0]: left:16%, char[1]: right:16% (mirrored)
  //   3+      → left: (4 + 22×i)%  (all from left, no mirror)
  const charLeft = (i: number): string | undefined => {
    if (isTextNode) return `${4 + i * 22}%`; // text node: always from far left
    if (total === 1) return "36%";
    if (total === 2 && i === 0) return "16%";
    if (total >= 3) return `${4 + i * 22}%`;
    return undefined;
  };
  const charRight = (i: number): string | undefined => {
    if (total === 2 && i === 1) return "16%";
    return undefined;
  };
  const charMirror = (i: number): boolean => total === 2 && i === 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none"
      style={{ aspectRatio: "16/9" }}
    >
      {/* Background — hidden for text nodes */}
      {!isTextNode && (
        <>
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
        </>
      )}
      {isTextNode && <div className="absolute inset-0 bg-[#0b1120]" />}

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
        {displayChars.map((c, i) => {
          const isSpeaking = !isPreviewMode && node?.type === "dialogue" && speakingChar?.id === c.id;
          const mirrored = charMirror(i);
          const firstSprite = Object.values(c.sprites)[0];
          return (
            <img
              key={c.id}
              src={firstSprite ? resolveAsset(firstSprite) : ""}
              alt={c.name}
              className={`absolute object-contain transition-all duration-200${mirrored ? " scale-x-[-1]" : ""}`}
              style={{
                height: "100%",
                bottom: "-10%",
                left: charLeft(i),
                right: charRight(i),
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
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] cursor-pointer"
          onClick={advance}
        >
          <div className="bg-slate-900/85 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
            {speakingChar && (
              <div className="text-sm font-semibold text-blue-300 mb-1">
                {speakingChar.name}
              </div>
            )}
            <div className="flex items-end justify-between gap-4">
              <p className="text-white text-sm leading-relaxed flex-1">
                {data.text as string}
              </p>
              <button className="flex-shrink-0 text-blue-300 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5l10 7-10 7V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Text node: centered block, left-aligned, no background ── */}
      {!isPreviewMode && node?.type === "text" && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={advance}
        >
          {/* Offset right if a character is shown on the left */}
          <div
            className="w-[55%] max-w-lg"
            style={{ marginLeft: speakingChar ? "20%" : "0" }}
          >
            <p className="text-white text-base leading-relaxed text-left">
              {data.text as string}
            </p>
            <button className="mt-4 text-blue-300 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5l10 7-10 7V5z" />
              </svg>
              Continuer
            </button>
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
        <div className="absolute top-3 right-3 text-xs text-white/50">
          {index + 1} / {nodes.length}
        </div>
      )}

      {/* Fullscreen toggle */}
      {!compact && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 left-3 text-white/50 hover:text-white transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
            </svg>
          )}
        </button>
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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%]">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 shadow-2xl">
        <p className="text-white font-semibold mb-4 text-sm">{data.question}</p>

        {data.type === "qcm" && (
          <p className="text-xs text-slate-400 mb-2">
            Plusieurs réponses possibles
          </p>
        )}

        <div className="flex flex-col gap-2">
          {data.options.map((opt, i) => {
            const selected = quizState.selectedIndices.includes(i);
            const revealed = showFeedback;
            let optClass =
              "px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer text-left ";
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
          <div className="mt-3 p-3 rounded-xl bg-white/5 text-sm text-slate-300">
            {data.feedback}
          </div>
        )}

        <div className="flex justify-end mt-4">
          {!showFeedback ? (
            <button
              onClick={onConfirm}
              disabled={quizState.selectedIndices.length === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Valider
            </button>
          ) : (
            <button
              onClick={onContinue}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              Continuer
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5l10 7-10 7V5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
