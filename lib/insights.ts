import type { DataProfile, ParsedData, Insight } from "@/types";

const KNOWN_COLUMNS: Record<string, string> = {
  age: "age",
  income: "income",
  salary: "income",
  revenue: "revenue",
  price: "price",
  score: "score",
  rating: "rating",
  count: "count",
  total: "total",
  date: "date",
  year: "date",
  month: "date",
  gender: "category",
  sex: "category",
  category: "category",
  type: "category",
  status: "category",
  label: "category",
};

function columnMeaning(name: string): string | null {
  return KNOWN_COLUMNS[name.toLowerCase()] ?? null;
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0);
  const denX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));
  if (denX === 0 || denY === 0) return 0;
  return num / (denX * denY);
}

export function generateInsights(
  data: ParsedData,
  profile: DataProfile
): Insight[] {
  const insights: Insight[] = [];
  const { rows, headers } = data;

  // Per-column insights
  for (const col of profile.columns) {
    const meaning = columnMeaning(col.name);

    // High null warning
    if (col.nullPercent > 20) {
      insights.push({
        column: col.name,
        type: "risk",
        title: `High missing data in "${col.name}"`,
        body: `${col.nullPercent.toFixed(1)}% of values are missing. This may affect analysis accuracy.`,
      });
    }

    // Numeric trend insights
    if (col.type === "number" && col.mean !== undefined) {
      if (meaning === "age") {
        insights.push({
          column: col.name,
          type: "info",
          title: `Age distribution`,
          body: `Mean age is ${col.mean.toFixed(1)}, ranging from ${col.min} to ${col.max}.`,
        });
      } else if (meaning === "income" || meaning === "salary") {
        const mean = col.mean!;
        const max = Number(col.max);
        if (max > mean * 5) {
          insights.push({
            column: col.name,
            type: "risk",
            title: `Income outlier detected`,
            body: `Max value (${max.toLocaleString()}) is more than 5x the mean (${mean.toFixed(0)}). Possible outlier.`,
          });
        }
      } else if (meaning === "score" || meaning === "rating") {
        insights.push({
          column: col.name,
          type: "trend",
          title: `Score summary for "${col.name}"`,
          body: `Average: ${col.mean.toFixed(2)}, Range: ${col.min} – ${col.max}`,
        });
      }
    }

    // Category imbalance
    if (col.type === "string" && col.uniqueCount <= 10) {
      const valueCounts: Record<string, number> = {};
      rows.forEach((r) => {
        const v = r[col.name] ?? "";
        valueCounts[v] = (valueCounts[v] ?? 0) + 1;
      });
      const counts = Object.values(valueCounts);
      const total = counts.reduce((a, b) => a + b, 0);
      const maxPct = Math.max(...counts) / total;
      if (maxPct > 0.75) {
        const dominant = Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0][0];
        insights.push({
          column: col.name,
          type: "imbalance",
          title: `Class imbalance in "${col.name}"`,
          body: `"${dominant}" represents ${(maxPct * 100).toFixed(0)}% of all values. Dataset may be skewed.`,
        });
      }
    }
  }

  // Correlation insights across numeric columns
  const numericCols = profile.columns.filter((c) => c.type === "number");
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const colA = numericCols[i];
      const colB = numericCols[j];
      const xs = rows
        .map((r) => Number(r[colA.name]))
        .filter((v) => !isNaN(v));
      const ys = rows
        .map((r) => Number(r[colB.name]))
        .filter((v) => !isNaN(v));
      const len = Math.min(xs.length, ys.length);
      const r = pearsonCorrelation(xs.slice(0, len), ys.slice(0, len));
      if (Math.abs(r) > 0.7) {
        insights.push({
          column: `${colA.name} × ${colB.name}`,
          type: "correlation",
          title: `Strong ${r > 0 ? "positive" : "negative"} correlation`,
          body: `"${colA.name}" and "${colB.name}" are ${r > 0 ? "positively" : "negatively"} correlated (r = ${r.toFixed(2)}). They tend to ${r > 0 ? "increase" : "move inversely"} together.`,
        });
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      column: "dataset",
      type: "info",
      title: "Dataset looks healthy",
      body: "No significant data quality issues, imbalances, or strong correlations detected.",
    });
  }

  return insights;
}
