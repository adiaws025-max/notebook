"use client";
import { useState, useRef } from "react";
import { getPyodide, detectRequiredPackages, ensurePackages } from "@/lib/pyodide";
import { attemptRecovery } from "@/lib/errorRecovery";
import type { NotebookCell, ParsedData } from "@/types";

interface Props {
  data: ParsedData;
}

function generateId(): string {
  return `cell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildStarterCells(data: ParsedData): NotebookCell[] {
  const headers = data.headers;
  const numericCols = headers.filter((h) => {
    const vals = data.rows.map((r) => r[h]);
    return vals.filter((v) => !isNaN(Number(v))).length / vals.length > 0.8;
  });

  const csvData = [headers, ...data.rows.map((r) => headers.map((h) => r[h]))].join("\n");

  return [
    {
      id: generateId(),
      type: "markdown",
      source: "## Step 1 — Load Data\nLoad the CSV data into a pandas DataFrame.",
      status: "idle",
    },
    {
      id: generateId(),
      type: "code",
      source: `import pandas as pd
import io

csv_data = """${csvData.slice(0, 5000)}"""
df = pd.read_csv(io.StringIO(csv_data))
print(f"Loaded {len(df)} rows × {len(df.columns)} columns")
print(df.dtypes)`,
      status: "idle",
    },
    {
      id: generateId(),
      type: "markdown",
      source: "## Step 2 — Inspect Structure\nCheck shape, head, and info.",
      status: "idle",
    },
    {
      id: generateId(),
      type: "code",
      source: `print(df.shape)
print(df.head(5).to_string())`,
      status: "idle",
    },
    {
      id: generateId(),
      type: "markdown",
      source: "## Step 3 — Cleaning Validation\nCheck for nulls and duplicates.",
      status: "idle",
    },
    {
      id: generateId(),
      type: "code",
      source: `print("Null counts:")
print(df.isnull().sum())
print(f"\\nDuplicate rows: {df.duplicated().sum()}")`,
      status: "idle",
    },
    {
      id: generateId(),
      type: "markdown",
      source: "## Step 4 — Statistical Summary\nDescriptive statistics for numeric columns.",
      status: "idle",
    },
    {
      id: generateId(),
      type: "code",
      source: `print(df.describe().to_string())`,
      status: "idle",
    },
    ...(numericCols.length >= 2
      ? [
          {
            id: generateId(),
            type: "markdown" as const,
            source: "## Step 5 — Visualization\nGenerate a correlation heatmap.",
            status: "idle" as const,
          },
          {
            id: generateId(),
            type: "code" as const,
            source: `import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

numeric_df = df[${JSON.stringify(numericCols)}].apply(pd.to_numeric, errors='coerce')
corr = numeric_df.corr()

fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(corr.values, cmap='coolwarm', vmin=-1, vmax=1)
ax.set_xticks(range(len(corr.columns)))
ax.set_yticks(range(len(corr.columns)))
ax.set_xticklabels(corr.columns, rotation=45, ha='right', color='white')
ax.set_yticklabels(corr.columns, color='white')
ax.set_facecolor('#18181b')
fig.patch.set_facecolor('#18181b')
plt.colorbar(im, ax=ax)
plt.title('Correlation Matrix', color='white')

import base64, io as _io
buf = _io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', facecolor='#18181b')
plt.close()
buf.seek(0)
img_b64 = base64.b64encode(buf.read()).decode()
print("IMG:" + img_b64)`,
            status: "idle" as const,
          },
        ]
      : []),
  ];
}

export default function NotebookStep({ data }: Props) {
  const [cells, setCells] = useState<NotebookCell[]>(() => buildStarterCells(data));
  const [pyodideReady, setPyodideReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] = useState<Record<string, { fixedCode: string; explanation: string } | null>>({});
  const pyRef = useRef<Awaited<ReturnType<typeof getPyodide>> | null>(null);

  async function initPyodide() {
    setLoading(true);
    try {
      pyRef.current = await getPyodide();
      setPyodideReady(true);
    } catch (e: unknown) {
      alert("Failed to load Python runtime: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function updateCell(id: string, patch: Partial<NotebookCell>) {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function runCell(cell: NotebookCell) {
    if (!pyRef.current) return;
    updateCell(cell.id, { status: "running", output: undefined });

    try {
      const pkgs = detectRequiredPackages(cell.source);
      await ensurePackages(pyRef.current, pkgs);

      let output = "";
      // Capture stdout
      await pyRef.current.runPythonAsync(`
import sys, io as _sysio
_stdout_capture = _sysio.StringIO()
sys.stdout = _stdout_capture
`);
      await pyRef.current.runPythonAsync(cell.source);
      const captured = await pyRef.current.runPythonAsync(
        `_stdout_capture.getvalue()`
      ) as string;
      output = captured ?? "";

      // Reset stdout
      await pyRef.current.runPythonAsync(`sys.stdout = sys.__stdout__`);

      let outputType: NotebookCell["outputType"] = "text";
      if (output.startsWith("IMG:")) {
        outputType = "image";
        output = output.slice(4);
      }

      updateCell(cell.id, { status: "done", output, outputType });
      setRecovery((prev) => ({ ...prev, [cell.id]: null }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const result = attemptRecovery(cell.source, msg);
      updateCell(cell.id, { status: "error", output: msg, outputType: "error" });
      if (result.fixed) {
        setRecovery((prev) => ({
          ...prev,
          [cell.id]: { fixedCode: result.fixedCode, explanation: result.explanation },
        }));
      }
    }
  }

  async function runAll() {
    for (const cell of cells) {
      if (cell.type === "code") await runCell(cell);
    }
  }

  function addCell(type: "code" | "markdown") {
    setCells((prev) => [
      ...prev,
      { id: generateId(), type, source: "", status: "idle" },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Notebook</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Progressive Python cells. Each builds on the previous.
          </p>
        </div>
        <div className="flex gap-2">
          {!pyodideReady ? (
            <button
              onClick={initPyodide}
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? "Loading Python..." : "Start Python Runtime"}
            </button>
          ) : (
            <>
              <button
                onClick={runAll}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Run All
              </button>
              <button
                onClick={() => addCell("code")}
                className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
              >
                + Code
              </button>
              <button
                onClick={() => addCell("markdown")}
                className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
              >
                + Note
              </button>
            </>
          )}
        </div>
      </div>

      {!pyodideReady && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-zinc-400 text-sm">
          Click <strong className="text-white">Start Python Runtime</strong> to load Pyodide (~50 MB).
          Only pandas and numpy are preloaded. Other packages load on demand.
        </div>
      )}

      {cells.map((cell, idx) => (
        <div key={cell.id} className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          {/* Cell header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border-b border-zinc-700">
            <span className="text-zinc-500 text-xs font-mono">[{idx + 1}]</span>
            <span className="text-xs text-zinc-500">{cell.type}</span>
            {cell.status === "running" && (
              <span className="text-yellow-400 text-xs ml-1">running...</span>
            )}
            {cell.status === "done" && (
              <span className="text-green-400 text-xs ml-1">done</span>
            )}
            {cell.status === "error" && (
              <span className="text-red-400 text-xs ml-1">error</span>
            )}
            <div className="ml-auto flex gap-1">
              {cell.type === "code" && pyodideReady && (
                <button
                  onClick={() => runCell(cell)}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded border border-blue-800 hover:border-blue-600 transition-colors"
                >
                  Run
                </button>
              )}
              <button
                onClick={() => setCells((prev) => prev.filter((c) => c.id !== cell.id))}
                className="text-xs text-zinc-500 hover:text-red-400 px-2 py-0.5 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Source */}
          <textarea
            value={cell.source}
            onChange={(e) => updateCell(cell.id, { source: e.target.value })}
            className={`w-full bg-zinc-950 text-sm font-mono px-4 py-3 outline-none resize-none text-zinc-200 border-0 ${
              cell.type === "markdown" ? "text-zinc-400 italic" : ""
            }`}
            rows={Math.max(3, cell.source.split("\n").length)}
            placeholder={cell.type === "code" ? "# Python code..." : "Markdown note..."}
            spellCheck={false}
          />

          {/* Output */}
          {cell.output && (
            <div className={`border-t ${cell.outputType === "error" ? "border-red-800" : "border-zinc-700"}`}>
              {cell.outputType === "image" ? (
                <div className="p-4 bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${cell.output}`}
                    alt="plot output"
                    className="max-w-full rounded"
                  />
                </div>
              ) : (
                <pre
                  className={`px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${
                    cell.outputType === "error" ? "bg-red-950 text-red-300" : "bg-zinc-950 text-zinc-300"
                  }`}
                >
                  {cell.output}
                </pre>
              )}
            </div>
          )}

          {/* Recovery suggestion */}
          {recovery[cell.id] && (
            <div className="border-t border-yellow-800 bg-yellow-950/30 px-4 py-3">
              <p className="text-yellow-300 text-xs font-medium mb-2">
                Auto-fix available: {recovery[cell.id]!.explanation}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    updateCell(cell.id, { source: recovery[cell.id]!.fixedCode, output: undefined, status: "idle" });
                    setRecovery((prev) => ({ ...prev, [cell.id]: null }));
                  }}
                  className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded transition-colors"
                >
                  Apply Fix
                </button>
                <button
                  onClick={() => setRecovery((prev) => ({ ...prev, [cell.id]: null }))}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1 rounded transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
