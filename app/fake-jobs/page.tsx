"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import type { TooltipItem } from "chart.js";
import { Bar, Pie, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

interface JobRow {
  job_id: string; title: string; location: string; department: string;
  salary_range: string; company_profile: string; description: string;
  requirements: string; benefits: string; telecommuting: string;
  has_company_logo: string; has_questions: string; employment_type: string;
  required_experience: string; required_education: string; industry: string;
  function: string; fraudulent: string;
  [key: string]: string;
}

type FilterMode = "all" | "real" | "fraudulent";
type ChartType = "bar" | "pie" | "donut";
type Feature = "employment_type" | "required_experience" | "industry" | "function" | "location" | "required_education";
type TopN = 5 | 10 | 15;

const SECTIONS = [
  { id: "intro", label: "01 Introduction" },
  { id: "overview", label: "02 Dataset Overview" },
  { id: "cleaning", label: "03 Data Cleaning" },
  { id: "types", label: "04 Data Types" },
  { id: "stats", label: "05 Summary Statistics" },
  { id: "viz", label: "06 Visualizations" },
  { id: "insights", label: "07 Insights" },
];

const FEATURES: { value: Feature; label: string; desc: string }[] = [
  { value: "employment_type",    label: "Employment Type",    desc: "Full-time, Part-time, Contract, etc." },
  { value: "required_experience",label: "Required Experience",desc: "Entry-level, Mid-Senior, Director, etc." },
  { value: "industry",           label: "Industry",           desc: "Technology, Healthcare, Finance, etc." },
  { value: "function",           label: "Job Function",       desc: "Engineering, Sales, Marketing, etc." },
  { value: "location",           label: "Location",           desc: "City and state of the role" },
  { value: "required_education", label: "Required Education", desc: "Bachelor's, Master's, Doctorate, etc." },
];

const PALETTE = [
  "rgba(59,130,246,0.85)","rgba(168,85,247,0.85)","rgba(20,184,166,0.85)",
  "rgba(245,158,11,0.85)","rgba(236,72,153,0.85)","rgba(99,102,241,0.85)",
  "rgba(6,182,212,0.85)","rgba(249,115,22,0.85)","rgba(34,197,94,0.85)",
  "rgba(239,68,68,0.85)","rgba(234,179,8,0.85)","rgba(14,165,233,0.85)",
  "rgba(132,204,22,0.85)","rgba(217,70,239,0.85)","rgba(251,191,36,0.85)",
];

const COL_TYPES: Record<string, string> = {
  job_id:"integer", title:"text", location:"text", department:"text",
  salary_range:"text", company_profile:"text", description:"text",
  requirements:"text", benefits:"text", telecommuting:"binary",
  has_company_logo:"binary", has_questions:"binary",
  employment_type:"categorical", required_experience:"categorical",
  required_education:"categorical", industry:"categorical",
  function:"categorical", fraudulent:"binary (target)",
};
const COLUMNS = Object.keys(COL_TYPES) as (keyof JobRow)[];

function countValues(rows: JobRow[], col: keyof JobRow): [string, number][] {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = r[col];
    if (!v || v.trim() === "") continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function missingCount(rows: JobRow[], col: keyof JobRow): number {
  return rows.filter((r) => !r[col] || r[col].trim() === "").length;
}

function buildExplanation(feature: Feature, chartType: ChartType, topN: number, filter: FilterMode): string {
  const feat = FEATURES.find((f) => f.value === feature)!;
  const filterStr = filter === "all" ? "all job postings" : `${filter} job postings`;
  const chartStr = chartType === "bar" ? "bar chart" : chartType === "pie" ? "pie chart" : "donut chart";
  const element = chartType === "bar" ? "bar" : "slice";
  return `This ${chartStr} shows the top ${topN} ${feat.label.toLowerCase()} values among ${filterStr}. `
    + `Each ${element} represents one category (e.g. ${feat.desc}). `
    + `Switch between All / Real / Fraudulent above — distributions that change dramatically across groups are strong fraud-detection signals.`;
}

function buildBarOpts(title: string, total: number, filterLabel: string) {
  return {
    responsive: true,
    animation: { duration: 350 },
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#e4e4e7", font: { size: 13, weight: "bold" as const } },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<"bar">[]) => items[0]?.label ?? "",
          label: (item: TooltipItem<"bar">) => {
            const count = item.parsed.y ?? 0;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
            return [` Count: ${count}`, ` Share: ${pct}% of ${filterLabel}`];
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: "#a1a1aa", maxRotation: 35, font: { size: 11 } }, grid: { color: "#27272a" } },
      y: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" }, beginAtZero: true },
    },
  };
}

function buildPieOpts(title: string) {
  return {
    responsive: true,
    animation: { duration: 350 },
    plugins: {
      legend: { labels: { color: "#e4e4e7", padding: 12 }, position: "bottom" as const },
      title: { display: true, text: title, color: "#e4e4e7", font: { size: 13, weight: "bold" as const } },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<"pie">) => {
            const count = item.parsed as number;
            const total = (item.dataset.data as number[]).reduce((a, b) => a + (b as number), 0);
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
            return ` ${item.label}: ${count} (${pct}%)`;
          },
        },
      },
    },
  };
}

function buildDonutOpts(title: string) {
  return {
    responsive: true,
    animation: { duration: 350 },
    plugins: {
      legend: { labels: { color: "#e4e4e7", padding: 12 }, position: "bottom" as const },
      title: { display: true, text: title, color: "#e4e4e7", font: { size: 13, weight: "bold" as const } },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<"doughnut">) => {
            const count = item.parsed as number;
            const total = (item.dataset.data as number[]).reduce((a, b) => a + (b as number), 0);
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
            return ` ${item.label}: ${count} (${pct}%)`;
          },
        },
      },
    },
  };
}

function buildFraudRateOpts(title: string) {
  return {
    responsive: true,
    animation: { duration: 350 },
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#e4e4e7" },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<"bar">) => ` Fraud rate: ${item.parsed.y}%`,
          afterLabel: (item: TooltipItem<"bar">) => {
            const r = item.parsed.y ?? 0;
            return r > 30 ? " ⚠ High fraud risk" : r > 10 ? " Moderate risk" : " Low risk";
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: "#a1a1aa", maxRotation: 30 }, grid: { color: "#27272a" } },
      y: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" }, beginAtZero: true },
    },
  };
}

function buildSimpleBarOpts(title: string) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#e4e4e7" },
      tooltip: { callbacks: { label: (i: TooltipItem<"bar">) => ` ${i.parsed.y}%` } },
    },
    scales: {
      x: { ticks: { color: "#a1a1aa", maxRotation: 30 }, grid: { color: "#27272a" } },
      y: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" }, beginAtZero: true },
    },
  };
}

export default function FakeJobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Explorer controls
  const [filter, setFilter]       = useState<FilterMode>("all");
  const [feature, setFeature]     = useState<Feature>("employment_type");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [topN, setTopN]           = useState<TopN>(10);

  const [activeSection, setActiveSection] = useState("intro");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    Papa.parse<JobRow>("/data/fake_jobs_small.csv", {
      download: true, header: true, dynamicTyping: false, skipEmptyLines: true,
      complete: (result) => { setRows(result.data as JobRow[]); setLoading(false); },
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id); },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    for (const el of Object.values(sectionRefs.current)) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  // Filtered data — reacts to filter button immediately
  const filteredData = useMemo(() => {
    if (filter === "fraudulent") return rows.filter((r) => r.fraudulent === "1");
    if (filter === "real")       return rows.filter((r) => r.fraudulent === "0");
    return rows;
  }, [rows, filter]);

  // Full-dataset stats for the intro section (never changes)
  const allStats = useMemo(() => {
    if (!rows.length) return null;
    const total = rows.length;
    const fraudulent = rows.filter((r) => r.fraudulent === "1").length;
    const missing: Record<string, number> = {};
    for (const col of COLUMNS) missing[col as string] = missingCount(rows, col);
    return { total, fraudulent, real: total - fraudulent, missing };
  }, [rows]);

  // Dynamic summary cards — update on filter OR feature change
  const dynamicStats = useMemo(() => {
    const total      = filteredData.length;
    const fraudulent = filteredData.filter((r) => r.fraudulent === "1").length;
    const real       = filteredData.filter((r) => r.fraudulent === "0").length;
    const fraudPct   = total > 0 ? ((fraudulent / total) * 100).toFixed(1) : "0";
    const mostCommon = countValues(filteredData, feature)[0]?.[0] ?? "—";
    return { total, fraudulent, real, fraudPct, mostCommon };
  }, [filteredData, feature]);

  // Top-N entries for the explorer chart
  const explorerEntries = useMemo(
    () => countValues(filteredData, feature).slice(0, topN),
    [filteredData, feature, topN]
  );

  // Stable chart data object
  const explorerChartData = useMemo(() => ({
    labels: explorerEntries.map(([k]) => k),
    data:   explorerEntries.map(([, v]) => v),
    colors: PALETTE.slice(0, explorerEntries.length),
  }), [explorerEntries]);

  // Fraud-rate charts always use full rows (cross-group comparison)
  const fraudRateData = useMemo(() => {
    function ratesByCol(col: keyof JobRow) {
      const map: Record<string, { fraud: number; total: number }> = {};
      for (const r of rows) {
        const k = r[col] || "Unknown";
        if (!map[k]) map[k] = { fraud: 0, total: 0 };
        map[k].total++;
        if (r.fraudulent === "1") map[k].fraud++;
      }
      return Object.entries(map)
        .filter(([, v]) => v.total >= 2)
        .map(([k, v]) => ({ label: k, rate: Math.round((v.fraud / v.total) * 100) }))
        .sort((a, b) => b.rate - a.rate);
    }
    return { byEmpType: ratesByCol("employment_type"), byExp: ratesByCol("required_experience") };
  }, [rows]);

  // Missing-values data for section 03
  const missingPct = useMemo(() =>
    COLUMNS.map((col) => ({
      col: col as string,
      pct: allStats ? Math.round((allStats.missing[col as string] / rows.length) * 100) : 0,
    })).filter((d) => d.pct > 0).sort((a, b) => b.pct - a.pct),
  [allStats, rows.length]);

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Loading dataset…</p>
        </div>
      </div>
    );
  }

  const featLabel   = FEATURES.find((f) => f.value === feature)?.label ?? feature;
  const filterLabel = filter === "all" ? "all postings" : `${filter} postings`;
  const explorerTitle = `Top ${topN} ${featLabel} — ${filter === "all" ? "All" : filter === "real" ? "Real" : "Fraudulent"} Postings`;
  const explanation   = buildExplanation(feature, chartType, topN, filter);

  const fraudRateColor = (rate: number) =>
    rate > 30 ? "rgba(239,68,68,0.85)" : rate > 10 ? "rgba(245,158,11,0.85)" : "rgba(34,197,94,0.85)";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">

      {/* ── SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 h-screen border-r border-zinc-800 bg-zinc-900 pt-8 pb-6 px-4">
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 transition-colors">← Home</a>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Sections</div>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                activeSection === s.id
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >{s.label}</button>
          ))}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-16">

        {/* 01 Introduction */}
        <section id="intro" ref={(el) => { sectionRefs.current["intro"] = el; }}>
          <div className="inline-block text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded mb-3">KEY 01</div>
          <h1 className="text-3xl font-bold text-white mb-4">Fake Job Postings Dataset</h1>
          <p className="text-zinc-400 leading-relaxed mb-6">
            This notebook explores the <strong className="text-zinc-200">Fake Job Postings</strong> dataset — a collection
            of real and fraudulent job listings scraped from various job boards. Widely used for employment fraud research,
            NLP, and binary classification.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { val: allStats?.total,      color: "text-white",     label: "Total postings" },
              { val: allStats?.fraudulent, color: "text-red-400",   label: "Fraudulent" },
              { val: allStats?.real,       color: "text-green-400", label: "Real listings" },
            ].map(({ val, color, label }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-zinc-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-3">Source Dataset</div>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Originally published on Kaggle by the University of the Aegean. The full dataset contains 17,880 rows and
              18 columns. This tutorial uses a curated 160-row sample that preserves realistic fraud/real distributions.
            </p>
            <a href="/data/fake_jobs_small.csv" download="fake_jobs_small.csv"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-white rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Fake Job Postings Dataset
              <span className="text-xs text-zinc-500">160 rows · 18 cols</span>
            </a>
          </div>
        </section>

        {/* 02 Dataset Overview */}
        <section id="overview" ref={(el) => { sectionRefs.current["overview"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">02 — Dataset Overview</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            18 columns covering job details, company information, and a binary fraud label.
            Many columns have high missing rates — a real-world data quality challenge.
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Column</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["job_id","integer","Unique identifier"],
                  ["title","text","Job title as posted"],
                  ["location","text","City and state"],
                  ["department","text","Department (often missing)"],
                  ["salary_range","text","Salary if provided (~70% missing)"],
                  ["company_profile","text","Company description"],
                  ["description","text","Full job description"],
                  ["requirements","text","Qualifications required"],
                  ["benefits","text","Benefits offered"],
                  ["telecommuting","binary","1 = remote work offered"],
                  ["has_company_logo","binary","1 = company logo present"],
                  ["has_questions","binary","1 = screening questions present"],
                  ["employment_type","categorical","Full-time, Part-time, Contract…"],
                  ["required_experience","categorical","Experience level required"],
                  ["required_education","categorical","Education level required"],
                  ["industry","categorical","Industry sector"],
                  ["function","categorical","Job function / department"],
                  ["fraudulent","binary","TARGET: 1 = fake, 0 = real"],
                ].map(([col, type, desc], i) => (
                  <tr key={col} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}`}>
                    <td className="px-4 py-2 font-mono text-xs text-blue-400">{col}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                        type === "binary" ? "bg-amber-500/15 text-amber-400" :
                        type === "integer" ? "bg-blue-500/15 text-blue-400" :
                        type === "text" ? "bg-purple-500/15 text-purple-400" :
                        "bg-teal-500/15 text-teal-400"
                      }`}>{type}</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-sm font-semibold text-zinc-300 mb-3">Sample Rows</div>
          <div className="space-y-3">
            {rows.slice(0, 3).map((row, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-400">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-600">#{row.job_id}</span>
                  <span className="text-zinc-200 font-semibold" style={{ fontFamily: "inherit" }}>{row.title}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${row.fraudulent === "1" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {row.fraudulent === "1" ? "FRAUDULENT" : "REAL"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span><span className="text-zinc-600">location:</span> {row.location || "—"}</span>
                  <span><span className="text-zinc-600">employment_type:</span> {row.employment_type || "—"}</span>
                  <span><span className="text-zinc-600">industry:</span> {row.industry || "—"}</span>
                  <span><span className="text-zinc-600">salary_range:</span> {row.salary_range || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 03 Data Cleaning */}
        <section id="cleaning" ref={(el) => { sectionRefs.current["cleaning"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">03 — Data Cleaning</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Many fields are intentionally or accidentally blank. Identifying missing patterns is the first step —
            fraudulent postings often omit details on purpose.
          </p>
          {missingPct.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
              <Bar
                data={{
                  labels: missingPct.map((d) => d.col),
                  datasets: [{
                    label: "Missing %",
                    data: missingPct.map((d) => d.pct),
                    backgroundColor: missingPct.map((d) => d.pct > 50 ? "rgba(239,68,68,0.85)" : "rgba(245,158,11,0.85)"),
                    borderRadius: 4,
                  }],
                }}
                options={buildSimpleBarOpts("Missing Values by Column (%)")}
              />
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Column</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Missing</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Missing %</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((col, i) => {
                  const miss = allStats?.missing[col as string] ?? 0;
                  const pct  = rows.length ? Math.round((miss / rows.length) * 100) : 0;
                  const strategy = pct === 0 ? "Complete" : pct < 20 ? "Impute with mode" : pct < 60 ? "Flag as missing" : "Drop or use as-is";
                  return (
                    <tr key={col as string} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}`}>
                      <td className="px-4 py-2 font-mono text-xs text-blue-400">{col as string}</td>
                      <td className="px-4 py-2 text-zinc-300">{miss}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${pct > 50 ? "bg-red-500" : pct > 0 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs ${pct > 50 ? "text-red-400" : pct > 0 ? "text-amber-400" : "text-green-400"}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 text-xs">{strategy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
            <strong>Key observation:</strong> Fraudulent postings consistently omit salary ranges, benefits, and company profiles —
            making high missing rates an informative fraud signal rather than just noise.
          </div>
        </section>

        {/* 04 Data Types */}
        <section id="types" ref={(el) => { sectionRefs.current["types"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">04 — Data Types</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Column types determine preprocessing strategies. Binary columns are model-ready as-is.
            Categoricals need encoding. Free text requires NLP.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { type:"binary",     count:4, dot:"bg-amber-500",  desc:"0/1 flags" },
              { type:"categorical",count:5, dot:"bg-teal-500",   desc:"Finite categories" },
              { type:"text / NLP", count:5, dot:"bg-purple-500", desc:"Free-form text" },
              { type:"integer",    count:1, dot:"bg-blue-500",   desc:"Numeric ID" },
            ].map(({ type, count, dot, desc }) => (
              <div key={type} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className={`w-2 h-2 rounded-full ${dot} mb-3`} />
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs font-semibold text-zinc-300 mt-1">{type}</div>
                <div className="text-xs text-zinc-500">{desc}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Column</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">ML Encoding</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((col, i) => {
                  const t = COL_TYPES[col as string] ?? "text";
                  const enc = t === "integer" ? "As-is" : t.startsWith("binary") ? "As-is (0/1)" : t === "categorical" ? "Label encode / One-hot" : "TF-IDF / BERT embeddings";
                  return (
                    <tr key={col as string} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}`}>
                      <td className="px-4 py-2 font-mono text-xs text-blue-400">{col as string}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          t.startsWith("binary") ? "bg-amber-500/15 text-amber-400" :
                          t === "integer" ? "bg-blue-500/15 text-blue-400" :
                          t === "categorical" ? "bg-teal-500/15 text-teal-400" :
                          "bg-purple-500/15 text-purple-400"
                        }`}>{t}</span>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 text-xs">{enc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 05 Summary Statistics */}
        <section id="stats" ref={(el) => { sectionRefs.current["stats"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">05 — Summary Statistics</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Value distributions across the full dataset. Binary flags and categorical columns reveal how
            postings are structured — patterns here directly inform fraud detection.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ["employment_type",    "Employment Type"],
              ["required_experience","Required Experience"],
              ["required_education", "Required Education"],
              ["telecommuting",      "Telecommuting (0/1)"],
              ["has_company_logo",   "Has Company Logo (0/1)"],
              ["has_questions",      "Has Questions (0/1)"],
            ] as [keyof JobRow, string][]).map(([col, label]) => {
              const entries = countValues(rows, col).slice(0, 6);
              return (
                <div key={col as string} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-xs font-semibold text-zinc-400 mb-3">{label}</div>
                  <div className="space-y-2">
                    {entries.map(([val, cnt]) => (
                      <div key={val} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono w-32 shrink-0 truncate">{val || "—"}</span>
                        <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.round((cnt / rows.length) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400 w-8 text-right">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 06 Visualizations */}
        <section id="viz" ref={(el) => { sectionRefs.current["viz"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">06 — Visualizations</h2>

          {/* ═══ INTERACTIVE EXPLORER ═══ */}
          <div className="bg-zinc-900 border border-blue-500/40 rounded-2xl p-6 mb-12">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-base font-semibold text-blue-300">Interactive Fake Job Explorer</h3>
            </div>
            <p className="text-zinc-500 text-xs mb-6">
              Every control updates the chart and summary cards instantly — no page reload needed.
            </p>

            {/* Controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Filter buttons */}
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Data filter</label>
                <div className="flex gap-1.5">
                  {(["all","real","fraudulent"] as FilterMode[]).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                        filter === f
                          ? f === "fraudulent" ? "bg-red-600 text-white shadow-md" :
                            f === "real"       ? "bg-green-700 text-white shadow-md" :
                                                 "bg-blue-600 text-white shadow-md"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {f === "all" ? `All (${rows.length})` : f === "real" ? `Real (${allStats?.real})` : `Fraud (${allStats?.fraudulent})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature dropdown */}
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Feature / Category</label>
                <select value={feature} onChange={(e) => setFeature(e.target.value as Feature)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                  {FEATURES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              {/* Chart type + Top N */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Chart type</label>
                  <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                    <option value="bar">Bar</option>
                    <option value="pie">Pie</option>
                    <option value="donut">Donut</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 mb-1.5 block font-semibold uppercase tracking-wider">Top N</label>
                  <select value={topN} onChange={(e) => setTopN(Number(e.target.value) as TopN)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={15}>Top 15</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xl font-bold text-white">{dynamicStats.total}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Shown</div>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xl font-bold text-green-400">{dynamicStats.real}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Real</div>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xl font-bold text-red-400">{dynamicStats.fraudulent}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Fraudulent</div>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xl font-bold text-amber-400">{dynamicStats.fraudPct}%</div>
                <div className="text-xs text-zinc-500 mt-0.5">Fraud rate</div>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 col-span-2 sm:col-span-1">
                <div className="text-sm font-bold text-blue-300 truncate leading-tight">{dynamicStats.mostCommon}</div>
                <div className="text-xs text-zinc-500 mt-0.5">Top {featLabel}</div>
              </div>
            </div>

            {/* Chart canvas */}
            <div className="bg-zinc-950 rounded-xl p-5 border border-zinc-800 mb-4" style={{ minHeight: 340 }}>
              {explorerEntries.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
                  No data for the current filter.
                </div>
              ) : chartType === "bar" ? (
                <Bar
                  key={`bar-${feature}`}
                  data={{
                    labels: explorerChartData.labels,
                    datasets: [{ label: featLabel, data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderRadius: 5 }],
                  }}
                  options={buildBarOpts(explorerTitle, dynamicStats.total, filterLabel)}
                />
              ) : chartType === "pie" ? (
                <Pie
                  key={`pie-${feature}`}
                  data={{
                    labels: explorerChartData.labels,
                    datasets: [{ data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderWidth: 0 }],
                  }}
                  options={buildPieOpts(explorerTitle)}
                />
              ) : (
                <Doughnut
                  key={`donut-${feature}`}
                  data={{
                    labels: explorerChartData.labels,
                    datasets: [{ data: explorerChartData.data, backgroundColor: explorerChartData.colors, borderWidth: 0 }],
                  }}
                  options={buildDonutOpts(explorerTitle)}
                />
              )}
            </div>

            {/* Auto-generated explanation */}
            <div className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-300 leading-relaxed">{explanation}</p>
            </div>
          </div>

          {/* ═══ BINARY FLAG PIES (filter-aware) ═══ */}
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Fraud Signals — Binary Flags</h3>
          <p className="text-zinc-600 text-xs mb-5">
            These charts reflect the current <span className="text-zinc-400 font-medium">Data filter</span> selection above.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
            {([
              { title:"Fraud vs Real", labels:["Real","Fraudulent"], getter:(r: JobRow) => r.fraudulent, vals:["0","1"], colors:["rgba(34,197,94,0.85)","rgba(239,68,68,0.85)"] },
              { title:"Has Company Logo", labels:["No Logo","Has Logo"], getter:(r: JobRow) => r.has_company_logo, vals:["0","1"], colors:["rgba(245,158,11,0.85)","rgba(59,130,246,0.85)"] },
              { title:"Has Screening Questions", labels:["No Questions","Has Questions"], getter:(r: JobRow) => r.has_questions, vals:["0","1"], colors:["rgba(168,85,247,0.85)","rgba(20,184,166,0.85)"] },
              { title:"Telecommuting / Remote", labels:["On-site","Remote"], getter:(r: JobRow) => r.telecommuting, vals:["0","1"], colors:["rgba(99,102,241,0.85)","rgba(6,182,212,0.85)"] },
            ] as { title:string; labels:string[]; getter:(r:JobRow)=>string; vals:string[]; colors:string[] }[]).map(({ title, labels, getter, vals, colors }) => (
              <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Pie
                  data={{
                    labels,
                    datasets: [{ data: vals.map((v) => filteredData.filter((r) => getter(r) === v).length), backgroundColor: colors, borderWidth: 0 }],
                  }}
                  options={buildPieOpts(title)}
                />
              </div>
            ))}
          </div>

          {/* ═══ FRAUD RATE BARS (always full dataset) ═══ */}
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Fraud Rate by Category</h3>
          <p className="text-zinc-600 text-xs mb-5">
            Calculated on all 160 rows. Green = low risk · Amber = moderate · Red = high.
          </p>
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <Bar
                data={{
                  labels: fraudRateData.byEmpType.map((d) => d.label),
                  datasets: [{
                    label: "Fraud Rate %",
                    data: fraudRateData.byEmpType.map((d) => d.rate),
                    backgroundColor: fraudRateData.byEmpType.map((d) => fraudRateColor(d.rate)),
                    borderRadius: 4,
                  }],
                }}
                options={buildFraudRateOpts("Fraud Rate (%) by Employment Type")}
              />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <Bar
                data={{
                  labels: fraudRateData.byExp.map((d) => d.label),
                  datasets: [{
                    label: "Fraud Rate %",
                    data: fraudRateData.byExp.map((d) => d.rate),
                    backgroundColor: fraudRateData.byExp.map((d) => fraudRateColor(d.rate)),
                    borderRadius: 4,
                  }],
                }}
                options={buildFraudRateOpts("Fraud Rate (%) by Required Experience")}
              />
            </div>
          </div>
        </section>

        {/* 07 Insights */}
        <section id="insights" ref={(el) => { sectionRefs.current["insights"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">07 — Insights & Conclusions</h2>
          <div className="space-y-4">
            {[
              { icon:"🔴", title:"Fraudulent postings omit critical details", body:"Fake listings consistently lack salary ranges, company profiles, benefits, and department names. These omissions are strong fraud signals usable as classifier features." },
              { icon:"🏢", title:"Company logo is a strong legitimacy signal", body:"Postings with a company logo are far more likely to be real. Fraudulent actors rarely upload legitimate branding, making this binary flag highly predictive." },
              { icon:"📝", title:"Screening questions correlate with legitimacy", body:"Legitimate employers invest effort in screening questions. Fraudulent postings skip this step — has_questions is a highly predictive binary feature." },
              { icon:"🏠", title:"Remote listings are disproportionately fraudulent", body:"Scammers exploit the remote work promise as bait. Work-from-home postings show a measurably higher fraud rate than on-site roles." },
              { icon:"📊", title:"Part-time and contract roles attract more fraud", body:"Higher fraud rates appear in Part-time and Contract categories — likely because they attract broader, less selective applicant pools." },
              { icon:"🎯", title:"'Not Applicable' experience = high fraud risk", body:"Fraudulent postings overwhelmingly use 'Not Applicable' for required experience — a deliberate tactic to maximize the victim pool." },
              { icon:"🤖", title:"ML classification is well-suited here", body:"Binary flags + categorical features + high-signal missing patterns make this ideal for logistic regression, random forests, or gradient boosting. NLP on title/description adds further lift." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex gap-4">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <div className="font-semibold text-zinc-200 mb-1">{title}</div>
                  <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-blue-600/10 border border-blue-600/30 rounded-xl p-5">
            <div className="font-semibold text-blue-300 mb-2">Next Steps</div>
            <ul className="text-sm text-zinc-400 leading-relaxed space-y-1 list-disc list-inside">
              <li>Vectorize job title and description with TF-IDF or SBERT</li>
              <li>Build a logistic regression baseline classifier</li>
              <li>Evaluate with precision, recall, and F1 (class imbalance matters)</li>
              <li>Experiment with Random Forest and XGBoost</li>
              <li>Deploy a real-time fraud detection API</li>
            </ul>
          </div>
        </section>

      </main>
    </div>
  );
}
