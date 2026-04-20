"use client";
import type { ParsedData, CleaningReport } from "@/types";

interface Props {
  original: ParsedData;
  cleaned: ParsedData;
  report: CleaningReport;
  onConfirm: () => void;
}

export default function CleanStep({ original, cleaned, report, onConfirm }: Props) {
  const nullColumns = Object.entries(report.nullsFound).filter(([, count]) => count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Cleaning Report</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Review what was found and cleaned before proceeding.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Original Rows", value: report.originalRows },
          { label: "After Dedup", value: report.rowsAfterDedup },
          { label: "Duplicates Removed", value: report.duplicatesRemoved },
          { label: "Columns", value: original.headers.length },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
            <div className="text-zinc-400 text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Column types */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-2">Detected Column Types</h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800 text-zinc-400 text-left">
                <th className="px-4 py-2">Column</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Nulls</th>
              </tr>
            </thead>
            <tbody>
              {original.headers.map((h) => (
                <tr key={h} className="border-t border-zinc-700 text-zinc-300">
                  <td className="px-4 py-2 font-mono text-xs">{h}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      report.columnTypes[h] === "number"
                        ? "bg-blue-900 text-blue-300"
                        : report.columnTypes[h] === "date"
                        ? "bg-purple-900 text-purple-300"
                        : report.columnTypes[h] === "boolean"
                        ? "bg-green-900 text-green-300"
                        : "bg-zinc-700 text-zinc-300"
                    }`}>
                      {report.columnTypes[h]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {report.nullsFound[h] > 0 ? (
                      <span className="text-yellow-400">{report.nullsFound[h]}</span>
                    ) : (
                      <span className="text-zinc-500">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Null warnings */}
      {nullColumns.length > 0 && (
        <div className="bg-yellow-950 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm font-medium mb-1">Missing Value Warning</p>
          <ul className="text-yellow-400 text-xs space-y-0.5">
            {nullColumns.map(([col, count]) => (
              <li key={col}>
                <span className="font-mono">{col}</span>: {count} null{count !== 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.duplicatesRemoved === 0 && nullColumns.length === 0 && (
        <div className="bg-green-950 border border-green-700 rounded-lg p-4 text-green-300 text-sm">
          Dataset is clean — no duplicates or missing values found.
        </div>
      )}

      <button
        onClick={onConfirm}
        className="self-start bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
      >
        Confirm &amp; Continue
      </button>
    </div>
  );
}
