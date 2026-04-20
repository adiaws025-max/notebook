"use client";
import type { Step } from "@/types";
import { STEPS, STEP_LABELS } from "@/types";

interface Props {
  current: Step;
  unlocked: Set<Step>;
  onChange: (step: Step) => void;
}

export default function StepNav({ current, unlocked, onChange }: Props) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((step, i) => {
        const isUnlocked = unlocked.has(step);
        const isCurrent = step === current;
        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-px mx-1 ${isUnlocked ? "bg-zinc-500" : "bg-zinc-700"}`} />
            )}
            <button
              disabled={!isUnlocked}
              onClick={() => isUnlocked && onChange(step)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${isCurrent
                  ? "bg-blue-600 text-white"
                  : isUnlocked
                  ? "text-zinc-300 hover:bg-zinc-700"
                  : "text-zinc-600 cursor-not-allowed"
                }`}
            >
              <span className="text-xs text-zinc-500 font-mono">{i + 1}</span>
              {STEP_LABELS[step]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
