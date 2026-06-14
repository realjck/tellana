"use client";

interface BranchOption {
  label: string;
  edgeId: number | null;
  targetNodeId: number | null;
  visited: boolean;
}

interface Props {
  options: BranchOption[];
  onChoice: (edgeId: number, targetNodeId: number) => void;
}

export default function BranchOverlay({ options, onChoice }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center player-branch-overlay">
      <div className="flex flex-col gap-8 w-full max-w-[1100px] px-16">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (opt.edgeId !== null && opt.targetNodeId !== null) {
                onChoice(opt.edgeId, opt.targetNodeId);
              }
            }}
            className={`w-full px-12 py-8 rounded-xl text-left text-[44px] font-medium border cursor-pointer transition-all player-option ${opt.visited ? "player-branch-option-visited" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
