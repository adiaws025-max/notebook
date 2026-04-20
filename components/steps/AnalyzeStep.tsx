"use client";
import type { Insight } from "@/types";

interface Props {
  insights: Insight[];
  onContinue: () => void;
}

const ICON: Record<Insight["type"], string> = {
  trend: "📈",
  risk: "⚠️",
  imbalance: "⚖️",
  correlation: "🔗",
  info: "ℹ️",
};

const BORDER: Record<Insight["type"], string> = {
  trend: "border-blue-700 bg-blue-950/30",
  risk: "border-red-700 bg-red-950/30",
  imbalance: "border-yellow-700 bg-yellow-950/30",
  correlation: "border-purple-700 bg-purple-950/30",
  info: "border-zinc-600 bg-zinc-800/50",
};

const TITLE_COLOR: Record<Insight["type"], string> = {
  trend: "text-blue-300",
  risk: "text-red-300",
  imbalance: "text-yellow-300",
  correlation: "text-purple-300",
  info: "text-zinc-300",
};

export default function AnalyzeStep({ insights, onContinue }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Insights</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Automatically generated observations from your dataset.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`border rounded-xl px-5 py-4 ${BORDER[insight.type]}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{ICON[insight.type]}</span>
              <span className={`font-semibold text-sm ${TITLE_COLOR[insight.type]}`}>
                {insight.title}
              </span>
              <span className="ml-auto text-zinc-600 text-xs font-mono">{insight.column}</span>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">{insight.body}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="self-start bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
      >
        Open Notebook
      </button>
    </div>
  );
}
