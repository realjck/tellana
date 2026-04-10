"use client";

import { useState, useEffect, useRef } from "react";
import type {
  StoryNode,
  Character,
  NodeType,
  QuizNodeData,
  QuizOption,
} from "@/types";

interface Props {
  node: StoryNode;
  characters: Character[];
  onSave: (data: Partial<StoryNode>) => void;
  onDelete: () => void;
  onPreview?: (type: NodeType, data: Record<string, unknown>) => void;
  onAdd?: () => void;
}

const NODE_LABELS: Record<NodeType, string> = {
  dialogue: "Dialogue",
  text: "Texte narratif",
  quiz: "Quiz",
};

export default function NodeForm({ node, characters, onSave, onDelete, onPreview, onAdd }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(
    node.data as unknown as Record<string, unknown>
  );
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when node changes, cancel any pending save
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setData(node.data as unknown as Record<string, unknown>);
  }, [node.id, node.data]);

  const scheduleAutoSave = (currentData: Record<string, unknown>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onSave({ type: node.type, data: currentData as unknown as StoryNode["data"] });
    }, 1000);
  };

  const updateData = (newData: Record<string, unknown>) => {
    setData(newData);
    onPreview?.(node.type, newData);
    scheduleAutoSave(newData);
  };

  const saveNow = (currentData: Record<string, unknown>) => {
    if (autoSaveTimer.current) { clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null; }
    onSave({ type: node.type, data: currentData as unknown as StoryNode["data"] });
  };

  const handleAdd = () => {
    saveNow(data);
    onAdd?.();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fields */}
      {node.type === "dialogue" && (
        <DialogueFields data={data} characters={characters} onChange={updateData} onAdd={handleAdd} />
      )}
      {node.type === "text" && (
        <TextFields data={data} onChange={updateData} />
      )}
      {node.type === "quiz" && (
        <QuizFields data={data} onChange={updateData} />
      )}

      {/* Actions */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-300 text-sm transition-colors"
        >
          Supprimer ce nœud
        </button>
      </div>
    </div>
  );
}

// ── Dialogue fields ────────────────────────────────────────────────────────

function DialogueFields({
  data,
  characters,
  onChange,
  onAdd,
}: {
  data: Record<string, unknown>;
  characters: Character[];
  onChange: (d: Record<string, unknown>) => void;
  onAdd?: () => void;
}) {
  const spriteKeys = (data.sprite_keys as Record<string, string> | undefined) ?? {};
  const selectedCharId = (data.character_id as number | null) ?? null;

  const setSpriteKey = (charId: number, poseKey: string) => {
    const updated = { ...spriteKeys, [String(charId)]: poseKey };
    onChange({ ...data, sprite_keys: updated });
  };

  return (
    <div className="grid grid-cols-[1fr_2fr] gap-3">
      {/* Left column: character + pose selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Poses / personnage
        </label>
        {characters.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Aucun personnage dans la scène.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {characters.map((c) => {
              const poseKeys = Object.keys(c.sprites);
              const activePose = spriteKeys[String(c.id)] ?? "default";
              const isSelected = selectedCharId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => onChange({ ...data, character_id: c.id })}
                  className={`rounded-xl p-2 border cursor-pointer transition-colors flex items-start gap-2 ${
                    isSelected
                      ? "bg-blue-900/20 border-blue-600/70"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate mb-1.5 ${isSelected ? "text-blue-300" : "text-slate-300"}`}>
                      {c.name}
                    </div>
                    {/* Pose badges */}
                    <div className="flex flex-wrap gap-1">
                      {poseKeys.map((key) => {
                        const isActive = activePose === key;
                        return (
                          <button
                            key={key}
                            onClick={(e) => { e.stopPropagation(); setSpriteKey(c.id, key); }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                              isActive
                                ? "bg-amber-900/40 border-amber-600/80 text-amber-300"
                                : "bg-slate-700 border-slate-600 text-slate-400 hover:border-amber-700 hover:text-amber-400"
                            }`}
                          >
                            {key === "default" ? "défaut" : key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Radio indicator */}
                  <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-500" : "border-slate-500"
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right column: text */}
      <div className="flex flex-col flex-1">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Texte
        </label>
        <textarea
          rows={5}
          value={(data.text as string) ?? ""}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          placeholder="Ce que dit le personnage..."
          className="w-full flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
        {onAdd && (
          <button
            onClick={onAdd}
            className="mt-2 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter un nœud dialogue
          </button>
        )}
      </div>
    </div>
  );
}

// ── Text (narrative) fields ────────────────────────────────────────────────

function TextFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
        Texte
      </label>
      <textarea
        rows={8}
        value={(data.text as string) ?? ""}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        placeholder={"Texte narratif en Markdown...\n\n**gras**, *italique*, # Titre, - liste, > citation"}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
      />
    </div>
  );
}

// ── Quiz fields ────────────────────────────────────────────────────────────

function QuizFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  const quizData = data as unknown as QuizNodeData;
  const options: QuizOption[] = quizData.options ?? [];

  const updateOption = (idx: number, patch: Partial<QuizOption>) => {
    const newOptions = options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    onChange({ ...data, options: newOptions });
  };

  const addOption = () => {
    onChange({
      ...data,
      options: [...options, { text: "", is_correct: false }],
    });
  };

  const removeOption = (idx: number) => {
    onChange({ ...data, options: options.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Question
        </label>
        <textarea
          rows={2}
          value={quizData.question ?? ""}
          onChange={(e) => onChange({ ...data, question: e.target.value })}
          placeholder="Posez votre question..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Type de quiz
        </label>
        <div className="flex gap-2">
          {(["qcu", "qcm"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...data, type: t })}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                quizData.type === t
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {t === "qcu" ? "Réponse unique (QCU)" : "Réponses multiples (QCM)"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Réponses
        </label>
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`flex gap-2 items-center p-2 rounded-xl border ${
                opt.is_correct ? "border-green-600/50 bg-green-900/10" : "border-slate-700 bg-slate-800/50"
              }`}
            >
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOption(i, { text: e.target.value })}
                placeholder={`Réponse ${i + 1}`}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => updateOption(i, { is_correct: !opt.is_correct })}
                title={opt.is_correct ? "Marquer comme incorrecte" : "Marquer comme correcte"}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  opt.is_correct
                    ? "bg-green-600 border-green-500 text-white"
                    : "bg-slate-700 border-slate-600 text-slate-400 hover:border-green-600"
                }`}
              >
                ✓
              </button>
              <button
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-600 disabled:opacity-30 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addOption}
          className="mt-2 w-full py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-sm transition-colors"
        >
          + Ajouter une réponse
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Feedback (affiché après la réponse)
        </label>
        <textarea
          rows={2}
          value={quizData.feedback ?? ""}
          onChange={(e) => onChange({ ...data, feedback: e.target.value })}
          placeholder="Explication ou correction affichée après avoir répondu..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>
    </>
  );
}
