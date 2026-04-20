"use client";
import { useRef, useState } from "react";
import { parseCSV } from "@/lib/csv";
import type { ParsedData } from "@/types";

interface Props {
  onComplete: (data: ParsedData, fileName: string) => void;
}

export default function UploadStep({ onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await parseCSV(file);
      onComplete(data, file.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Upload your CSV</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Headers will be normalized. Drag and drop or click to browse.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${dragging
            ? "border-blue-400 bg-blue-950/30"
            : "border-zinc-600 hover:border-zinc-400 bg-zinc-900"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {loading ? (
          <p className="text-blue-400 font-medium">Parsing file...</p>
        ) : (
          <>
            <div className="text-4xl mb-3">📂</div>
            <p className="text-zinc-300 font-medium">Drop CSV here or click to upload</p>
            <p className="text-zinc-500 text-xs mt-1">Max recommended: 50,000 rows</p>
          </>
        )}
      </div>

      {error && (
        <div className="w-full max-w-xl bg-red-950 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
