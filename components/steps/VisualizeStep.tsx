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
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Scatter, Pie } from "react-chartjs-2";
import type { ParsedData, DataProfile } from "@/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type ChartType = "bar" | "histogram" | "line" | "scatter" | "pie";

interface Props {
  data: ParsedData;
  profile: DataProfile;
  onContinue: () => void;
}

const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
];

function buildHistogram(values: number[], bins = 20): { labels: string[]; counts: number[] } {
  if (values.length === 0) return { labels: [], counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binSize = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / binSize), bins - 1);
    counts[idx]++;
  });
  const labels = counts.map((_, i) => `${(min + i * binSize).toFixed(1)}`);
  return { labels, counts };
}

export default function VisualizeStep({ data, profile, onContinue }: Props) {
  const numericCols = profile.columns.filter((c) => c.type === "number").map((c) => c.name);
  const categoryCols = profile.columns.filter((c) => c.type === "string" && c.uniqueCount <= 30).map((c) => c.name);
  const allCols = data.headers;

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState<string>(categoryCols[0] ?? allCols[0] ?? "");
  const [yCol, setYCol] = useState<string>(numericCols[0] ?? "");
  const [y2Col, setY2Col] = useState<string>(numericCols[1] ?? "");

  const chartData = useMemo(() => {
    if (!xCol) return null;
    const rows = data.rows;

    if (chartType === "pie") {
      const counts: Record<string, number> = {};
      rows.forEach((r) => {
        const v = r[xCol] ?? "unknown";
        counts[v] = (counts[v] ?? 0) + 1;
      });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
      return {
        labels: entries.map(([k]) => k),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: COLORS,
          borderWidth: 0,
        }],
      };
    }

    if (chartType === "histogram" && yCol) {
      const values = rows.map((r) => Number(r[yCol])).filter((v) => !isNaN(v));
      const { labels, counts } = buildHistogram(values);
      return {
        labels,
        datasets: [{
          label: yCol,
          data: counts,
          backgroundColor: "#3b82f6cc",
          borderColor: "#3b82f6",
          borderWidth: 1,
        }],
      };
    }

    if (chartType === "scatter" && yCol && y2Col) {
      const points = rows
        .map((r) => ({ x: Number(r[yCol]), y: Number(r[y2Col]) }))
        .filter((p) => !isNaN(p.x) && !isNaN(p.y));
      return {
        datasets: [{
          label: `${yCol} vs ${y2Col}`,
          data: points,
          backgroundColor: "#3b82f688",
          pointRadius: 4,
        }],
      };
    }

    // bar / line
    const labels = rows.map((r) => r[xCol] ?? "").slice(0, 50);
    const datasets = yCol
      ? [{
          label: yCol,
          data: rows.slice(0, 50).map((r) => Number(r[yCol]) || 0),
          backgroundColor: "#3b82f6cc",
          borderColor: "#3b82f6",
          borderWidth: 2,
          fill: chartType === "line",
          tension: 0.3,
        }]
      : [];

    return { labels, datasets };
  }, [chartType, xCol, yCol, y2Col, data]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#d4d4d8" } },
    },
    scales: chartType !== "pie"
      ? {
          x: { ticks: { color: "#a1a1aa", maxRotation: 45 }, grid: { color: "#27272a" } },
          y: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" } },
        }
      : undefined,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderChart() {
    if (!chartData) return <p className="text-zinc-500">Select columns to render a chart.</p>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = chartData as any;
    if (chartType === "pie") return <Pie data={d} options={chartOptions} />;
    if (chartType === "scatter") return <Scatter data={d} options={chartOptions} />;
    if (chartType === "line") return <Line data={d} options={chartOptions} />;
    return <Bar data={d} options={chartOptions} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Visualize</h2>
        <p className="text-zinc-400 text-sm mt-1">Build charts from your dataset.</p>
      </div>

      {/* Controls */}
      <div className="bg-zinc-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Chart Type</label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600"
          >
            <option value="bar">Bar</option>
            <option value="histogram">Histogram</option>
            <option value="line">Line</option>
            <option value="scatter">Scatter</option>
            <option value="pie">Pie</option>
          </select>
        </div>

        {chartType !== "histogram" && chartType !== "scatter" && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">X Axis / Category</label>
            <select
              value={xCol}
              onChange={(e) => setXCol(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600"
            >
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {chartType !== "pie" && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              {chartType === "scatter" ? "X Numeric" : "Y Axis"}
            </label>
            <select
              value={yCol}
              onChange={(e) => setYCol(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600"
            >
              {(numericCols.length > 0 ? numericCols : allCols).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {chartType === "scatter" && (
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Y Numeric</label>
            <select
              value={y2Col}
              onChange={(e) => setY2Col(e.target.value)}
              className="w-full bg-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 border border-zinc-600"
            >
              {(numericCols.length > 0 ? numericCols : allCols).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 min-h-64 flex items-center justify-center">
        <div className="w-full max-w-2xl">{renderChart()}</div>
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
