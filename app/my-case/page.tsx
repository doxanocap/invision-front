"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { candidateApi } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { CandidateCaseState } from "@/types/api";

export default function MyCasePage() {
  const router = useRouter();
  const [caseState, setCaseState] = useState<CandidateCaseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [answerText, setAnswerText] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const autosaveInterval = useRef<NodeJS.Timeout | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchCase = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    try {
      const data = await candidateApi.getCase();
      setCaseState(data);
      if (data.answer) {
        setAnswerText((data.answer.answer_payload as any)?.text || "");
      }
    } catch (err: any) {
      // If 403 or similar, check application stage
      try {
        const app = await candidateApi.getApplication();
        if (app.pipeline_stage !== "case_sent" && app.pipeline_stage !== "case_answered") {
          router.replace("/my-application");
          return;
        }
      } catch {}
      setError(err.message || "Failed to load case");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Timer logic
  useEffect(() => {
    if (caseState?.expires_at && !caseState.answer?.submitted_at) {
      const expiresAt = new Date(caseState.expires_at).getTime();
      
      const updateTimer = () => {
        const now = new Date().getTime();
        const diff = Math.floor((expiresAt - now) / 1000);
        
        if (diff <= 0) {
          setRemainingSeconds(0);
          if (timerInterval.current) clearInterval(timerInterval.current);
          handleAutoSubmit();
        } else {
          setRemainingSeconds(diff);
        }
      };

      updateTimer();
      timerInterval.current = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [caseState?.expires_at, caseState?.answer?.submitted_at]);

  // Autosave logic
  useEffect(() => {
    if (caseState?.answer?.started_at && !caseState.answer.submitted_at) {
      autosaveInterval.current = setInterval(async () => {
        if (answerText.trim()) {
          setIsSaving(true);
          try {
            await candidateApi.saveAnswer({ text: answerText });
            setLastSaved(new Date());
          } catch {}
          setIsSaving(false);
        }
      }, 30000); // 30 seconds
    }

    return () => {
      if (autosaveInterval.current) clearInterval(autosaveInterval.current);
    };
  }, [caseState?.answer?.started_at, caseState?.answer?.submitted_at, answerText]);

  const handleStart = async () => {
    setIsSubmitting(true);
    try {
      const data = await candidateApi.startCase();
      setCaseState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm("Are you sure? You cannot edit after submitting.")) return;
    
    setIsSubmitting(true);
    try {
      const data = await candidateApi.submitAnswer({ text: answerText });
      setCaseState(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (isSubmitting || caseState?.answer?.submitted_at) return;
    setIsSubmitting(true);
    try {
      const data = await candidateApi.submitAnswer({ text: answerText });
      setCaseState(data);
    } catch {}
    setIsSubmitting(false);
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#84CC16]" /></div>;

  if (error) return <div className="p-8 text-center"><div className="bg-red-50 text-red-600 p-4 rounded-xl max-w-md mx-auto">{error}</div></div>;

  if (!caseState) return null;

  const isStarted = !!caseState.answer?.started_at;
  const isSubmitted = !!caseState.answer?.submitted_at;
  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // STATE C: Submitted
  if (isSubmitted) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-4">
           <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
           </div>
           <h1 className="text-2xl font-bold text-slate-900">Case Submitted Successfully</h1>
           <p className="text-slate-600 font-medium">Your answer has been received. You can now return to your application home.</p>
           <button onClick={() => router.push("/my-application")} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md mt-4">
              ← Back to My Application
           </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6 shadow-sm">
           <div className="pb-6 border-b border-gray-100">
              <h2 className="text-xl font-extrabold text-slate-900">{caseState.case_question.title}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">{new Date(caseState.answer!.submitted_at!).toLocaleString()}</p>
           </div>
           <div className="prose prose-slate max-w-none">
              <p className="whitespace-pre-wrap text-slate-800 leading-relaxed font-medium">{answerText}</p>
           </div>
        </div>
      </div>
    );
  }

  // STATE A & B: Not started or In-progress
  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <span className="text-[10px] font-bold text-[#84CC16] uppercase tracking-[0.2em] mb-2 block">Case Question</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{caseState.case_question.title}</h1>
        </div>
        {isStarted && remainingSeconds !== null && (
          <div className={`px-6 py-3 rounded-2xl border-2 flex items-center gap-3 transition-colors ${
            remainingSeconds <= 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white border-gray-100 text-slate-700'
          }`}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
             <span className="font-mono text-xl font-bold">{formatTime(remainingSeconds)}</span>
             <span className="text-xs font-bold uppercase opacity-60">Remaining</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Prompt</h3>
            <p className="text-slate-800 font-medium leading-relaxed italic border-l-4 border-[#84CC16] pl-4">
              "{caseState.case_question.prompt}"
            </p>
          </div>
          
          {!isStarted ? (
            <div className="bg-[#84CC16]/10 border border-[#84CC16]/20 rounded-2xl p-6 space-y-4">
               <h4 className="font-bold text-slate-900">Ready to start?</h4>
               <p className="text-sm font-medium text-slate-600">You will have <strong>{caseState.duration_minutes} minutes</strong> to complete this case once you begin. You cannot pause the timer.</p>
               <button 
                 onClick={handleStart}
                 disabled={isSubmitting}
                 className="w-full py-4 bg-[#84CC16] text-white font-extrabold rounded-xl shadow-lg hover:bg-[#72b513] transition-all disabled:opacity-50"
               >
                 {isSubmitting ? "Starting..." : "Start Case Session"}
               </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="text-slate-500 uppercase tracking-widest text-[10px]">Word Counter</span>
                 <span className="text-slate-900">{wordCount} words</span>
              </div>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 bg-slate-900 text-white font-extrabold rounded-xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {isStarted ? (
            <div className="relative">
              <textarea
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
                placeholder="Write your detailed answer here..."
                className="w-full min-h-[500px] p-8 rounded-2xl border-2 border-gray-100 bg-white shadow-inner focus:outline-none focus:border-[#84CC16] transition-all font-medium text-slate-800 leading-relaxed resize-none"
              />
              <div className="absolute right-4 bottom-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                {isSaving ? (
                  <span className="flex items-center gap-1.5"><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...</span>
                ) : lastSaved ? (
                  <span>Last saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="w-full h-[500px] bg-slate-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-slate-400 gap-4">
               <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
               <p className="font-bold">Text area will become active once you start the case session.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
