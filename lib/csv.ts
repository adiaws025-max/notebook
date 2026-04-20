import Papa from "papaparse";
import type { ParsedData, CleaningReport, ColumnType } from "@/types";

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "unknown";

  const numParseable = nonEmpty.filter((v) => !isNaN(Number(v))).length;
  if (numParseable / nonEmpty.length > 0.85) return "number";

  const boolValues = new Set(["true", "false", "yes", "no", "0", "1"]);
  const boolParseable = nonEmpty.filter((v) =>
    boolValues.has(v.toLowerCase())
  ).length;
  if (boolParseable / nonEmpty.length > 0.9) return "boolean";

  const dateParseable = nonEmpty.filter((v) => !isNaN(Date.parse(v))).length;
  if (dateParseable / nonEmpty.length > 0.8) return "date";

  return "string";
}

export function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const allRows = results.data as string[][];
        if (allRows.length < 2) {
          reject(new Error("CSV must have at least a header row and one data row."));
          return;
        }

        const rawHeaders = allRows[0];
        const headers = rawHeaders.map(normalizeHeader);
        const dataRows = allRows.slice(1);

        const rows: Record<string, string>[] = dataRows.map((row) => {
          const record: Record<string, string> = {};
          headers.forEach((h, i) => {
            record[h] = (row[i] ?? "").toString().trim();
          });
          return record;
        });

        resolve({ headers, rows, rawRows: dataRows });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

export function cleanData(data: ParsedData): {
  cleaned: ParsedData;
  report: CleaningReport;
} {
  const { headers, rows } = data;

  // Dedup
  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Null counts
  const nullsFound: Record<string, number> = {};
  headers.forEach((h) => {
    nullsFound[h] = deduped.filter(
      (r) => r[h] === "" || r[h] === null || r[h] === undefined
    ).length;
  });

  // Detect types
  const columnTypes: Record<string, ColumnType> = {};
  headers.forEach((h) => {
    columnTypes[h] = detectType(deduped.map((r) => r[h]));
  });

  const report: CleaningReport = {
    originalRows: rows.length,
    rowsAfterDedup: deduped.length,
    duplicatesRemoved: rows.length - deduped.length,
    nullsFound,
    columnTypes,
  };

  return {
    cleaned: { headers, rows: deduped, rawRows: data.rawRows },
    report,
  };
}
