"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Character, QuizNodeData, StoryNode } from "@/types";
import { API_BASE } from "@/lib/api";

interface Props {
  nodes: StoryNode[];
  characters: Character[];
  backgroundUrl: string | null;
  startIndex?: number;
  onEnd?: () => void;
  /** compact mode for the editor preview panel */
  compact?: boolean;
}

type QuizState = {
  selectedIndices: number[];
  confirmed: boolean;
};

function resolveImage(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return url; // relative Next.js public asset
}

export default function ScenePlayer({
  nodes,
  characters,
  backgroundUrl,
  startIndex = 0,
  onEnd,
  compact = false,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const node = nodes[index];

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

  const advance = useCallback(() => {
    if (!node) return;
    if (node.type === "quiz" && quizState && !showFeedback) return; // must confirm first
    if (index < nodes.length - 1) {
      setIndex((i) => i + 1);
    } else {
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

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400 text-sm rounded-xl">
        Aucun nœud à afficher
      </div>
    );
  }

  const data = node.data as unknown as Record<string, unknown>;
  const charId = data.character_id as number | null;
  const speakingChar = charId ? characters.find((c) => c.id === charId) : null;

  // ── Character display logic ────────────────────────────────────────────
  // dialogue / quiz: all characters visible, speaker at full opacity
  // text: only the optional character_id char, always forced to left
  const isTextNode = node.type === "text";
  const leftChars = isTextNode
    ? speakingChar ? [speakingChar] : []
    : characters.filter((c) => c.position === "left");
  const rightChars = isTextNode
    ? []
    : characters.filter((c) => c.position === "right");

  const maxHeight = compact ? "240px" : "420px";

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
              backgroundUrl
                ? {
                    backgroundImage: `url(${resolveImage(backgroundUrl)})`,
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

      {/* Characters */}
      <div className="absolute inset-0 flex items-end justify-between px-8 pb-[22%] pointer-events-none">
        {/* Left */}
        <div className="flex items-end gap-2">
          {leftChars.map((c) => (
            <img
              key={c.id}
              src={resolveImage(c.image_url)}
              alt={c.name}
              className="object-contain drop-shadow-xl transition-opacity"
              style={{
                height: "70%",
                maxHeight,
                opacity: speakingChar && c.id !== speakingChar.id ? 0.4 : 1,
              }}
            />
          ))}
        </div>

        {/* Right */}
        <div className="flex items-end gap-2">
          {rightChars.map((c) => (
            <img
              key={c.id}
              src={resolveImage(c.image_url)}
              alt={c.name}
              className="object-contain drop-shadow-xl scale-x-[-1] transition-opacity"
              style={{
                height: "70%",
                maxHeight,
                opacity: speakingChar && c.id !== speakingChar.id ? 0.4 : 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Dialogue box (bottom) ── */}
      {node.type === "dialogue" && (
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
      {node.type === "text" && (
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
      {node.type === "quiz" && quizState && (
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

      {/* Progress indicator */}
      <div className="absolute top-3 right-3 text-xs text-white/50">
        {index + 1} / {nodes.length}
      </div>

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
