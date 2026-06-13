"use client";

import { useEffect, useState } from "react";
import type { GraphChoice } from "@/types";

export function makeChoiceId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface BranchData {
  title: string;
  show_visited: boolean;
  choices: GraphChoice[];
}

interface Props {
  initial: BranchData;
  onSave: (data: BranchData) => void;
  onCancel: () => void;
}

export default function BranchSettingsModal({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [showVisited, setShowVisited] = useState(initial.show_visited !== false);
  const [choices, setChoices] = useState<GraphChoice[]>(
    initial.choices && initial.choices.length >= 2
      ? initial.choices
      : [
          { id: makeChoiceId(), label: "Choix 1" },
          { id: makeChoiceId(), label: "Choix 2" },
        ]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const updateLabel = (id: string, label: string) =>
    setChoices((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)));

  const addChoice = () =>
    setChoices((cs) => (cs.length >= 5 ? cs : [...cs, { id: makeChoiceId(), label: `Choix ${cs.length + 1}` }]));

  const removeChoice = (id: string) =>
    setChoices((cs) => (cs.length <= 2 ? cs : cs.filter((c) => c.id !== id)));

  const move = (index: number, dir: -1 | 1) =>
    setChoices((cs) => {
      const j = index + dir;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const handleSave = () => {
    const cleaned = choices.map((c, i) => ({ id: c.id, label: c.label.trim() || `Choix ${i + 1}` }));
    onSave({ title: title.trim(), show_visited: showVisited, choices: cleaned });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-elevated border border-white/10 rounded-lg shadow-2xl px-6 py-5 w-full max-w-md mx-4">
        <h2 className="text-fore text-base font-semibold mb-4">Paramètres de l&apos;embranchement</h2>

        <label className="block text-xs text-muted mb-1">Titre</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Embranchement"
          className="w-full bg-raised border border-white/15 rounded px-3 py-2 text-fore text-sm focus:outline-none mb-4"
        />

        <div className="text-xs text-muted mb-2">Choix ({choices.length}/5)</div>
        <div className="flex flex-col gap-2 mb-3">
          {choices.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input
                value={c.label}
                onChange={(e) => updateLabel(c.id, e.target.value)}
                placeholder={`Choix ${i + 1}`}
                className="flex-1 bg-raised border border-white/15 rounded px-3 py-1.5 text-fore text-sm focus:outline-none"
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter"
                className="w-7 h-7 rounded bg-raised hover:bg-surface text-muted disabled:opacity-30 text-sm">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === choices.length - 1} title="Descendre"
                className="w-7 h-7 rounded bg-raised hover:bg-surface text-muted disabled:opacity-30 text-sm">▼</button>
              <button onClick={() => removeChoice(c.id)} disabled={choices.length <= 2} title="Supprimer"
                className="w-7 h-7 rounded bg-raised hover:bg-red-600/70 text-muted disabled:opacity-30 text-sm">✕</button>
            </div>
          ))}
        </div>

        <button onClick={addChoice} disabled={choices.length >= 5}
          className="text-sm text-primary hover:underline disabled:opacity-40 disabled:no-underline mb-4">
          + Ajouter un choix
        </button>

        <label className="flex items-center gap-2 text-sm text-fore mb-5 cursor-pointer">
          <input type="checkbox" checked={showVisited} onChange={(e) => setShowVisited(e.target.checked)} />
          Afficher les liens déjà visités
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded bg-raised hover:bg-elevated/80 text-fore/70 text-sm transition-colors">
            Annuler
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
