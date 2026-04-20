export type ColumnType = "string" | "number" | "boolean" | "date" | "unknown";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  typeConfidence: number; // 0-1
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  warnings: string[];
}

export interface DataProfile {
  rowCount: number;
  columnCount: number;
  duplicateRows: number;
  columns: ColumnProfile[];
  qualityScore: number; // 0-100
}

export interface CleaningReport {
  originalRows: number;
  rowsAfterDedup: number;
  duplicatesRemoved: number;
  nullsFound: Record<string, number>;
  columnTypes: Record<string, ColumnType>;
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
}

export interface Insight {
  column: string;
  type: "trend" | "risk" | "imbalance" | "correlation" | "info";
  title: string;
  body: string;
}

export interface NotebookCell {
  id: string;
  type: "code" | "markdown";
  source: string;
  output?: string;
  outputType?: "text" | "image" | "error";
  status: "idle" | "running" | "done" | "error";
}

export interface WorkspaceEntry {
  id: string;
  name: string;
  createdAt: number;
  data: ParsedData;
  profile: DataProfile;
  cleaningReport: CleaningReport;
}

export type Step =
  | "upload"
  | "clean"
  | "profile"
  | "visualize"
  | "analyze"
  | "notebook";

export const STEPS: Step[] = [
  "upload",
  "clean",
  "profile",
  "visualize",
  "analyze",
  "notebook",
];

export const STEP_LABELS: Record<Step, string> = {
  upload: "Upload",
  clean: "Clean",
  profile: "Profile",
  visualize: "Visualize",
  analyze: "Analyze",
  notebook: "Notebook",
};
