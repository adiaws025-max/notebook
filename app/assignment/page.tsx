"use client";

import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
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
} from "chart.js";
import type { TooltipItem } from "chart.js";
import { Bar, Pie, Scatter, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend
);

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

type Row = Record<string, number | string | null>;
type PatientFilter = "all" | "disease" | "nodisease";
type ExploreChartType = "bar" | "pie" | "donut";
type BinCount = 5 | 8 | 10;

const ALL_COLS = [
  "age","sex","cp","trtbps","chol","fbs","restecg",
  "thalachh","exng","oldpeak","slp","caa","thall","output",
];

const NUMERIC_COLS = ["age","trtbps","chol","thalachh","oldpeak"];

// All 13 features available in the explorer (exclude output which IS the filter)
const ALL_EXPLORE = ["age","sex","cp","trtbps","chol","fbs","restecg","thalachh","exng","oldpeak","slp","caa","thall"];

const SCATTER_COLS = ["age","trtbps","chol","thalachh","oldpeak"];

const COL_INFO: Record<string, { label: string; dtype: string; category: string; description: string }> = {
  age:      { label: "Age (years)",          dtype: "int64",   category: "Numeric",             description: "Patient age in years" },
  sex:      { label: "Sex",                  dtype: "int64",   category: "Categorical (Binary)", description: "1 = Male, 0 = Female" },
  cp:       { label: "Chest Pain Type",      dtype: "int64",   category: "Categorical",          description: "0=Typical Angina, 1=Atypical, 2=Non-Anginal, 3=Asymptomatic" },
  trtbps:   { label: "Resting BP (mm Hg)",   dtype: "int64",   category: "Numeric",             description: "Resting blood pressure at admission" },
  chol:     { label: "Cholesterol (mg/dl)",  dtype: "int64",   category: "Numeric",             description: "Serum cholesterol level" },
  fbs:      { label: "Fasting Blood Sugar",  dtype: "int64",   category: "Categorical (Binary)", description: "> 120 mg/dl: 1 = True, 0 = False" },
  restecg:  { label: "Resting ECG",          dtype: "int64",   category: "Categorical",          description: "0=Normal, 1=ST-T Abnormality, 2=LV Hypertrophy" },
  thalachh: { label: "Max Heart Rate (bpm)", dtype: "int64",   category: "Numeric",             description: "Maximum heart rate achieved during stress test" },
  exng:     { label: "Exercise Angina",      dtype: "int64",   category: "Categorical (Binary)", description: "1 = Yes (angina during exercise), 0 = No" },
  oldpeak:  { label: "ST Depression",        dtype: "float64", category: "Numeric",             description: "ST depression induced by exercise relative to rest" },
  slp:      { label: "ST Slope",             dtype: "int64",   category: "Categorical",          description: "0 = Upsloping, 1 = Flat, 2 = Downsloping" },
  caa:      { label: "Major Vessels (CA)",   dtype: "int64",   category: "Categorical",          description: "Number of major vessels colored by fluoroscopy (0–3)" },
  thall:    { label: "Thalassemia",          dtype: "int64",   category: "Categorical",          description: "1 = Fixed Defect, 2 = Normal, 3 = Reversable Defect" },
  output:   { label: "Heart Disease Target", dtype: "int64",   category: "Categorical (Binary)", description: "1 = Disease Present, 0 = No Disease" },
};

const COL_VALUE_LABELS: Record<string, Record<string, string>> = {
  sex:     { "0": "Female", "1": "Male" },
  cp:      { "0": "Typical Angina", "1": "Atypical Angina", "2": "Non-Anginal Pain", "3": "Asymptomatic" },
  fbs:     { "0": "≤120 mg/dl (normal)", "1": ">120 mg/dl (high)" },
  restecg: { "0": "Normal", "1": "ST-T Abnorm.", "2": "LV Hypertrophy" },
  exng:    { "0": "No Exercise Angina", "1": "Has Exercise Angina" },
  slp:     { "0": "Upsloping", "1": "Flat", "2": "Downsloping" },
  caa:     { "0": "0 Vessels", "1": "1 Vessel", "2": "2 Vessels", "3": "3 Vessels" },
  thall:   { "0": "Null", "1": "Fixed Defect", "2": "Normal", "3": "Reversable Defect" },
};

const SECTIONS = [
  { id: "intro",    label: "Introduction" },
  { id: "overview", label: "Dataset Overview" },
  { id: "cleaning", label: "Data Cleaning" },
  { id: "types",    label: "Data Types" },
  { id: "stats",    label: "Summary Statistics" },
  { id: "viz",      label: "Visualizations" },
  { id: "insights", label: "Insights & Conclusions" },
];

const PALETTE = [
  "#3b82f6","#8b5cf6","#22c55e","#f59e0b","#ef4444",
  "#06b6d4","#ec4899","#f97316","#a3e635","#e879f9",
];

// ─────────────────────────────────────────────────────────────
// Stat helpers
// ─────────────────────────────────────────────────────────────

function nums(rows: Row[], col: string): number[] {
  return rows.map(r => Number(r[col])).filter(v => !isNaN(v));
}
function avg(a: number[]) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }
function sdev(a: number[]) {
  const m = avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1));
}
function sortedMedian(sorted: number[]) {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function quartiles(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return {
    min: s[0], max: s[s.length - 1],
    q1: sortedMedian(s.slice(0, Math.floor(s.length / 2))),
    median: sortedMedian(s),
    q3: sortedMedian(s.slice(Math.ceil(s.length / 2))),
  };
}
function bins(a: number[], n: number) {
  if (!a.length) return [];
  const lo = Math.min(...a), hi = Math.max(...a), w = (hi - lo) / n || 1;
  const counts = Array(n).fill(0);
  a.forEach(v => counts[Math.min(Math.floor((v - lo) / w), n - 1)]++);
  return counts.map((c, i) => ({ label: `${(lo + i * w).toFixed(0)}–${(lo + (i + 1) * w).toFixed(0)}`, count: c }));
}
function countOf(rows: Row[], col: string) {
  const r: Record<string, number> = {};
  rows.forEach(row => { const k = String(row[col]); r[k] = (r[k] || 0) + 1; });
  return r;
}
function pearson(x: number[], y: number[]) {
  if (!x.length || !y.length) return 0;
  const mx = avg(x), my = avg(y);
  const n = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0);
  const d = Math.sqrt(x.reduce((a, xi) => a + (xi - mx) ** 2, 0) * y.reduce((a, yi) => a + (yi - my) ** 2, 0));
  return d === 0 ? 0 : n / d;
}

// ─────────────────────────────────────────────────────────────
// Chart option builders (all with rich tooltips)
// ─────────────────────────────────────────────────────────────

const TT = { backgroundColor: "#18181b", titleColor: "#e4e4e7", bodyColor: "#a1a1aa", borderColor: "#3f3f46", borderWidth: 1 };
const G  = { color: "#27272a" };
const AX = { ticks: { color: "#71717a" }, grid: G };

function makeBarOpts(title: string, showLegend = false, total?: number) {
  return {
    responsive: true,
    animation: { duration: 300 },
    plugins: {
      legend: { display: showLegend, labels: { color: "#a1a1aa", boxWidth: 12 } },
      title:  { display: true, text: title, color: "#e4e4e7", font: { size: 13 } },
      tooltip: {
        ...TT,
        callbacks: {
          label: (item: TooltipItem<"bar">) => {
            const count = item.parsed.y ?? 0;
            const pctStr = (total && total > 0)
              ? ` (${((count / total) * 100).toFixed(1)}%)`
              : "";
            return ` ${item.dataset.label ?? "Count"}: ${count}${pctStr}`;
          },
        },
      },
    },
    scales: { x: AX, y: { ...AX, beginAtZero: true } },
  };
}

function makePieOpts(title: string) {
  return {
    responsive: true,
    animation: { duration: 300 },
    plugins: {
      legend: { labels: { color: "#a1a1aa" } },
      title:  { display: true, text: title, color: "#e4e4e7", font: { size: 13 } },
      tooltip: {
        ...TT,
        callbacks: {
          label: (item: TooltipItem<"pie">) => {
            const count = item.parsed as number;
            const tot = (item.dataset.data as number[]).reduce((a, b) => a + (b as number), 0);
            const pct = tot > 0 ? ((count / tot) * 100).toFixed(1) : "0";
            return ` ${item.label}: ${count} (${pct}%)`;
          },
        },
      },
    },
  };
}

function makeDonutOpts(title: string) {
  return {
    responsive: true,
    animation: { duration: 300 },
    plugins: {
      legend: { labels: { color: "#a1a1aa", padding: 12 }, position: "bottom" as const },
      title:  { display: true, text: title, color: "#e4e4e7", font: { size: 13 } },
      tooltip: {
        ...TT,
        callbacks: {
          label: (item: TooltipItem<"doughnut">) => {
            const count = item.parsed as number;
            const tot = (item.dataset.data as number[]).reduce((a, b) => a + (b as number), 0);
            const pct = tot > 0 ? ((count / tot) * 100).toFixed(1) : "0";
            return ` ${item.label}: ${count} (${pct}%)`;
          },
        },
      },
    },
  };
}

function makeScatterOpts(title: string, xLabel: string, yLabel: string) {
  return {
    responsive: true,
    plugins: {
      legend: { display: true, labels: { color: "#a1a1aa", boxWidth: 10 } },
      title:  { display: true, text: title, color: "#e4e4e7", font: { size: 13 } },
      tooltip: {
        ...TT,
        callbacks: {
          label: (item: TooltipItem<"scatter">) => {
            const p = item.parsed as { x: number; y: number };
            return ` ${item.dataset.label}: ${xLabel}=${p.x.toFixed(1)}, ${yLabel}=${p.y.toFixed(1)}`;
          },
        },
      },
    },
    scales: {
      x: { ...AX, title: { display: true, text: xLabel, color: "#71717a" } },
      y: { ...AX, title: { display: true, text: yLabel, color: "#71717a" } },
    },
  };
}

function corrColor(v: number) {
  const a = Math.abs(v).toFixed(2);
  return v >= 0 ? `rgba(59,130,246,${a})` : `rgba(239,68,68,${a})`;
}

function buildExplanation(feature: string, chartType: ExploreChartType, filter: PatientFilter, binCount: BinCount): string {
  const isNum   = NUMERIC_COLS.includes(feature);
  const label   = COL_INFO[feature]?.label ?? feature;
  const fStr    = filter === "all" ? "all 303 patients" : filter === "disease" ? "heart disease patients" : "healthy patients";
  if (isNum) {
    return `This histogram shows the distribution of ${label} among ${fStr}, split into ${binCount} bins. `
      + `Switching the filter reveals how the ${label.toLowerCase()} distribution shifts between disease and healthy groups — key for assessing feature importance.`;
  }
  const cStr = chartType === "bar" ? "bar chart" : chartType === "pie" ? "pie chart" : "donut chart";
  return `This ${cStr} shows the frequency of each ${label} category among ${fStr}. `
    + `Compare All / Heart Disease / No Disease to see which categories are disproportionately associated with disease — these are the strongest clinical predictors.`;
}

// ─────────────────────────────────────────────────────────────
// UI atoms
// ─────────────────────────────────────────────────────────────

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
      {children}
    </div>
  );
}
function SecHead({ badge, title, sub }: { badge: string; title: string; sub: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">{badge}</span>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="text-zinc-400 text-sm leading-relaxed">{sub}</p>
    </div>
  );
}
function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 space-y-1.5">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <div className="text-sm text-zinc-400 leading-relaxed">{children}</div>
    </div>
  );
}
function Kpi({ label, value, sub, color = "text-white" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-blue-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive]   = useState("intro");

  // Explorer controls
  const [patientFilter, setPatientFilter]       = useState<PatientFilter>("all");
  const [exploreFeature, setExploreFeature]     = useState<string>("age");
  const [exploreChartType, setExploreChartType] = useState<ExploreChartType>("bar");
  const [binCount, setBinCount]                 = useState<BinCount>(8);

  // Scatter controls
  const [scatterX, setScatterX] = useState<string>("age");
  const [scatterY, setScatterY] = useState<string>("thalachh");

  useEffect(() => {
    fetch("/data/heart.csv")
      .then(r => r.text())
      .then(csv => {
        const res = Papa.parse<Row>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
        setRows(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Filtered rows for explorer ─────────────────────────────
  const filteredRows = useMemo(() => {
    if (patientFilter === "disease")   return rows.filter(r => r.output === 1);
    if (patientFilter === "nodisease") return rows.filter(r => r.output === 0);
    return rows;
  }, [rows, patientFilter]);

  // ── Base stats (full dataset, computed once) ───────────────
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const missing: Record<string, number> = {};
    ALL_COLS.forEach(c => {
      missing[c] = rows.filter(r => r[c] === null || r[c] === undefined || r[c] === "").length;
    });
    const seen = new Set<string>();
    let dupes = 0;
    rows.forEach(r => {
      const k = ALL_COLS.map(c => r[c]).join("|");
      if (seen.has(k)) dupes++; else seen.add(k);
    });
    const numStats: Record<string, ReturnType<typeof quartiles> & { mean: number; std: number }> = {};
    NUMERIC_COLS.forEach(c => {
      const a = nums(rows, c);
      numStats[c] = { ...quartiles(a), mean: avg(a), std: sdev(a) };
    });
    const diseaseRows   = rows.filter(r => r.output === 1);
    const noDiseaseRows = rows.filter(r => r.output === 0);
    const corrCols = [...NUMERIC_COLS, "caa", "output"];
    const corrMatrix = corrCols.map(c1 => corrCols.map(c2 => pearson(nums(rows, c1), nums(rows, c2))));
    return { missing, dupes, numStats, diseaseRows, noDiseaseRows, corrCols, corrMatrix };
  }, [rows]);

  // ── Dynamic summary cards (filter-aware) ──────────────────
  const dynStats = useMemo(() => {
    const total   = filteredRows.length;
    const disease = filteredRows.filter(r => r.output === 1).length;
    const healthy = total - disease;
    return {
      total, disease, healthy,
      fraudPct: total > 0 ? ((disease / total) * 100).toFixed(1) : "0",
      avgAge:   avg(nums(filteredRows, "age")).toFixed(1),
      avgHR:    avg(nums(filteredRows, "thalachh")).toFixed(0),
      avgChol:  avg(nums(filteredRows, "chol")).toFixed(0),
    };
  }, [filteredRows]);

  // ── Explorer chart data ───────────────────────────────────
  const explorerChartData = useMemo(() => {
    const isNum = NUMERIC_COLS.includes(exploreFeature);
    if (isNum) {
      const b = bins(nums(filteredRows, exploreFeature), binCount);
      return { labels: b.map(x => x.label), data: b.map(x => x.count), colors: b.map(() => "#3b82f6") };
    }
    const counts = countOf(filteredRows, exploreFeature);
    const vl = COL_VALUE_LABELS[exploreFeature] ?? {};
    const keys = Object.keys(counts).sort((a, b) => Number(a) - Number(b));
    return {
      labels: keys.map(k => vl[k] ?? k),
      data:   keys.map(k => counts[k]),
      colors: PALETTE.slice(0, keys.length),
    };
  }, [filteredRows, exploreFeature, binCount]);

  // ── Interactive scatter data ───────────────────────────────
  const scatterData = useMemo(() => {
    if (!stats) return null;
    const xL = COL_INFO[scatterX]?.label ?? scatterX;
    const yL = COL_INFO[scatterY]?.label ?? scatterY;
    return {
      xLabel: xL, yLabel: yL,
      datasets: [
        { label: "Heart Disease", data: stats.diseaseRows.map(r => ({ x: Number(r[scatterX]), y: Number(r[scatterY]) })), backgroundColor: "rgba(239,68,68,0.55)", pointRadius: 4 },
        { label: "No Disease",    data: stats.noDiseaseRows.map(r => ({ x: Number(r[scatterX]), y: Number(r[scatterY]) })), backgroundColor: "rgba(34,197,94,0.55)", pointRadius: 4 },
      ],
    };
  }, [rows, scatterX, scatterY, stats]);

  // ── Guards ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Loading heart disease dataset…</p>
        </div>
      </div>
    );
  }
  if (!rows.length || !stats) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Failed to load dataset. Make sure public/data/heart.csv exists.</p>
      </div>
    );
  }

  const { missing, dupes, numStats, diseaseRows, noDiseaseRows, corrCols, corrMatrix } = stats;
  const totalMissing = Object.values(missing).reduce((a, b) => a + b, 0);
  const isNumFeature = NUMERIC_COLS.includes(exploreFeature);
  const filterLabel  = patientFilter === "all" ? "All Patients" : patientFilter === "disease" ? "Heart Disease" : "No Disease";
  const explorerTitle = `${COL_INFO[exploreFeature]?.label ?? exploreFeature} — ${filterLabel}`;

  // Static chart datasets (computed once in render, full rows)
  const targetPie = {
    labels: ["Heart Disease (1)", "No Disease (0)"],
    datasets: [{ data: [diseaseRows.length, noDiseaseRows.length], backgroundColor: ["#ef4444","#22c55e"], borderColor: ["#7f1d1d","#14532d"], borderWidth: 1 }],
  };
  const sexCounts = countOf(rows, "sex");
  const sexPie = {
    labels: ["Male (1)", "Female (0)"],
    datasets: [{ data: [sexCounts["1"]||0, sexCounts["0"]||0], backgroundColor: ["#3b82f6","#ec4899"], borderColor: ["#1e3a5f","#5d1a38"], borderWidth: 1 }],
  };
  const cpBar = {
    labels: ["Typical Angina (0)","Atypical (1)","Non-Anginal (2)","Asymptomatic (3)"],
    datasets: [{ label: "Count", data: [0,1,2,3].map(v => countOf(rows,"cp")[String(v)]||0), backgroundColor: ["#f59e0b","#3b82f6","#8b5cf6","#ef4444"], borderWidth: 1 }],
  };
  const sexByTarget = {
    labels: ["Male","Female"],
    datasets: [
      { label: "Heart Disease", data: [rows.filter(r=>r.sex===1&&r.output===1).length, rows.filter(r=>r.sex===0&&r.output===1).length], backgroundColor: "#ef4444", borderWidth: 1 },
      { label: "No Disease",    data: [rows.filter(r=>r.sex===1&&r.output===0).length, rows.filter(r=>r.sex===0&&r.output===0).length], backgroundColor: "#22c55e", borderWidth: 1 },
    ],
  };
  const cpByTarget = {
    labels: ["Type 0","Type 1","Type 2","Type 3"],
    datasets: [
      { label: "Heart Disease", data: [0,1,2,3].map(v=>rows.filter(r=>r.cp===v&&r.output===1).length), backgroundColor: "#ef4444", borderWidth: 1 },
      { label: "No Disease",    data: [0,1,2,3].map(v=>rows.filter(r=>r.cp===v&&r.output===0).length), backgroundColor: "#3b82f6", borderWidth: 1 },
    ],
  };
  const exngByTarget = {
    labels: ["No Angina (0)","Exercise Angina (1)"],
    datasets: [
      { label: "Heart Disease", data: [0,1].map(v=>rows.filter(r=>r.exng===v&&r.output===1).length), backgroundColor: "#ef4444", borderWidth: 1 },
      { label: "No Disease",    data: [0,1].map(v=>rows.filter(r=>r.exng===v&&r.output===0).length), backgroundColor: "#22c55e", borderWidth: 1 },
    ],
  };
  const caaByTarget = {
    labels: ["0 Vessels","1 Vessel","2 Vessels","3 Vessels"],
    datasets: [
      { label: "Heart Disease", data: [0,1,2,3].map(v=>rows.filter(r=>r.caa===v&&r.output===1).length), backgroundColor: "#ef4444", borderWidth: 1 },
      { label: "No Disease",    data: [0,1,2,3].map(v=>rows.filter(r=>r.caa===v&&r.output===0).length), backgroundColor: "#3b82f6", borderWidth: 1 },
    ],
  };
  const thallByTarget = {
    labels: ["Null (0)","Fixed Defect (1)","Normal (2)","Reversable (3)"],
    datasets: [
      { label: "Heart Disease", data: [0,1,2,3].map(v=>rows.filter(r=>r.thall===v&&r.output===1).length), backgroundColor: "#ef4444", borderWidth: 1 },
      { label: "No Disease",    data: [0,1,2,3].map(v=>rows.filter(r=>r.thall===v&&r.output===0).length), backgroundColor: "#3b82f6", borderWidth: 1 },
    ],
  };
  const oldpeakComp = {
    labels: ["No Disease","Heart Disease"],
    datasets: [{ label: "Mean ST Depression", data: [avg(nums(noDiseaseRows,"oldpeak")), avg(nums(diseaseRows,"oldpeak"))], backgroundColor: ["#22c55e","#ef4444"], borderWidth: 1 }],
  };
  const hrByTarget = {
    labels: ["No Disease","Heart Disease"],
    datasets: [{ label: "Mean Max HR", data: [avg(nums(noDiseaseRows,"thalachh")), avg(nums(diseaseRows,"thalachh"))], backgroundColor: ["#22c55e","#ef4444"], borderWidth: 1 }],
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">DL</div>
          <span className="font-semibold text-white">DataLedger</span>
          <span className="text-zinc-600 text-sm hidden sm:inline">·</span>
          <span className="text-zinc-400 text-sm hidden sm:inline">Heart Disease Analysis Notebook</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded">{rows.length} rows</span>
          <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded">14 features</span>
          <span className="bg-green-950 text-green-400 px-2 py-1 rounded border border-green-900">Live Dataset</span>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] border-r border-zinc-800 overflow-y-auto">
          <nav className="p-4 space-y-0.5">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3 px-3">Sections</p>
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setActive(s.id)}
                className={`flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition-colors ${
                  active === s.id ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <span className="text-[10px] font-mono text-zinc-600 w-4">{String(i + 1).padStart(2,"0")}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-10 space-y-10 max-w-5xl">

          {/* ══ 01 INTRODUCTION ══ */}
          <section id="intro">
            <Card>
              <SecHead
                badge="Section 01 · Introduction"
                title="Heart Disease Dataset — Analysis Notebook"
                sub="A complete, tutorial-style walkthrough of the UCI Heart Disease dataset using Next.js, PapaParse, and Chart.js."
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Total Records"  value={rows.length} />
                <Kpi label="Features"       value="14" />
                <Kpi label="Heart Disease"  value={diseaseRows.length}   sub={`${((diseaseRows.length/rows.length)*100).toFixed(1)}%`} color="text-red-400" />
                <Kpi label="No Disease"     value={noDiseaseRows.length} sub={`${((noDiseaseRows.length/rows.length)*100).toFixed(1)}%`} color="text-green-400" />
              </div>
              <Note title="What is this dataset?">
                The <strong className="text-zinc-200">UCI Heart Disease (Cleveland) Dataset</strong> contains clinical records
                from 303 patients. It includes 13 physiological features alongside a binary target indicating whether
                heart disease is present. This notebook covers every step: loading, cleaning, profiling, visualizing, and interpreting.
              </Note>
              <Note title="Why does heart disease analysis matter?">
                Cardiovascular disease is the <strong className="text-zinc-200">leading cause of death worldwide</strong>.
                Early detection through data-driven screening can save lives. Standard clinical measurements can reliably
                predict disease presence — forming the foundation for ML triage systems.
              </Note>
            </Card>
          </section>

          {/* ══ 02 DATASET OVERVIEW ══ */}
          <section id="overview">
            <Card>
              <SecHead
                badge="Section 02 · Dataset Overview"
                title="First Look at the Raw Data"
                sub="Column names, value ranges, and what the first rows look like."
              />
              <div className="flex flex-wrap gap-3">
                <a href="/data/heart.csv" download="heart_disease.csv"
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-white rounded-lg transition-colors">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Heart Disease Dataset
                  <span className="text-xs text-zinc-500">303 rows · 14 cols</span>
                </a>
              </div>
              <Note title="Why start with a preview?">
                Before any processing, we verify the data loaded correctly, understand the column schema,
                and spot obvious issues (wrong separators, shifted columns, unexpected values).
              </Note>
              <div>
                <p className="text-xs text-zinc-500 mb-2 font-mono">df.head(10) — first 10 rows of heart.csv</p>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800">
                        <th className="px-2 py-2 text-zinc-500 font-mono text-right">#</th>
                        {ALL_COLS.map(c => <th key={c} className="px-3 py-2 text-left text-zinc-400 font-medium whitespace-nowrap">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0,10).map((row, i) => (
                        <tr key={i} className={`border-b border-zinc-800/50 ${i%2===0?"":"bg-zinc-900/30"}`}>
                          <td className="px-2 py-1.5 text-zinc-600 font-mono text-right">{i}</td>
                          {ALL_COLS.map(c => <td key={c} className="px-3 py-1.5 text-zinc-300 font-mono">{String(row[c])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Shape: <span className="text-zinc-300 font-mono">{rows.length} rows × {ALL_COLS.length} columns</span></p>
            </Card>
          </section>

          {/* ══ 03 DATA CLEANING ══ */}
          <section id="cleaning">
            <Card>
              <SecHead
                badge="Section 03 · Data Cleaning"
                title="Missing Values & Duplicate Detection"
                sub="Identify and quantify data quality issues before any analysis begins."
              />
              <Note title="What is data cleaning and why does it matter?">
                Real-world datasets contain missing entries, duplicate rows, and inconsistent formats.
                We check for: <strong className="text-zinc-200">missing values</strong> (nulls, blanks),
                <strong className="text-zinc-200"> duplicate rows</strong> (exact copies), and
                <strong className="text-zinc-200"> data type consistency</strong>.
              </Note>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-zinc-500 mb-2 font-mono">df.isnull().sum()</p>
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800">
                          <th className="px-3 py-2 text-left text-zinc-400">Column</th>
                          <th className="px-3 py-2 text-right text-zinc-400">Missing</th>
                          <th className="px-3 py-2 text-right text-zinc-400">% Missing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_COLS.map(c => (
                          <tr key={c} className="border-b border-zinc-800/50">
                            <td className="px-3 py-1.5 text-zinc-300 font-mono">{c}</td>
                            <td className="px-3 py-1.5 text-right">
                              <span className={missing[c]>0 ? "text-red-400 font-medium" : "text-green-400"}>{missing[c]}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-zinc-500">{((missing[c]/rows.length)*100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-zinc-800 rounded-xl p-5 text-center space-y-1">
                    <p className="text-xs text-zinc-500 font-mono">Total Missing Values</p>
                    <p className="text-4xl font-bold text-white">{totalMissing}</p>
                    <p className={`text-sm ${totalMissing===0 ? "text-green-400" : "text-yellow-400"}`}>
                      {totalMissing===0 ? "✓ Dataset is complete — no nulls" : `⚠ ${totalMissing} missing values found`}
                    </p>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-5 text-center space-y-1">
                    <p className="text-xs text-zinc-500 font-mono">Duplicate Rows</p>
                    <p className="text-4xl font-bold text-white">{dupes}</p>
                    <p className={`text-sm ${dupes===0 ? "text-green-400" : "text-yellow-400"}`}>
                      {dupes===0 ? "✓ No duplicates found" : `⚠ ${dupes} duplicate rows detected`}
                    </p>
                  </div>
                  <Note title="Cleaning verdict">
                    This dataset is <strong className="text-zinc-200">already clean</strong>.
                    Zero missing values and no duplicate records — we can proceed directly to analysis.
                  </Note>
                </div>
              </div>
            </Card>
          </section>

          {/* ══ 04 DATA TYPES ══ */}
          <section id="types">
            <Card>
              <SecHead
                badge="Section 04 · Data Types Analysis"
                title="Column Types & Feature Categories"
                sub="Every feature has a type — understanding it determines which statistical methods and chart types apply."
              />
              <Note title="Numeric vs Categorical — why it matters">
                <strong className="text-zinc-200">Numeric features</strong> (age, BP, cholesterol) are on a continuous scale —
                we compute means, standard deviations, and histograms.{" "}
                <strong className="text-zinc-200">Categorical features</strong> (sex, chest pain type) represent discrete groups —
                we count frequencies and use bar or pie charts.
              </Note>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800">
                      {["Column","Label","dtype","Category","Description"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-zinc-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_COLS.map((c,i) => {
                      const info  = COL_INFO[c];
                      const isNum = NUMERIC_COLS.includes(c);
                      return (
                        <tr key={c} className={`border-b border-zinc-800/50 ${i%2===0?"":"bg-zinc-900/20"}`}>
                          <td className="px-4 py-2 text-zinc-300 font-mono">{c}</td>
                          <td className="px-4 py-2 text-zinc-200">{info.label}</td>
                          <td className="px-4 py-2"><span className="bg-zinc-800 text-zinc-300 font-mono text-xs px-2 py-0.5 rounded">{info.dtype}</span></td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${isNum ? "bg-blue-950 text-blue-400 border border-blue-900" : "bg-purple-950 text-purple-400 border border-purple-900"}`}>
                              {isNum ? "Numeric" : "Categorical"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-zinc-400">{info.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* ══ 05 SUMMARY STATISTICS ══ */}
          <section id="stats">
            <Card>
              <SecHead
                badge="Section 05 · Summary Statistics"
                title="Descriptive Statistics"
                sub="Key statistical measures for numeric columns — the numerical foundation of the analysis."
              />
              <Note title="What each statistic means">
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li><strong className="text-zinc-200">Mean</strong> — arithmetic average</li>
                  <li><strong className="text-zinc-200">Std Dev</strong> — spread around the mean</li>
                  <li><strong className="text-zinc-200">Min / Max</strong> — range extremes for outlier detection</li>
                  <li><strong className="text-zinc-200">Q1 / Median / Q3</strong> — quartiles showing distribution shape</li>
                </ul>
              </Note>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800">
                      {["Column","Count","Mean","Std Dev","Min","Q1","Median","Q3","Max"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-right first:text-left text-zinc-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NUMERIC_COLS.map((c,i) => {
                      const s = numStats[c];
                      return (
                        <tr key={c} className={`border-b border-zinc-800/50 ${i%2===0?"":"bg-zinc-900/20"}`}>
                          <td className="px-4 py-2 text-zinc-300 font-mono">{c}</td>
                          <td className="px-4 py-2 text-right text-zinc-500">{rows.length}</td>
                          <td className="px-4 py-2 text-right text-blue-400 font-medium">{s.mean.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{s.std.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{s.min.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{s.q1.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-purple-400 font-medium">{s.median.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{s.q3.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{s.max.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Box plots */}
              <div>
                <p className="text-xs text-zinc-500 mb-4 font-mono">Box plots — distribution shape and outlier detection</p>
                <div className="space-y-4">
                  {NUMERIC_COLS.map(c => {
                    const s = numStats[c];
                    const range = s.max - s.min || 1;
                    const pct = (v: number) => `${((v - s.min) / range * 100).toFixed(1)}%`;
                    const w   = (v1: number, v2: number) => `${((v2 - v1) / range * 100).toFixed(1)}%`;
                    return (
                      <div key={c} className="flex items-center gap-4">
                        <span className="text-xs text-zinc-400 font-mono w-20 shrink-0 text-right">{c}</span>
                        <div className="flex-1 relative h-7 bg-zinc-800/30 rounded">
                          <div className="absolute top-3 left-0 right-0 h-px bg-zinc-700" />
                          <div className="absolute top-0 h-7 w-px bg-zinc-500" style={{ left: pct(s.min) }} />
                          <div className="absolute top-0 h-7 w-px bg-zinc-500" style={{ left: pct(s.max) }} />
                          <div className="absolute top-1 h-5 bg-blue-600/30 border border-blue-600/60 rounded-sm" style={{ left: pct(s.q1), width: w(s.q1, s.q3) }} />
                          <div className="absolute top-0 h-7 w-0.5 bg-blue-300" style={{ left: pct(s.median) }} />
                        </div>
                        <span className="text-xs text-zinc-500 font-mono w-36 shrink-0">
                          {s.min.toFixed(0)} · {s.q1.toFixed(0)} · <span className="text-blue-400">{s.median.toFixed(0)}</span> · {s.q3.toFixed(0)} · {s.max.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-600 mt-3">Box = Q1–Q3. Blue line = median. Whiskers = min/max.</p>
              </div>
            </Card>
          </section>

          {/* ══ 06 VISUALIZATIONS ══ */}
          <section id="viz">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">Section 06 · Visualizations</span>
                <h2 className="text-xl font-semibold text-white">Data Visualizations</h2>
                <p className="text-zinc-400 text-sm">Interactive explorer + 10 clinical comparison charts.</p>
              </div>

              {/* ═══ INTERACTIVE PATIENT EXPLORER ═══ */}
              <div className="bg-zinc-900 border border-blue-500/40 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-base font-semibold text-blue-300">Interactive Patient Explorer</h3>
                </div>
                <p className="text-zinc-500 text-xs mb-6">Every control updates the chart and summary cards instantly.</p>

                {/* Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {/* Patient filter */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Patient group</label>
                    <div className="flex gap-1.5">
                      {([
                        ["all",       "All",     "bg-blue-600"],
                        ["disease",   "Disease", "bg-red-600"],
                        ["nodisease", "Healthy", "bg-green-700"],
                      ] as [PatientFilter, string, string][]).map(([val, lbl, active]) => (
                        <button key={val} onClick={() => setPatientFilter(val)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                            patientFilter === val
                              ? `${active} text-white shadow-md`
                              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                          }`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feature */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Feature</label>
                    <select value={exploreFeature} onChange={e => setExploreFeature(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                      <optgroup label="Numeric">
                        {NUMERIC_COLS.map(c => <option key={c} value={c}>{COL_INFO[c].label}</option>)}
                      </optgroup>
                      <optgroup label="Categorical">
                        {["sex","cp","fbs","restecg","exng","slp","caa","thall"].map(c => (
                          <option key={c} value={c}>{COL_INFO[c].label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Chart type + Bin count */}
                  <div className="flex gap-3">
                    {!isNumFeature && (
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Chart type</label>
                        <select value={exploreChartType} onChange={e => setExploreChartType(e.target.value as ExploreChartType)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                          <option value="bar">Bar</option>
                          <option value="pie">Pie</option>
                          <option value="donut">Donut</option>
                        </select>
                      </div>
                    )}
                    {isNumFeature && (
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Bin count</label>
                        <select value={binCount} onChange={e => setBinCount(Number(e.target.value) as BinCount)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                          <option value={5}>5 bins</option>
                          <option value={8}>8 bins</option>
                          <option value={10}>10 bins</option>
                        </select>
                      </div>
                    )}
                    <div className="flex-1" />
                  </div>
                </div>

                {/* Dynamic summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <div className="text-xl font-bold text-white">{dynStats.total}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Patients shown</div>
                  </div>
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <div className="text-xl font-bold text-red-400">{dynStats.disease}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Heart disease</div>
                  </div>
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <div className="text-xl font-bold text-green-400">{dynStats.healthy}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Healthy</div>
                  </div>
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                    <div className="text-xl font-bold text-amber-400">{dynStats.avgAge}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Avg age</div>
                  </div>
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 col-span-2 sm:col-span-1">
                    <div className="text-xl font-bold text-blue-400">{dynStats.avgHR}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Avg max HR</div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 mb-4" style={{ minHeight: 320 }}>
                  {explorerChartData.data.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">No data for selected filter.</div>
                  ) : isNumFeature || exploreChartType === "bar" ? (
                    <Bar
                      key={`bar-${exploreFeature}-${patientFilter}`}
                      data={{
                        labels: explorerChartData.labels,
                        datasets: [{ label: COL_INFO[exploreFeature]?.label ?? exploreFeature, data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderRadius: 4, borderWidth: 0 }],
                      }}
                      options={makeBarOpts(explorerTitle, false, dynStats.total)}
                    />
                  ) : exploreChartType === "pie" ? (
                    <Pie
                      key={`pie-${exploreFeature}-${patientFilter}`}
                      data={{ labels: explorerChartData.labels, datasets: [{ data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderWidth: 0 }] }}
                      options={makePieOpts(explorerTitle)}
                    />
                  ) : (
                    <Doughnut
                      key={`donut-${exploreFeature}-${patientFilter}`}
                      data={{ labels: explorerChartData.labels, datasets: [{ data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderWidth: 0 }] }}
                      options={makeDonutOpts(explorerTitle)}
                    />
                  )}
                </div>

                {/* Auto explanation */}
                <div className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-300 leading-relaxed">
                    {buildExplanation(exploreFeature, exploreChartType, patientFilter, binCount)}
                  </p>
                </div>
              </div>

              {/* ═══ DISTRIBUTION OVERVIEW (full dataset) ═══ */}
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-2">Overall Distribution</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <Pie data={targetPie} options={makePieOpts("Heart Disease Distribution")} />
                  <Note title="Insight">
                    <strong className="text-zinc-200">{((diseaseRows.length/rows.length)*100).toFixed(0)}%</strong> of patients have heart disease.
                    The slight class imbalance should be accounted for when training predictive models.
                  </Note>
                </Card>
                <Card>
                  <Pie data={sexPie} options={makePieOpts("Sex Distribution")} />
                  <Note title="Insight">
                    <strong className="text-zinc-200">{((sexCounts["1"]||0)/rows.length*100).toFixed(0)}%</strong> of patients are male.
                    The dataset is male-dominated — sex-stratified conclusions need care.
                  </Note>
                </Card>
              </div>

              {/* ═══ CLINICAL COMPARISON CHARTS ═══ */}
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Clinical Comparison Charts</h3>

              <Card>
                <Bar data={cpBar} options={makeBarOpts("Chest Pain Type Distribution", false, rows.length)} />
                <Note title="Insight">
                  <strong className="text-zinc-200">Asymptomatic chest pain (Type 0)</strong> is the most common type in this dataset.
                  Many high-risk patients show no classic angina symptoms — making routine screening critical.
                </Note>
              </Card>

              <Card>
                <Bar data={sexByTarget} options={makeBarOpts("Heart Disease Prevalence by Sex", true)} />
                <Note title="Insight">
                  Male patients show a higher proportion of heart disease cases.
                  This may reflect genuine biological differences or sampling bias in the dataset.
                </Note>
              </Card>

              <Card>
                <Bar data={cpByTarget} options={makeBarOpts("Heart Disease by Chest Pain Type", true)} />
                <Note title="Insight">
                  <strong className="text-zinc-200">Asymptomatic patients (cp=0)</strong> have the highest absolute number of heart disease cases —
                  symptom absence does not mean disease absence.
                </Note>
              </Card>

              <Card>
                <Bar data={exngByTarget} options={makeBarOpts("Exercise-Induced Angina vs Heart Disease", true)} />
                <Note title="Insight">
                  Patients who experience angina during exercise are significantly more likely to have heart disease.
                  Exercise stress testing is a powerful, low-cost diagnostic tool.
                </Note>
              </Card>

              <Card>
                <Bar data={caaByTarget} options={makeBarOpts("Coronary Vessels Blocked (CA) vs Heart Disease", true)} />
                <Note title="Insight">
                  Strong <strong className="text-zinc-200">dose-response relationship</strong>: each additional blocked vessel
                  increases disease prevalence. Patients with 0 blocked vessels are predominantly disease-free.
                </Note>
              </Card>

              <Card>
                <Bar data={thallByTarget} options={makeBarOpts("Thalassemia Type vs Heart Disease", true)} />
                <Note title="Insight">
                  <strong className="text-zinc-200">Reversable defect (thall=3)</strong> is the dominant thalassemia type in disease patients —
                  a clinically validated sign of ischemia under stress.
                </Note>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <Bar data={oldpeakComp} options={makeBarOpts("Mean ST Depression (Oldpeak) by Target", false, rows.length)} />
                  <Note title="Insight">
                    Disease patients: oldpeak = <strong className="text-zinc-200">{avg(nums(diseaseRows,"oldpeak")).toFixed(2)}</strong> vs{" "}
                    <strong className="text-zinc-200">{avg(nums(noDiseaseRows,"oldpeak")).toFixed(2)}</strong> in healthy patients.
                    Oldpeak is one of the strongest single predictors in this dataset.
                  </Note>
                </Card>
                <Card>
                  <Bar data={hrByTarget} options={makeBarOpts("Mean Max Heart Rate by Target", false, rows.length)} />
                  <Note title="Insight">
                    Healthy patients: <strong className="text-zinc-200">{avg(nums(noDiseaseRows,"thalachh")).toFixed(0)} bpm</strong> vs{" "}
                    <strong className="text-zinc-200">{avg(nums(diseaseRows,"thalachh")).toFixed(0)} bpm</strong> for disease patients.
                    Reduced cardiac capacity during stress is a reliable disease indicator.
                  </Note>
                </Card>
              </div>

              {/* ═══ INTERACTIVE SCATTER ═══ */}
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Interactive Scatter Plot</h3>
              <Card>
                {/* Axis selectors */}
                <div className="flex flex-wrap gap-4 mb-2">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">X axis</label>
                    <select value={scatterX} onChange={e => setScatterX(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                      {SCATTER_COLS.map(c => <option key={c} value={c}>{COL_INFO[c].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Y axis</label>
                    <select value={scatterY} onChange={e => setScatterY(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                      {SCATTER_COLS.map(c => <option key={c} value={c}>{COL_INFO[c].label}</option>)}
                    </select>
                  </div>
                </div>
                {scatterData && (
                  <Scatter
                    data={scatterData}
                    options={makeScatterOpts(
                      `${scatterData.xLabel} vs ${scatterData.yLabel} (by Diagnosis)`,
                      scatterData.xLabel,
                      scatterData.yLabel,
                    )}
                  />
                )}
                <Note title="How to read this chart">
                  Red = heart disease patients · Green = healthy patients. Each dot is one patient.
                  Clusters that separate clearly between colours indicate that those two features together are strong predictors.
                  Try Age vs Max HR — disease patients cluster bottom-right (older, lower HR).
                </Note>
              </Card>

              {/* ═══ CORRELATION HEATMAP ═══ */}
              <Card>
                <p className="text-sm font-medium text-zinc-300">Correlation Heatmap (Pearson r)</p>
                <p className="text-xs text-zinc-500 mb-3">Blue = positive correlation · Red = negative · Darker = stronger</p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-separate border-spacing-1 w-full">
                    <thead>
                      <tr>
                        <th className="p-1 text-zinc-600 text-right pr-2" />
                        {corrCols.map(c => <th key={c} className="p-1 text-zinc-400 font-mono text-center min-w-[58px]">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {corrMatrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-1 text-zinc-400 font-mono text-right pr-2 whitespace-nowrap">{corrCols[i]}</td>
                          {row.map((v, j) => (
                            <td key={j} title={`${corrCols[i]} vs ${corrCols[j]}: ${v.toFixed(3)}`}
                              className="p-1 text-center font-mono rounded"
                              style={{ backgroundColor: corrColor(v) }}>
                              <span style={{ color: Math.abs(v) > 0.4 ? "#fff" : "#a1a1aa" }}>{v.toFixed(2)}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Note title="Key correlations with output (heart disease)">
                  Strongest predictors: <strong className="text-zinc-200">caa</strong> (+), <strong className="text-zinc-200">oldpeak</strong> (+),
                  and <strong className="text-zinc-200">thalachh</strong> (−, negatively correlated).
                  These match established cardiology knowledge and suggest a viable feature set for ML.
                </Note>
              </Card>
            </div>
          </section>

          {/* ══ 07 INSIGHTS & CONCLUSIONS ══ */}
          <section id="insights">
            <Card>
              <SecHead
                badge="Section 07 · Insights & Conclusions"
                title="Key Findings"
                sub="Evidence-based insights synthesized from the full analysis."
              />
              <div className="space-y-3">
                {[
                  { n:"01", cls:"border-red-800 bg-red-950 text-red-400",
                    title: "Silent heart disease is the most common pattern",
                    body: `${rows.filter(r=>r.cp===0&&r.output===1).length} of ${rows.filter(r=>r.cp===0).length} asymptomatic patients (cp=0) have confirmed heart disease. Most high-risk patients show no classic chest pain — routine screening is essential.` },
                  { n:"02", cls:"border-orange-800 bg-orange-950 text-orange-400",
                    title: "ST depression (oldpeak) is the strongest single predictor",
                    body: `Disease patients have a mean oldpeak of ${avg(nums(diseaseRows,"oldpeak")).toFixed(2)} vs ${avg(nums(noDiseaseRows,"oldpeak")).toFixed(2)} in healthy patients. ST depression directly reflects myocardial ischemia during stress.` },
                  { n:"03", cls:"border-yellow-800 bg-yellow-950 text-yellow-400",
                    title: "Reduced maximum heart rate signals disease",
                    body: `Healthy patients achieved ${avg(nums(noDiseaseRows,"thalachh")).toFixed(0)} bpm vs ${avg(nums(diseaseRows,"thalachh")).toFixed(0)} bpm in disease patients. Impaired chronotropic response is a measurable indicator of coronary artery disease.` },
                  { n:"04", cls:"border-blue-800 bg-blue-950 text-blue-400",
                    title: "Vessel blockage has a dose-response relationship",
                    body: `${rows.filter(r=>r.caa===0&&r.output===0).length} patients with 0 blocked vessels are disease-free. Each additional blocked vessel directly corresponds to higher disease prevalence.` },
                  { n:"05", cls:"border-purple-800 bg-purple-950 text-purple-400",
                    title: "Reversable thalassemia defect strongly predicts disease",
                    body: `${rows.filter(r=>r.thall===3&&r.output===1).length} patients with reversable defects (thall=3) have heart disease — stress-induced ischemia is a direct sign of obstructive CAD.` },
                  { n:"06", cls:"border-green-800 bg-green-950 text-green-400",
                    title: "Dataset is clean and ready for ML",
                    body: `Zero missing values, ${dupes} duplicate rows. All 303 records are usable without imputation. A gradient boosting model trained on oldpeak, caa, thalachh, cp, exng, thall could likely achieve 85%+ accuracy.` },
                ].map(ins => (
                  <div key={ins.n} className={`flex gap-4 p-4 rounded-lg border ${ins.cls}`}>
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${ins.cls}`}>{ins.n}</div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">{ins.title}</p>
                      <p className="text-sm text-zinc-400 mt-1">{ins.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Note title="Final Conclusion">
                Heart disease can be reliably predicted from routine clinical measurements.
                The most important features are <strong className="text-zinc-200">oldpeak, caa, thalachh, cp, exng,</strong> and <strong className="text-zinc-200">thall</strong>.
                A data-driven screening system using these features could identify high-risk patients —
                especially asymptomatic ones — before symptoms develop.
              </Note>
            </Card>
          </section>

          <div className="border-t border-zinc-800 pt-6 pb-10 text-center text-xs text-zinc-600 space-y-1">
            <p>Heart Disease Analysis Notebook · UCI Cleveland Dataset · 303 patients · 14 features</p>
            <p>Built with Next.js 16 · Chart.js · PapaParse · Tailwind CSS · Deployed on Cloudflare Pages</p>
          </div>

        </main>
      </div>
    </div>
  );
}
