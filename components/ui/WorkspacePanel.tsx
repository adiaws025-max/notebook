"use client";
import { useState } from "react";
import { listWorkspaces, deleteWorkspace } from "@/lib/storage";
import type { WorkspaceEntry } from "@/types";

interface Props {
  onLoad: (entry: WorkspaceEntry) => void;
}

export default function WorkspacePanel({ onLoad }: Props) {
  const [entries, setEntries] = useState<WorkspaceEntry[]>(() => listWorkspaces());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleDelete(id: string) {
    deleteWorkspace(id);
    setEntries(listWorkspaces());
    setConfirmDelete(null);
  }

  if (entries.length === 0) {
    return (
      <p className="text-zinc-500 text-sm">No saved workspaces yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 text-sm font-medium truncate">{e.name}</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {e.data.rows.length.toLocaleString()} rows · {e.data.headers.length} cols ·{" "}
              {new Date(e.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => onLoad(e)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-3 py-1 rounded transition-colors"
          >
            Load
          </button>
          {confirmDelete === e.id ? (
            <div className="flex gap-1">
              <button
                onClick={() => handleDelete(e.id)}
                className="text-xs text-red-400 border border-red-800 px-2 py-1 rounded hover:bg-red-950 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(e.id)}
              className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1 rounded transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
