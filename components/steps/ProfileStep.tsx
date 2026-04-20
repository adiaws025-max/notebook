"use client";
import type { DataProfile } from "@/types";

interface Props {
  profile: DataProfile;
  onContinue: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  number: "text-blue-400",
  string: "text-zinc-300",
  date: "text-purple-400",
  boolean: "text-green-400",
  unknown: "text-zinc-500",
};

export default function ProfileStep({ profile, onContinue }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Data Profile</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Column-level analysis before visualization.
        </p>
      </div>

      {/* Quality score */}
      <div className="bg-zinc-800 rounded-xl p-5 flex items-center gap-6">
        <div className="text-center">
          <div
            className={`text-5xl font-bold ${
              profile.qualityScore >= 80
                ? "text-green-400"
                : profile.qualityScore >= 50
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {profile.qualityScore}
          </div>
          <div className="text-zinc-400 text-xs mt-1">Quality Score</div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl font-semibold text-white">{profile.rowCount.toLocaleString()}</div>
            <div className="text-zinc-400 text-xs">Rows</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{profile.columnCount}</div>
            <div className="text-zinc-400 text-xs">Columns</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{profile.duplicateRows}</div>
            <div className="text-zinc-400 text-xs">Remaining Dupes</div>
          </div>
        </div>
      </div>

      {/* Column cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {profile.columns.map((col) => (
          <div
            key={col.name}
            className="bg-zinc-800 border border-zinc-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm text-white font-medium">{col.name}</span>
              <span className={`text-xs font-medium ${TYPE_COLORS[col.type]}`}>
                {col.type} {col.typeConfidence < 0.9 ? `(${(col.typeConfidence * 100).toFixed(0)}%)` : ""}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400 mb-2">
              <div>
                <span className="text-zinc-500">Unique</span>
                <div className="text-zinc-200">{col.uniqueCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">Nulls</span>
                <div className={col.nullCount > 0 ? "text-yellow-400" : "text-zinc-200"}>
                  {col.nullCount} ({col.nullPercent.toFixed(1)}%)
                </div>
              </div>
              {col.mean !== undefined && (
                <div>
                  <span className="text-zinc-500">Mean</span>
                  <div className="text-zinc-200">{col.mean.toFixed(2)}</div>
                </div>
              )}
            </div>

            {col.min !== undefined && col.max !== undefined && (
              <div className="text-xs text-zinc-500">
                Range: <span className="text-zinc-300">{col.min?.toString()} – {col.max?.toString()}</span>
              </div>
            )}

            {col.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {col.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="text-xs text-yellow-400 bg-yellow-950/50 rounded px-2 py-1"
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="self-start bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
      >
        Continue to Visualize
      </button>
    </div>
  );
}
