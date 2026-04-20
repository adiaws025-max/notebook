import type {
  ParsedData,
  CleaningReport,
  DataProfile,
  ColumnProfile,
  ColumnType,
} from "@/types";

function getTypeConfidence(values: string[], type: ColumnType): number {
  const nonEmpty = values.filter((v) => v !== "");
  if (nonEmpty.length === 0) return 0;

  if (type === "number") {
    return nonEmpty.filter((v) => !isNaN(Number(v))).length / nonEmpty.length;
  }
  if (type === "boolean") {
    const boolSet = new Set(["true", "false", "yes", "no", "0", "1"]);
    return (
      nonEmpty.filter((v) => boolSet.has(v.toLowerCase())).length /
      nonEmpty.length
    );
  }
  if (type === "date") {
    return (
      nonEmpty.filter((v) => !isNaN(Date.parse(v))).length / nonEmpty.length
    );
  }
  return 1.0;
}

function buildColumnProfile(
  name: string,
  values: string[],
  type: ColumnType,
  totalRows: number
): ColumnProfile {
  const nullCount = values.filter((v) => v === "" || v == null).length;
  const nonEmpty = values.filter((v) => v !== "" && v != null);
  const uniqueCount = new Set(nonEmpty).size;
  const warnings: string[] = [];

  if (nullCount / totalRows > 0.3) {
    warnings.push(`High null rate: ${((nullCount / totalRows) * 100).toFixed(1)}% missing`);
  }
  if (uniqueCount === 1 && totalRows > 1) {
    warnings.push("Constant column — all values are identical");
  }
  if (type === "string" && uniqueCount === totalRows) {
    warnings.push("Possible ID column — all values are unique");
  }

  let min: number | string | undefined;
  let max: number | string | undefined;
  let mean: number | undefined;

  if (type === "number") {
    const nums = nonEmpty.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      min = Math.min(...nums);
      max = Math.max(...nums);
      mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    if (mean !== undefined && (mean < 0 || mean > 1e9)) {
      warnings.push("Contains extreme numeric values");
    }
  } else if (type === "string") {
    const sorted = [...nonEmpty].sort();
    min = sorted[0];
    max = sorted[sorted.length - 1];
  }

  return {
    name,
    type,
    typeConfidence: getTypeConfidence(values, type),
    nullCount,
    nullPercent: totalRows > 0 ? (nullCount / totalRows) * 100 : 0,
    uniqueCount,
    min,
    max,
    mean,
    warnings,
  };
}

export function profileData(
  data: ParsedData,
  report: CleaningReport
): DataProfile {
  const { headers, rows } = data;
  const totalRows = rows.length;

  // Count exact duplicate rows
  const seen = new Set<string>();
  let duplicateRows = 0;
  rows.forEach((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  });

  const columns: ColumnProfile[] = headers.map((h) => {
    const values = rows.map((r) => r[h] ?? "");
    const type = report.columnTypes[h] ?? "unknown";
    return buildColumnProfile(h, values, type, totalRows);
  });

  const totalNulls = columns.reduce((sum, c) => sum + c.nullCount, 0);
  const totalCells = totalRows * headers.length;
  const nullRatio = totalCells > 0 ? totalNulls / totalCells : 0;
  const warningColumns = columns.filter((c) => c.warnings.length > 0).length;
  const qualityScore = Math.max(
    0,
    Math.round(100 - nullRatio * 60 - (warningColumns / headers.length) * 40)
  );

  return {
    rowCount: totalRows,
    columnCount: headers.length,
    duplicateRows,
    columns,
    qualityScore,
  };
}
