"use client";

import { useState, useEffect } from "react";
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
}

const NODE_LABELS: Record<NodeType, string> = {
  dialogue: "Dialogue",
  text: "Texte narratif",
  quiz: "Quiz",
};

export default function NodeForm({ node, characters, onSave, onDelete }: Props) {
  const [type, setType] = useState<NodeType>(node.type);
  const [data, setData] = useState<Record<string, unknown>>(
    node.data as unknown as Record<string, unknown>
  );

  // Sync when node changes
  useEffect(() => {
    setType(node.type);
    setData(node.data as unknown as Record<string, unknown>);
  }, [node.id, node.type, node.data]);

  const handleTypeChange = (newType: NodeType) => {
    setType(newType);
    if (newType === "quiz") {
      setData({
        question: "",
        type: "qcu",
        options: [
          { text: "", is_correct: true, feedback: "" },
          { text: "", is_correct: false, feedback: "" },
        ],
      } as unknown as Record<string, unknown>);
    } else {
      setData({ character_id: null, text: "" });
    }
  };

  const save = () => onSave({ type, data: data as unknown as StoryNode["data"] });

  return (
    <div className="flex flex-col gap-4">
      {/* Type selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Type de nœud
        </label>
        <div className="flex gap-2">
          {(["dialogue", "text", "quiz"] as NodeType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                type === t
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {NODE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      {(type === "dialogue" || type === "text") && (
        <DialogueTextFields
          type={type}
          data={data}
          characters={characters}
          onChange={setData}
        />
      )}
      {type === "quiz" && (
        <QuizFields data={data} onChange={setData} />
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          Enregistrer
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/70 border border-red-800/50 text-red-300 text-sm transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Dialogue / Text fields ─────────────────────────────────────────────────

function DialogueTextFields({
  type,
  data,
  characters,
  onChange,
}: {
  type: "dialogue" | "text";
  data: Record<string, unknown>;
  characters: Character[];
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Personnage{type === "text" ? " (optionnel)" : ""}
        </label>
        <select
          value={(data.character_id as number | null) ?? ""}
          onChange={(e) =>
            onChange({
              ...data,
              character_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">— Aucun personnage —</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.position === "left" ? "gauche" : "droite"})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Texte
        </label>
        <textarea
          rows={4}
          value={(data.text as string) ?? ""}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          placeholder={
            type === "dialogue"
              ? "Ce que dit le personnage..."
              : "Texte narratif..."
          }
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>
    </>
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
      options: [...options, { text: "", is_correct: false, feedback: "" }],
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
        <div className="flex flex-col gap-3">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border ${
                opt.is_correct ? "border-green-600/50 bg-green-900/10" : "border-slate-700 bg-slate-800/50"
              }`}
            >
              <div className="flex gap-2 items-start mb-2">
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
              <input
                type="text"
                value={opt.feedback}
                onChange={(e) => updateOption(i, { feedback: e.target.value })}
                placeholder="Feedback après réponse..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
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
    </>
  );
}
