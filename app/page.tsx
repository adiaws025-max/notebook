import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          DL
        </div>
        <span className="font-semibold text-white">DataLedger</span>
        <span className="text-zinc-600 text-sm ml-2">Data Analysis Notebooks</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Assignment Notebooks</h1>
          <p className="text-zinc-400 max-w-md mx-auto">
            Interactive data analysis tutorials built with real-world datasets.
            Explore cleaning, profiling, visualization, and insights.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* KEY 01 */}
          <Link
            href="/fake-jobs"
            className="group bg-zinc-900 border border-zinc-800 hover:border-blue-500 rounded-2xl p-8 flex flex-col gap-4 transition-all duration-200 hover:bg-zinc-800/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full">
                KEY 01
              </span>
              <svg
                className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Fake Job Postings</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Analyze 160 job listings to detect fraudulent postings using data cleaning,
                binary classification features, and fraud rate visualizations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              {["160 rows", "18 columns", "10+ charts", "Fraud detection"].map((tag) => (
                <span key={tag} className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </Link>

          {/* KEY 02 */}
          <Link
            href="/assignment"
            className="group bg-zinc-900 border border-zinc-800 hover:border-red-500 rounded-2xl p-8 flex flex-col gap-4 transition-all duration-200 hover:bg-zinc-800/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full">
                KEY 02
              </span>
              <svg
                className="w-5 h-5 text-zinc-600 group-hover:text-red-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Heart Disease Dataset</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Explore 303 patient records from the UCI Heart Disease dataset with full
                cleaning, profiling, and 14+ diagnostic visualizations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              {["303 rows", "14 columns", "14+ charts", "Clinical data"].map((tag) => (
                <span key={tag} className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">
        DataLedger · Data Analysis Notebooks
      </footer>
    </div>
  );
}
