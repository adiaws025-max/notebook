"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ParsedData, CleaningReport, DataProfile, Insight, WorkspaceEntry, Step } from "@/types";
import { STEPS } from "@/types";
import { cleanData } from "@/lib/csv";
import { profileData } from "@/lib/profiler";
import { generateInsights } from "@/lib/insights";
import { saveWorkspace, generateId } from "@/lib/storage";

import StepNav from "@/components/ui/StepNav";
import WorkspacePanel from "@/components/ui/WorkspacePanel";
import UploadStep from "@/components/steps/UploadStep";
import CleanStep from "@/components/steps/CleanStep";
import ProfileStep from "@/components/steps/ProfileStep";
import VisualizeStep from "@/components/steps/VisualizeStep";
import AnalyzeStep from "@/components/steps/AnalyzeStep";
import NotebookStep from "@/components/steps/NotebookStep";

export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); } else { setAuthReady(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [unlocked, setUnlocked] = useState<Set<Step>>(new Set(["upload"]));
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [fileName, setFileName] = useState<string>("");
  const [original, setOriginal] = useState<ParsedData | null>(null);
  const [cleaned, setCleaned] = useState<ParsedData | null>(null);
  const [cleaningReport, setCleaningReport] = useState<CleaningReport | null>(null);
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  function unlock(step: Step) {
    setUnlocked((prev) => new Set([...prev, step]));
  }

  function goTo(step: Step) {
    setCurrentStep(step);
  }

  function handleUpload(data: ParsedData, name: string) {
    setFileName(name);
    setOriginal(data);
    const { cleaned: c, report } = cleanData(data);
    setCleaned(c);
    setCleaningReport(report);
    unlock("clean");
    goTo("clean");
  }

  function handleCleanConfirm() {
    if (!cleaned || !cleaningReport) return;
    const p = profileData(cleaned, cleaningReport);
    setProfile(p);
    unlock("profile");
    goTo("profile");
  }

  function handleProfileContinue() {
    unlock("visualize");
    goTo("visualize");
  }

  function handleVisualizeContinue() {
    if (!cleaned || !profile) return;
    const ins = generateInsights(cleaned, profile);
    setInsights(ins);
    unlock("analyze");
    goTo("analyze");
  }

  function handleAnalyzeContinue() {
    unlock("notebook");
    goTo("notebook");
  }

  function handleSave() {
    if (!cleaned || !cleaningReport || !profile) return;
    const entry: WorkspaceEntry = {
      id: generateId(),
      name: fileName,
      createdAt: Date.now(),
      data: cleaned,
      profile,
      cleaningReport,
    };
    saveWorkspace(entry);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  }

  function handleLoadWorkspace(entry: WorkspaceEntry) {
    setFileName(entry.name);
    setOriginal(entry.data);
    setCleaned(entry.data);
    setCleaningReport(entry.cleaningReport);
    setProfile(entry.profile);
    const ins = generateInsights(entry.data, entry.profile);
    setInsights(ins);
    setUnlocked(new Set(STEPS));
    setCurrentStep("profile");
    setShowWorkspaces(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            DL
          </div>
          <span className="font-semibold text-white">DataLedger</span>
          {fileName && (
            <span className="text-zinc-500 text-sm font-mono ml-2">{fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="text-green-400 text-sm">Saved!</span>
          )}
          {cleaned && (
            <button
              onClick={handleSave}
              className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Save Workspace
            </button>
          )}
          <button
            onClick={() => setShowWorkspaces((s) => !s)}
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showWorkspaces ? "Hide" : "Workspaces"}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Workspace panel */}
      {showWorkspaces && (
        <div className="border-b border-zinc-800 px-6 py-4 bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Saved Workspaces</h3>
          <WorkspacePanel onLoad={handleLoadWorkspace} />
        </div>
      )}

      {/* Step nav */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <StepNav current={currentStep} unlocked={unlocked} onChange={goTo} />
      </div>

      {/* Main content */}
      <main className="px-6 py-8 max-w-4xl mx-auto">
        {currentStep === "upload" && (
          <UploadStep onComplete={handleUpload} />
        )}
        {currentStep === "clean" && original && cleaned && cleaningReport && (
          <CleanStep
            original={original}
            cleaned={cleaned}
            report={cleaningReport}
            onConfirm={handleCleanConfirm}
          />
        )}
        {currentStep === "profile" && profile && (
          <ProfileStep profile={profile} onContinue={handleProfileContinue} />
        )}
        {currentStep === "visualize" && cleaned && profile && (
          <VisualizeStep
            data={cleaned}
            profile={profile}
            onContinue={handleVisualizeContinue}
          />
        )}
        {currentStep === "analyze" && (
          <AnalyzeStep insights={insights} onContinue={handleAnalyzeContinue} />
        )}
        {currentStep === "notebook" && cleaned && (
          <NotebookStep data={cleaned} />
        )}
      </main>
    </div>
  );
}
