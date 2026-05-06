"use client";
import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Scatter, Pie, Doughnut, Radar, PolarArea, Bubble } from "react-chartjs-2";
import type { ParsedData, DataProfile } from "@/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ChartType =
  | "bar" | "horizontal-bar" | "stacked-bar"
  | "line" | "area" | "multi-line"
  | "histogram"
  | "scatter" | "bubble"
  | "pie" | "doughnut" | "polar"
  | "radar"
  | "heatmap"
  | "box";

type AggMethod = "count" | "sum" | "mean" | "min" | "max";
type SortOrder = "none" | "value-desc" | "value-asc" | "label-asc" | "label-desc";
type ColorTheme = "default" | "warm" | "cool" | "pastel" | "mono";

interface Props {
  data: ParsedData;
  profile: DataProfile;
  onContinue: () => void;
}

const COLOR_THEMES: Record<ColorTheme, string[]> = {
  default: ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#6366f1"],
  warm:    ["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#dc2626","#ea580c","#d97706","#ca8a04","#65a30d"],
  cool:    ["#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6","#0891b2","#0284c7","#2563eb","#4f46e5","#7c3aed"],
  pastel:  ["#93c5fd","#6ee7b7","#fcd34d","#fca5a5","#c4b5fd","#67e8f9","#f9a8d4","#bef264","#fdba74","#a5b4fc"],
  mono:    ["#f4f4f5","#d4d4d8","#a1a1aa","#71717a","#52525b","#3f3f46","#27272a","#18181b","#e4e4e7","#fafafa"],
};

const CHART_GROUPS: { group: string; charts: { value: ChartType; label: string }[] }[] = [
  {
    group: "Comparison",
    charts: [
      { value: "bar",            label: "Bar" },
      { value: "horizontal-bar", label: "H-Bar" },
      { value: "stacked-bar",    label: "Stacked" },
    ],
  },
  {
    group: "Trend",
    charts: [
      { value: "line",       label: "Line" },
      { value: "area",       label: "Area" },
      { value: "multi-line", label: "Multi-Line" },
    ],
  },
  {
    group: "Distribution",
    charts: [
      { value: "histogram", label: "Histogram" },
      { value: "scatter",   label: "Scatter" },
      { value: "bubble",    label: "Bubble" },
      { value: "box",       label: "Box Plot" },
    ],
  },
  {
    group: "Part-of-Whole",
    charts: [
      { value: "pie",     label: "Pie" },
      { value: "doughnut", label: "Doughnut" },
      { value: "polar",   label: "Polar" },
    ],
  },
  {
    group: "Multivariate",
    charts: [
      { value: "radar",   label: "Radar" },
      { value: "heatmap", label: "Heatmap" },
    ],
  },
];

function agg(values: number[], method: AggMethod): number {
  if (values.length === 0) return 0;
  switch (method) {
    case "count": return values.length;
    case "sum":   return values.reduce((a, b) => a + b, 0);
    case "mean":  return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":   return Math.min(...values);
    case "max":   return Math.max(...values);
  }
}

function aggByCategory(
  rows: Record<string, unknown>[],
  catCol: string,
  valCol: string,
  method: AggMethod
): [string, number][] {
  const groups: Record<string, number[]> = {};
  rows.forEach((r) => {
    const key = String(r[catCol] ?? "unknown");
    const val = Number(r[valCol]);
    if (!isNaN(val)) {
      groups[key] = groups[key] ?? [];
      groups[key].push(val);
    }
  });
  return Object.entries(groups).map(([k, vals]) => [k, agg(vals, method)]);
}

function sortEntries(entries: [string, number][], order: SortOrder): [string, number][] {
  if (order === "value-desc") return [...entries].sort((a, b) => b[1] - a[1]);
  if (order === "value-asc")  return [...entries].sort((a, b) => a[1] - b[1]);
  if (order === "label-asc")  return [...entries].sort((a, b) => a[0].localeCompare(b[0]));
  if (order === "label-desc") return [...entries].sort((a, b) => b[0].localeCompare(a[0]));
  return entries;
}

function buildHistogram(values: number[], bins: number) {
  if (values.length === 0) return { labels: [] as string[], counts: [] as number[] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins || 1;
  const counts = Array<number>(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / binSize), bins - 1);
    counts[idx]++;
  });
  const labels = Array.from({ length: bins }, (_, i) =>
    `${(min + i * binSize).toFixed(1)}`
  );
  return { labels, counts };
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, sdx = 0, sdy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    sdx += (x[i] - mx) ** 2;
    sdy += (y[i] - my) ** 2;
  }
  return sdx && sdy ? num / Math.sqrt(sdx * sdy) : 0;
}

function boxStats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const q1 = s[Math.floor(n * 0.25)] ?? 0;
  const med = s[Math.floor(n * 0.5)] ?? 0;
  const q3 = s[Math.floor(n * 0.75)] ?? 0;
  const iqr = q3 - q1;
  return { q1, med, q3, low: Math.max(s[0], q1 - 1.5 * iqr), high: Math.min(s[n - 1], q3 + 1.5 * iqr) };
}

const SCALE_OPTS = {
  x: { ticks: { color: "#a1a1aa", maxRotation: 45, font: { size: 11 } }, grid: { color: "#27272a" } },
  y: { ticks: { color: "#a1a1aa", font: { size: 11 } }, grid: { color: "#27272a" } },
};
const RADIAL_OPTS = {
  r: {
    ticks: { color: "#a1a1aa", backdropColor: "transparent" },
    grid: { color: "#3f3f46" },
    pointLabels: { color: "#d4d4d8", font: { size: 11 } },
  },
};
const BASE_PLUGINS = {
  legend: { labels: { color: "#d4d4d8", font: { size: 12 } } },
  tooltip: { enabled: true },
};

export default function VisualizeStep({ data, profile, onContinue }: Props) {
  const rows = data.rows;
  const numericCols = profile.columns.filter((c) => c.type === "number").map((c) => c.name);
  const catCols = profile.columns.filter((c) => c.type === "string" && c.uniqueCount <= 30).map((c) => c.name);
  const allCols = data.headers;

  const [chartType, setChartType]   = useState<ChartType>("bar");
  const [xCol, setXCol]             = useState(catCols[0] ?? allCols[0] ?? "");
  const [yCol, setYCol]             = useState(numericCols[0] ?? "");
  const [y2Col, setY2Col]           = useState(numericCols[1] ?? numericCols[0] ?? "");
  const [y3Col, setY3Col]           = useState(numericCols[2] ?? "");
  const [sizeCol, setSizeCol]       = useState(numericCols[2] ?? numericCols[0] ?? "");
  const [aggMethod, setAggMethod]   = useState<AggMethod>("sum");
  const [topN, setTopN]             = useState(20);
  const [sortOrder, setSortOrder]   = useState<SortOrder>("value-desc");
  const [binCount, setBinCount]     = useState(20);
  const [colorTheme, setColorTheme] = useState<ColorTheme>("default");
  const [showHeatVals, setShowHeatVals] = useState(true);

  const COLORS = COLOR_THEMES[colorTheme];

  // Heatmap correlation matrix
  const heatmap = useMemo(() => {
    if (chartType !== "heatmap" || numericCols.length < 2) return null;
    const vecs = numericCols.map((col) => rows.map((r) => Number(r[col])).filter((v) => !isNaN(v)));
    const matrix = numericCols.map((_, i) =>
      numericCols.map((_, j) => parseFloat(pearson(vecs[i], vecs[j]).toFixed(2)))
    );
    return { cols: numericCols, matrix };
  }, [chartType, numericCols, rows]);

  const chartData = useMemo(() => {
    if (chartType === "heatmap") return null;

    // Pie / Doughnut / Polar
    if (chartType === "pie" || chartType === "doughnut" || chartType === "polar") {
      let entries: [string, number][] = yCol && numericCols.includes(yCol)
        ? aggByCategory(rows, xCol, yCol, aggMethod)
        : (() => {
            const counts: Record<string, number> = {};
            rows.forEach((r) => { const v = String(r[xCol] ?? "?"); counts[v] = (counts[v] ?? 0) + 1; });
            return Object.entries(counts);
          })();
      entries = sortEntries(entries, sortOrder).slice(0, topN);
      return {
        labels: entries.map(([k]) => k),
        datasets: [{ data: entries.map(([, v]) => v), backgroundColor: COLORS.map((c) => c + "cc"), borderColor: COLORS, borderWidth: 1 }],
      };
    }

    // Histogram
    if (chartType === "histogram" && yCol) {
      const vals = rows.map((r) => Number(r[yCol])).filter((v) => !isNaN(v));
      const { labels, counts } = buildHistogram(vals, binCount);
      return {
        labels,
        datasets: [{ label: yCol, data: counts, backgroundColor: COLORS[0] + "cc", borderColor: COLORS[0], borderWidth: 1 }],
      };
    }

    // Scatter
    if (chartType === "scatter" && yCol && y2Col) {
      const points = rows.map((r) => ({ x: Number(r[yCol]), y: Number(r[y2Col]) })).filter((p) => !isNaN(p.x) && !isNaN(p.y));
      return { datasets: [{ label: `${yCol} vs ${y2Col}`, data: points, backgroundColor: COLORS[0] + "88", pointRadius: 4 }] };
    }

    // Bubble
    if (chartType === "bubble" && yCol && y2Col && sizeCol) {
      const maxVal = Math.max(...rows.map((r) => Math.abs(Number(r[sizeCol]))).filter((v) => !isNaN(v)), 1);
      const points = rows
        .map((r) => ({ x: Number(r[yCol]), y: Number(r[y2Col]), r: Math.max(3, (Math.abs(Number(r[sizeCol])) / maxVal) * 20) }))
        .filter((p) => !isNaN(p.x) && !isNaN(p.y));
      return { datasets: [{ label: `${yCol} × ${y2Col} (size: ${sizeCol})`, data: points, backgroundColor: COLORS[0] + "88" }] };
    }

    // Stacked Bar
    if (chartType === "stacked-bar") {
      const multiCols = [yCol, y2Col, y3Col].filter((c) => c && numericCols.includes(c));
      const cats = [...new Set(rows.map((r) => String(r[xCol] ?? "")))].slice(0, topN);
      return {
        labels: cats,
        datasets: multiCols.map((col, i) => ({
          label: col,
          data: cats.map((cat) => {
            const vals = rows.filter((r) => String(r[xCol]) === cat).map((r) => Number(r[col])).filter((v) => !isNaN(v));
            return agg(vals, aggMethod);
          }),
          backgroundColor: COLORS[i % COLORS.length] + "cc",
          borderColor: COLORS[i % COLORS.length],
          borderWidth: 1,
          stack: "s",
        })),
      };
    }

    // Multi-Line
    if (chartType === "multi-line") {
      const multiCols = [yCol, y2Col, y3Col].filter((c) => c && numericCols.includes(c));
      const labels = rows.slice(0, 100).map((r) => String(r[xCol] ?? ""));
      return {
        labels,
        datasets: multiCols.map((col, i) => ({
          label: col,
          data: rows.slice(0, 100).map((r) => Number(r[col]) || 0),
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length] + "33",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 2,
        })),
      };
    }

    // Radar
    if (chartType === "radar") {
      const metricCols = [yCol, y2Col, y3Col].filter((c) => c && numericCols.includes(c));
      const cats = [...new Set(rows.map((r) => String(r[xCol] ?? "")))].slice(0, 6);
      return {
        labels: metricCols,
        datasets: cats.map((cat, i) => {
          const catRows = rows.filter((r) => String(r[xCol]) === cat);
          return {
            label: cat,
            data: metricCols.map((col) => {
              const vals = catRows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
              return agg(vals, aggMethod);
            }),
            backgroundColor: COLORS[i % COLORS.length] + "44",
            borderColor: COLORS[i % COLORS.length],
            borderWidth: 2,
            pointBackgroundColor: COLORS[i % COLORS.length],
          };
        }),
      };
    }

    // Box Plot (floating bars: [q1, q3] + separate whisker dataset)
    if (chartType === "box" && xCol && yCol) {
      const cats = [...new Set(rows.map((r) => String(r[xCol] ?? "")))].slice(0, topN);
      const stats = cats.map((cat) => {
        const vals = rows.filter((r) => String(r[xCol]) === cat).map((r) => Number(r[yCol])).filter((v) => !isNaN(v));
        return vals.length ? boxStats(vals) : { q1: 0, med: 0, q3: 0, low: 0, high: 0 };
      });
      return {
        labels: cats,
        datasets: [
          {
            label: "Whisker range",
            data: stats.map((s) => [s.low, s.high]),
            backgroundColor: COLORS[1] + "33",
            borderColor: COLORS[1],
            borderWidth: 1,
            borderSkipped: false,
            barPercentage: 0.15,
          },
          {
            label: "IQR (Q1–Q3)",
            data: stats.map((s) => [s.q1, s.q3]),
            backgroundColor: COLORS[0] + "99",
            borderColor: COLORS[0],
            borderWidth: 2,
            borderSkipped: false,
          },
          {
            label: "Median",
            data: stats.map((s) => [s.med - 0.001, s.med + 0.001]),
            backgroundColor: "#ffffff",
            borderColor: "#ffffff",
            borderWidth: 3,
            borderSkipped: false,
            barPercentage: 0.6,
          },
        ],
      };
    }

    // Bar / Horizontal Bar — aggregate by category
    if (chartType === "bar" || chartType === "horizontal-bar") {
      let entries = yCol ? aggByCategory(rows, xCol, yCol, aggMethod) : [];
      entries = sortEntries(entries, sortOrder).slice(0, topN);
      return {
        labels: entries.map(([k]) => k),
        datasets: [{
          label: `${aggMethod}(${yCol})`,
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length] + "cc"),
          borderColor: entries.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 1,
        }],
      };
    }

    // Line / Area — raw time-series (up to 100 rows)
    const labels = rows.slice(0, 100).map((r) => String(r[xCol] ?? ""));
    return {
      labels,
      datasets: yCol ? [{
        label: yCol,
        data: rows.slice(0, 100).map((r) => Number(r[yCol]) || 0),
        backgroundColor: COLORS[0] + "44",
        borderColor: COLORS[0],
        borderWidth: 2,
        fill: chartType === "area",
        tension: 0.3,
        pointRadius: 2,
      }] : [],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, xCol, yCol, y2Col, y3Col, sizeCol, aggMethod, topN, sortOrder, binCount, colorTheme, rows]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = chartData as any;

  function renderChart() {
    // Correlation Heatmap — custom table rendering
    if (chartType === "heatmap") {
      if (!heatmap) return <p className="text-zinc-400 text-sm">Need at least 2 numeric columns for a heatmap.</p>;
      const { cols, matrix } = heatmap;
      const corrColor = (v: number) =>
        v > 0.7 ? "#10b981" : v > 0.3 ? "#3b82f6" : v > -0.3 ? "#71717a" : v > -0.7 ? "#f59e0b" : "#ef4444";
      return (
        <div className="overflow-auto">
          <table className="text-xs text-center border-collapse w-full">
            <thead>
              <tr>
                <th className="p-1 text-zinc-500 min-w-20"></th>
                {cols.map((c) => (
                  <th key={c} className="p-1 text-zinc-300 font-medium max-w-20 truncate" title={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={cols[i]}>
                  <td className="p-1 text-zinc-300 font-medium text-right pr-3 max-w-24 truncate" title={cols[i]}>{cols[i]}</td>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className="p-2"
                      style={{ backgroundColor: corrColor(v) + "44", border: "1px solid #27272a", minWidth: 52 }}
                      title={`${cols[i]} ↔ ${cols[j]}: ${v}`}
                    >
                      {showHeatVals && (
                        <span className="font-mono font-semibold" style={{ color: corrColor(v) }}>
                          {v.toFixed(2)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-zinc-400">
            {[
              { color: "#10b981", label: "> 0.7  Strong +" },
              { color: "#3b82f6", label: "0.3 – 0.7  Moderate +" },
              { color: "#71717a", label: "−0.3 – 0.3  Weak" },
              { color: "#f59e0b", label: "−0.7 – −0.3  Moderate −" },
              { color: "#ef4444", label: "< −0.7  Strong −" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (!d || d.datasets?.length === 0) {
      return <p className="text-zinc-500 text-sm">Select columns to render a chart.</p>;
    }

    const opts = { responsive: true, plugins: BASE_PLUGINS, scales: SCALE_OPTS };
    const radOpts = { responsive: true, plugins: BASE_PLUGINS, scales: RADIAL_OPTS };

    if (chartType === "pie")          return <Pie data={d} options={{ responsive: true, plugins: BASE_PLUGINS }} />;
    if (chartType === "doughnut")     return <Doughnut data={d} options={{ responsive: true, plugins: BASE_PLUGINS, cutout: "60%" }} />;
    if (chartType === "polar")        return <PolarArea data={d} options={radOpts} />;
    if (chartType === "radar")        return <Radar data={d} options={radOpts} />;
    if (chartType === "scatter")      return <Scatter data={d} options={opts} />;
    if (chartType === "bubble")       return <Bubble data={d} options={opts} />;
    if (chartType === "line" || chartType === "area" || chartType === "multi-line") return <Line data={d} options={opts} />;
    if (chartType === "horizontal-bar") return <Bar data={d} options={{ ...opts, indexAxis: "y" as const }} />;
    if (chartType === "stacked-bar")  return <Bar data={d} options={{ ...opts, scales: { x: { ...SCALE_OPTS.x, stacked: true }, y: { ...SCALE_OPTS.y, stacked: true } } }} />;
    return <Bar data={d} options={opts} />;
  }

  const isCompare  = ["bar","horizontal-bar","stacked-bar"].includes(chartType);
  const isTrend    = ["line","area","multi-line"].includes(chartType);
  const isMultiY   = ["stacked-bar","multi-line","radar"].includes(chartType);
  const noXAxis    = ["histogram","scatter","bubble","heatmap"].includes(chartType);
  const noYAxis    = ["heatmap"].includes(chartType);
  const needAgg    = ["bar","horizontal-bar","stacked-bar","pie","doughnut","polar","radar","box"].includes(chartType);
  const needSort   = ["bar","horizontal-bar","pie","doughnut","polar"].includes(chartType);
  const needTopN   = !["scatter","bubble","histogram","heatmap","line","area","multi-line"].includes(chartType);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Visualize</h2>
        <p className="text-zinc-400 text-sm mt-1">15 chart types with filters and aggregation.</p>
      </div>

      {/* Chart type picker */}
      <div className="bg-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-500 mb-3 font-medium uppercase tracking-wide">Chart Type</p>
        <div className="flex flex-wrap gap-5">
          {CHART_GROUPS.map(({ group, charts }) => (
            <div key={group}>
              <p className="text-xs text-zinc-500 mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1">
                {charts.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setChartType(c.value)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                      chartType === c.value
                        ? "bg-blue-600 text-white shadow"
                        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Column selectors + Filters */}
      <div className="bg-zinc-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* X / Category */}
        {!noXAxis && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              {chartType === "box" || chartType === "radar" ? "Category / Group" : "X Axis / Category"}
            </label>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Y / Primary metric */}
        {!noYAxis && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              {chartType === "scatter" || chartType === "bubble" ? "X Numeric" :
               chartType === "histogram" ? "Column" :
               chartType === "pie" || chartType === "doughnut" || chartType === "polar" ? "Value (opt)" :
               isMultiY ? "Metric 1" : "Y Axis / Value"}
            </label>
            <select value={yCol} onChange={(e) => setYCol(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              {(numericCols.length ? numericCols : allCols).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Y2 */}
        {["scatter","bubble","stacked-bar","multi-line","radar"].includes(chartType) && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              {chartType === "scatter" || chartType === "bubble" ? "Y Numeric" : "Metric 2"}
            </label>
            <select value={y2Col} onChange={(e) => setY2Col(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              {(numericCols.length ? numericCols : allCols).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Y3 */}
        {["stacked-bar","multi-line","radar"].includes(chartType) && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Metric 3 (optional)</label>
            <select value={y3Col} onChange={(e) => setY3Col(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              <option value="">— none —</option>
              {(numericCols.length ? numericCols : allCols).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Bubble size */}
        {chartType === "bubble" && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Bubble Size</label>
            <select value={sizeCol} onChange={(e) => setSizeCol(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              {(numericCols.length ? numericCols : allCols).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Aggregation */}
        {needAgg && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Aggregation</label>
            <select value={aggMethod} onChange={(e) => setAggMethod(e.target.value as AggMethod)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              <option value="sum">Sum</option>
              <option value="mean">Average</option>
              <option value="count">Count</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </div>
        )}

        {/* Top N */}
        {needTopN && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Show Top</label>
            <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={200}>All (≤200)</option>
            </select>
          </div>
        )}

        {/* Sort */}
        {needSort && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Sort By</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              <option value="value-desc">Value ↓</option>
              <option value="value-asc">Value ↑</option>
              <option value="label-asc">Label A–Z</option>
              <option value="label-desc">Label Z–A</option>
              <option value="none">Original Order</option>
            </select>
          </div>
        )}

        {/* Histogram bin slider */}
        {chartType === "histogram" && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Bins: {binCount}</label>
            <input type="range" min={5} max={50} value={binCount}
              onChange={(e) => setBinCount(Number(e.target.value))}
              className="w-full accent-blue-500 mt-1" />
          </div>
        )}

        {/* Color theme */}
        {!["heatmap"].includes(chartType) && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Color Theme</label>
            <select value={colorTheme} onChange={(e) => setColorTheme(e.target.value as ColorTheme)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600">
              <option value="default">Default</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
              <option value="pastel">Pastel</option>
              <option value="mono">Monochrome</option>
            </select>
          </div>
        )}

        {/* Heatmap: show values toggle */}
        {chartType === "heatmap" && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={showHeatVals} onChange={(e) => setShowHeatVals(e.target.checked)}
                className="accent-blue-500 w-4 h-4" />
              Show correlation values
            </label>
          </div>
        )}

        {/* Hint for line/area */}
        {(isTrend && !isMultiY) && (
          <div className="col-span-full">
            <p className="text-xs text-zinc-500">Showing up to 100 rows in original order.</p>
          </div>
        )}
        {isCompare && (
          <div className="col-span-full">
            <p className="text-xs text-zinc-500">
              Values aggregated per category using <span className="text-zinc-300">{aggMethod}</span>.
            </p>
          </div>
        )}
      </div>

      {/* Chart canvas */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 min-h-80 flex items-start justify-center">
        <div className="w-full max-w-3xl">
          {renderChart()}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="self-start bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
      >
        Continue to Analyze
      </button>
    </div>
  );
}
