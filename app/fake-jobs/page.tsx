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
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

interface JobRow {
  job_id: string;
  title: string;
  location: string;
  department: string;
  salary_range: string;
  company_profile: string;
  description: string;
  requirements: string;
  benefits: string;
  telecommuting: string;
  has_company_logo: string;
  has_questions: string;
  employment_type: string;
  required_experience: string;
  required_education: string;
  industry: string;
  function: string;
  fraudulent: string;
  [key: string]: string;
}

const SECTIONS = [
  { id: "intro", label: "01 Introduction" },
  { id: "overview", label: "02 Dataset Overview" },
  { id: "cleaning", label: "03 Data Cleaning" },
  { id: "types", label: "04 Data Types" },
  { id: "stats", label: "05 Summary Statistics" },
  { id: "viz", label: "06 Visualizations" },
  { id: "insights", label: "07 Insights" },
];

const CHART_COLORS = {
  blue: "rgba(59,130,246,0.85)",
  red: "rgba(239,68,68,0.85)",
  green: "rgba(34,197,94,0.85)",
  purple: "rgba(168,85,247,0.85)",
  amber: "rgba(245,158,11,0.85)",
  teal: "rgba(20,184,166,0.85)",
  pink: "rgba(236,72,153,0.85)",
  orange: "rgba(249,115,22,0.85)",
  indigo: "rgba(99,102,241,0.85)",
  cyan: "rgba(6,182,212,0.85)",
};

const CHART_COLORS_ARR = Object.values(CHART_COLORS);

function countValues(rows: JobRow[], col: keyof JobRow): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = r[col] ?? "";
    if (v === "" || v === null || v === undefined) continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

function missingCount(rows: JobRow[], col: keyof JobRow): number {
  return rows.filter((r) => !r[col] || r[col].trim() === "").length;
}

const COLUMNS: (keyof JobRow)[] = [
  "job_id", "title", "location", "department", "salary_range",
  "company_profile", "description", "requirements", "benefits",
  "telecommuting", "has_company_logo", "has_questions", "employment_type",
  "required_experience", "required_education", "industry", "function", "fraudulent",
];

const COL_TYPES: Record<string, string> = {
  job_id: "integer",
  title: "text",
  location: "text",
  department: "text",
  salary_range: "text",
  company_profile: "text",
  description: "text",
  requirements: "text",
  benefits: "text",
  telecommuting: "binary",
  has_company_logo: "binary",
  has_questions: "binary",
  employment_type: "categorical",
  required_experience: "categorical",
  required_education: "categorical",
  industry: "categorical",
  function: "categorical",
  fraudulent: "binary (target)",
};

const barOpts = (title: string) => ({
  responsive: true,
  plugins: { legend: { display: false }, title: { display: true, text: title, color: "#e4e4e7" } },
  scales: {
    x: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" } },
    y: { ticks: { color: "#a1a1aa" }, grid: { color: "#27272a" } },
  },
});

const pieOpts = (title: string) => ({
  responsive: true,
  plugins: {
    legend: { labels: { color: "#e4e4e7" }, position: "bottom" as const },
    title: { display: true, text: title, color: "#e4e4e7" },
  },
});

export default function FakeJobsPage() {
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "real" | "fraudulent">("all");
  const [activeSection, setActiveSection] = useState("intro");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    Papa.parse<JobRow>("/data/fake_jobs_small.csv", {
      download: true,
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (result) => {
        setRows(result.data as JobRow[]);
        setLoading(false);
      },
    });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    for (const el of Object.values(sectionRefs.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [loading]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "fraudulent") return rows.filter((r) => r.fraudulent === "1");
    return rows.filter((r) => r.fraudulent === "0");
  }, [rows, filter]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const total = rows.length;
    const fraudulent = rows.filter((r) => r.fraudulent === "1").length;
    const real = total - fraudulent;
    const missing: Record<string, number> = {};
    for (const col of COLUMNS) {
      missing[col as string] = missingCount(rows, col);
    }
    return { total, fraudulent, real, missing };
  }, [rows]);

  const charts = useMemo(() => {
    if (!filtered.length) return null;

    const fraudCounts = countValues(rows, "fraudulent");
    const empTypeCounts = countValues(filtered, "employment_type");
    const expCounts = countValues(filtered, "required_experience");
    const eduCounts = countValues(filtered, "required_education");
    const industryCounts = countValues(filtered, "industry");
    const logoCounts = countValues(rows, "has_company_logo");
    const questionCounts = countValues(rows, "has_questions");
    const telecomCounts = countValues(rows, "telecommuting");

    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const fraudByEmpType: Record<string, { fraud: number; total: number }> = {};
    for (const r of rows) {
      const et = r.employment_type || "Unknown";
      if (!fraudByEmpType[et]) fraudByEmpType[et] = { fraud: 0, total: 0 };
      fraudByEmpType[et].total++;
      if (r.fraudulent === "1") fraudByEmpType[et].fraud++;
    }
    const fraudRateEmpType = Object.entries(fraudByEmpType)
      .filter(([, v]) => v.total >= 2)
      .map(([k, v]) => ({ label: k, rate: Math.round((v.fraud / v.total) * 100) }))
      .sort((a, b) => b.rate - a.rate);

    const fraudByExp: Record<string, { fraud: number; total: number }> = {};
    for (const r of rows) {
      const ex = r.required_experience || "Unknown";
      if (!fraudByExp[ex]) fraudByExp[ex] = { fraud: 0, total: 0 };
      fraudByExp[ex].total++;
      if (r.fraudulent === "1") fraudByExp[ex].fraud++;
    }
    const fraudRateExp = Object.entries(fraudByExp)
      .filter(([, v]) => v.total >= 2)
      .map(([k, v]) => ({ label: k, rate: Math.round((v.fraud / v.total) * 100) }))
      .sort((a, b) => b.rate - a.rate);

    const missingPct = COLUMNS.map((col) => ({
      col: col as string,
      pct: stats ? Math.round((stats.missing[col as string] / rows.length) * 100) : 0,
    })).filter((d) => d.pct > 0).sort((a, b) => b.pct - a.pct);

    return {
      fraudCounts, empTypeCounts, expCounts, eduCounts,
      topIndustries, logoCounts, questionCounts, telecomCounts,
      fraudRateEmpType, fraudRateExp, missingPct,
    };
  }, [filtered, rows, stats]);

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading dataset…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-0 h-screen border-r border-zinc-800 bg-zinc-900 pt-8 pb-6 px-4">
        <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 transition-colors">← Home</a>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Sections</div>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                activeSection === s.id
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 space-y-16">

        {/* 01 Introduction */}
        <section id="intro" ref={(el) => { sectionRefs.current["intro"] = el; }}>
          <div className="inline-block text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded mb-3">KEY 01</div>
          <h1 className="text-3xl font-bold text-white mb-4">Fake Job Postings Dataset</h1>
          <p className="text-zinc-400 leading-relaxed mb-6">
            This notebook explores the <strong className="text-zinc-200">Fake Job Postings</strong> dataset — a collection
            of real and fraudulent job listings scraped from various job boards. The dataset is widely used to study
            employment fraud, natural language processing, and binary classification.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{stats?.total}</div>
              <div className="text-xs text-zinc-500 mt-1">Total job postings</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-400">{stats?.fraudulent}</div>
              <div className="text-xs text-zinc-500 mt-1">Fraudulent listings</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">{stats?.real}</div>
              <div className="text-xs text-zinc-500 mt-1">Real listings</div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-3">Source Dataset</div>
            <p className="text-zinc-400 text-sm leading-relaxed mb-4">
              Originally published on Kaggle by the University of the Aegean. The full dataset contains 17,880 rows and
              18 columns. This tutorial uses a curated 160-row sample that preserves realistic distributions.
            </p>
            <a
              href="/data/fake_jobs_small.csv"
              download="fake_jobs_small.csv"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-white rounded-lg transition-colors"
            >
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
            The dataset contains 18 columns covering job details, company information, and a binary fraud label.
            Many columns have high missing rates, reflecting real-world data collection challenges.
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
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
                  ["job_id", "integer", "Unique identifier for each posting"],
                  ["title", "text", "Job title as posted"],
                  ["location", "text", "City and state of the role"],
                  ["department", "text", "Department within the company (often missing)"],
                  ["salary_range", "text", "Salary range if provided (~70% missing)"],
                  ["company_profile", "text", "Company description text"],
                  ["description", "text", "Full job description"],
                  ["requirements", "text", "Qualifications required"],
                  ["benefits", "text", "Benefits offered"],
                  ["telecommuting", "binary", "1 = remote work offered"],
                  ["has_company_logo", "binary", "1 = company logo present"],
                  ["has_questions", "binary", "1 = screening questions present"],
                  ["employment_type", "categorical", "Full-time, Part-time, Contract, etc."],
                  ["required_experience", "categorical", "Experience level required"],
                  ["required_education", "categorical", "Education level required"],
                  ["industry", "categorical", "Industry sector"],
                  ["function", "categorical", "Job function/department"],
                  ["fraudulent", "binary", "TARGET: 1 = fake, 0 = real"],
                ].map(([col, type, desc], i) => (
                  <tr key={col} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}`}>
                    <td className="px-4 py-3 font-mono text-blue-400 text-xs">{col}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                        type === "binary" ? "bg-amber-500/15 text-amber-400" :
                        type === "integer" ? "bg-blue-500/15 text-blue-400" :
                        type === "text" ? "bg-purple-500/15 text-purple-400" :
                        "bg-teal-500/15 text-teal-400"
                      }`}>{type}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample rows */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-zinc-300 mb-3">Sample Rows (first 3)</div>
            <div className="space-y-3">
              {rows.slice(0, 3).map((row, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-400">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-zinc-600">#{row.job_id}</span>
                    <span className="text-zinc-200 font-semibold not-mono" style={{ fontFamily: "inherit" }}>{row.title}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${row.fraudulent === "1" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                      {row.fraudulent === "1" ? "FRAUDULENT" : "REAL"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <span><span className="text-zinc-600">location:</span> {row.location || "—"}</span>
                    <span><span className="text-zinc-600">employment_type:</span> {row.employment_type || "—"}</span>
                    <span><span className="text-zinc-600">industry:</span> {row.industry || "—"}</span>
                    <span><span className="text-zinc-600">required_experience:</span> {row.required_experience || "—"}</span>
                    <span><span className="text-zinc-600">salary_range:</span> {row.salary_range || "—"}</span>
                    <span><span className="text-zinc-600">has_company_logo:</span> {row.has_company_logo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 03 Data Cleaning */}
        <section id="cleaning" ref={(el) => { sectionRefs.current["cleaning"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">03 — Data Cleaning</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Real-world job datasets are inherently messy. Many optional fields are left blank by recruiters,
            and fraudulent postings often omit key details intentionally. Identifying and handling missing values
            is a critical first step before any analysis.
          </p>

          {/* Missing values chart */}
          {charts && charts.missingPct.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
              <Bar
                data={{
                  labels: charts.missingPct.map((d) => d.col),
                  datasets: [{
                    label: "Missing %",
                    data: charts.missingPct.map((d) => d.pct),
                    backgroundColor: charts.missingPct.map((d) => d.pct > 50 ? CHART_COLORS.red : CHART_COLORS.amber),
                  }],
                }}
                options={barOpts("Missing Values by Column (%)")}
              />
            </div>
          )}

          {/* Missing values table */}
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
                  const miss = stats?.missing[col as string] ?? 0;
                  const pct = rows.length ? Math.round((miss / rows.length) * 100) : 0;
                  const strategy =
                    pct === 0 ? "Complete — no action needed" :
                    pct < 20 ? "Impute with mode or 'Unknown'" :
                    pct < 60 ? "Flag as missing category" :
                    "Drop column or use as-is (too sparse)";
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
            <strong>Key observation:</strong> Fraudulent postings tend to omit salary ranges, benefits, and company profiles —
            hallmarks that signal a posting may be deceptive. High missing rates in these fields are informative, not just noise.
          </div>
        </section>

        {/* 04 Data Types */}
        <section id="types" ref={(el) => { sectionRefs.current["types"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">04 — Data Types</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Understanding column data types guides encoding decisions. Binary columns are already machine-readable.
            Categorical columns need label encoding or one-hot encoding before modeling.
            Free-text columns require NLP techniques such as TF-IDF or embeddings.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { type: "binary", count: 4, color: "amber", desc: "0/1 flags" },
              { type: "categorical", count: 5, color: "teal", desc: "Limited categories" },
              { type: "text / NLP", count: 5, color: "purple", desc: "Free-form text" },
              { type: "integer", count: 1, color: "blue", desc: "Numeric ID" },
            ].map(({ type, count, color, desc }) => (
              <div key={type} className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 border-l-2 border-l-${color}-500`}>
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
                  const enc =
                    t === "integer" ? "As-is" :
                    t.startsWith("binary") ? "As-is (0/1)" :
                    t === "categorical" ? "Label encode / One-hot" :
                    "TF-IDF / BERT embeddings";
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
            Categorical columns reveal important class distributions. Notice how binary flags (has_company_logo,
            has_questions, telecommuting) split the data and correlate with fraud.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { col: "employment_type" as keyof JobRow, label: "Employment Type" },
              { col: "required_experience" as keyof JobRow, label: "Required Experience" },
              { col: "required_education" as keyof JobRow, label: "Required Education" },
              { col: "telecommuting" as keyof JobRow, label: "Telecommuting (0/1)" },
              { col: "has_company_logo" as keyof JobRow, label: "Has Company Logo (0/1)" },
              { col: "has_questions" as keyof JobRow, label: "Has Questions (0/1)" },
            ].map(({ col, label }) => {
              const counts = countValues(rows, col);
              const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
              return (
                <div key={col as string} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-xs font-semibold text-zinc-400 mb-3">{label}</div>
                  <div className="space-y-2">
                    {sortedEntries.map(([val, cnt]) => (
                      <div key={val} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono w-28 shrink-0 truncate">{val || "—"}</span>
                        <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${Math.round((cnt / rows.length) * 100)}%` }}
                          />
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
          <h2 className="text-xl font-semibold text-white mb-2">06 — Visualizations</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Use the filter below to explore how distributions shift between real and fraudulent postings.
          </p>

          {/* Filter */}
          <div className="flex gap-2 mb-8">
            {(["all", "real", "fraudulent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? f === "fraudulent" ? "bg-red-600 text-white" : f === "real" ? "bg-green-700 text-white" : "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {f === "all" ? `All (${rows.length})` : f === "real" ? `Real (${stats?.real})` : `Fraudulent (${stats?.fraudulent})`}
              </button>
            ))}
          </div>

          {charts && (
            <div className="space-y-8">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <Pie
                    data={{
                      labels: ["Real (0)", "Fraudulent (1)"],
                      datasets: [{ data: [charts.fraudCounts["0"] ?? 0, charts.fraudCounts["1"] ?? 0], backgroundColor: [CHART_COLORS.green, CHART_COLORS.red], borderWidth: 0 }],
                    }}
                    options={pieOpts("Fraud vs Real Distribution")}
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <Pie
                    data={{
                      labels: ["No Logo (0)", "Has Logo (1)"],
                      datasets: [{ data: [charts.logoCounts["0"] ?? 0, charts.logoCounts["1"] ?? 0], backgroundColor: [CHART_COLORS.amber, CHART_COLORS.blue], borderWidth: 0 }],
                    }}
                    options={pieOpts("Has Company Logo")}
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <Pie
                    data={{
                      labels: ["No Questions (0)", "Has Questions (1)"],
                      datasets: [{ data: [charts.questionCounts["0"] ?? 0, charts.questionCounts["1"] ?? 0], backgroundColor: [CHART_COLORS.purple, CHART_COLORS.teal], borderWidth: 0 }],
                    }}
                    options={pieOpts("Has Screening Questions")}
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <Pie
                    data={{
                      labels: ["On-site (0)", "Remote (1)"],
                      datasets: [{ data: [charts.telecomCounts["0"] ?? 0, charts.telecomCounts["1"] ?? 0], backgroundColor: [CHART_COLORS.indigo, CHART_COLORS.cyan], borderWidth: 0 }],
                    }}
                    options={pieOpts("Telecommuting / Remote")}
                  />
                </div>
              </div>

              {/* Employment type */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: Object.keys(charts.empTypeCounts),
                    datasets: [{
                      label: "Count",
                      data: Object.values(charts.empTypeCounts),
                      backgroundColor: CHART_COLORS_ARR,
                    }],
                  }}
                  options={barOpts(`Employment Type Distribution (${filter})`)}
                />
              </div>

              {/* Experience */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: Object.keys(charts.expCounts),
                    datasets: [{
                      label: "Count",
                      data: Object.values(charts.expCounts),
                      backgroundColor: CHART_COLORS.purple,
                    }],
                  }}
                  options={barOpts(`Required Experience Level (${filter})`)}
                />
              </div>

              {/* Education */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: Object.keys(charts.eduCounts),
                    datasets: [{
                      label: "Count",
                      data: Object.values(charts.eduCounts),
                      backgroundColor: CHART_COLORS.teal,
                    }],
                  }}
                  options={barOpts(`Required Education Level (${filter})`)}
                />
              </div>

              {/* Top industries */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: charts.topIndustries.map(([k]) => k),
                    datasets: [{
                      label: "Count",
                      data: charts.topIndustries.map(([, v]) => v),
                      backgroundColor: CHART_COLORS.indigo,
                    }],
                  }}
                  options={barOpts(`Top 8 Industries (${filter})`)}
                />
              </div>

              {/* Fraud rate by employment type */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: charts.fraudRateEmpType.map((d) => d.label),
                    datasets: [{
                      label: "Fraud Rate %",
                      data: charts.fraudRateEmpType.map((d) => d.rate),
                      backgroundColor: charts.fraudRateEmpType.map((d) =>
                        d.rate > 30 ? CHART_COLORS.red : d.rate > 10 ? CHART_COLORS.amber : CHART_COLORS.green
                      ),
                    }],
                  }}
                  options={barOpts("Fraud Rate (%) by Employment Type")}
                />
              </div>

              {/* Fraud rate by experience */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <Bar
                  data={{
                    labels: charts.fraudRateExp.map((d) => d.label),
                    datasets: [{
                      label: "Fraud Rate %",
                      data: charts.fraudRateExp.map((d) => d.rate),
                      backgroundColor: charts.fraudRateExp.map((d) =>
                        d.rate > 30 ? CHART_COLORS.red : d.rate > 10 ? CHART_COLORS.amber : CHART_COLORS.green
                      ),
                    }],
                  }}
                  options={barOpts("Fraud Rate (%) by Required Experience")}
                />
              </div>
            </div>
          )}
        </section>

        {/* 07 Insights */}
        <section id="insights" ref={(el) => { sectionRefs.current["insights"] = el; }}>
          <h2 className="text-xl font-semibold text-white mb-6">07 — Insights & Conclusions</h2>
          <div className="space-y-4">
            {[
              {
                icon: "🔴",
                title: "Fraudulent postings omit critical details",
                body: "Fake listings consistently lack salary ranges, company profiles, benefits, and department names. These omissions are strong fraud signals that can be used as features in a classifier.",
              },
              {
                icon: "🏢",
                title: "Company logo is a strong legitimacy signal",
                body: "Postings with a company logo present are significantly more likely to be real. Fraudulent actors rarely upload legitimate branding, making this binary flag highly predictive.",
              },
              {
                icon: "📝",
                title: "Screening questions correlate with legitimacy",
                body: "Legitimate employers invest effort in building screening questions. Fraudulent postings tend to skip this step, making has_questions another useful binary feature.",
              },
              {
                icon: "🏠",
                title: "Remote listings are disproportionately fraudulent",
                body: "Work-from-home and remote postings have a higher fraud rate. Scammers exploit the remote work promise as bait, targeting candidates who value flexibility.",
              },
              {
                icon: "📊",
                title: "Part-time and contract roles attract more fraud",
                body: "Analysis of employment types shows higher fraud rates in Part-time and Contract categories compared to Full-time roles, likely because they attract broader audiences.",
              },
              {
                icon: "🎯",
                title: "Entry-level and 'Not Applicable' experience requirements",
                body: "Fraudulent postings overwhelmingly list 'Not Applicable' as the required experience level — a clear tactic to maximize the pool of potential victims.",
              },
              {
                icon: "🤖",
                title: "ML classification is well-suited to this problem",
                body: "The combination of binary flags, categorical features, and high-signal missing patterns makes this an excellent dataset for logistic regression, random forests, or gradient boosting classifiers. Text features from title and description provide additional signal via NLP.",
              },
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
