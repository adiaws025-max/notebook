import type { WorkspaceEntry } from "@/types";

const STORAGE_KEY = "dataledger_workspaces";

export function listWorkspaces(): WorkspaceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkspaceEntry[];
  } catch {
    return [];
  }
}

export function saveWorkspace(entry: WorkspaceEntry): void {
  const existing = listWorkspaces();
  const idx = existing.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.unshift(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function loadWorkspace(id: string): WorkspaceEntry | null {
  return listWorkspaces().find((e) => e.id === id) ?? null;
}

export function deleteWorkspace(id: string): void {
  const updated = listWorkspaces().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
