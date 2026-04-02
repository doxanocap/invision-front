"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { admissionsApi } from "@/lib/api";
import type { ApplicationDetail, ApplicationListResponse, ApplicationSummary } from "@/types/api";

type RubricKey = "motivation" | "clarity" | "structure" | "specificity" | "english";

type EssayLabel = {
  anon_id: string;
  created_at: string;
  application_id: number;
  source: "questionnaire.main";
  rubric: Record<RubricKey, number>;
  overall_1_10: number;
  notes: string;
  flags: {
    pii_detected: boolean;
    low_effort: boolean;
    needs_followup: boolean;
  };
  essay_redacted: string;
  essay_raw?: string;
};

const STORAGE_SALT = "anon_review_v1_salt";
const STORAGE_LABELS = "anon_review_v1_labels";

function nowIso() {
  return new Date().toISOString();
}

function fnv1a32(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function toBase36(n: number) {
  return n.toString(36).toUpperCase();
}

function getSalt() {
  const existing = localStorage.getItem(STORAGE_SALT);
  if (existing) return existing;
  const salt = `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  localStorage.setItem(STORAGE_SALT, salt);
  return salt;
}

function anonIdForApplicationId(applicationId: number) {
  const salt = getSalt();
  const h = fnv1a32(`${salt}:${applicationId}`);
  return `C-${toBase36(h).padStart(7, "0").slice(0, 7)}`;
}

function redactEssay(text: string) {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const iin = /\b\d{12}\b/g;
  const phone = /\+?\d[\d\s()-]{7,}\d/g;
  return text
    .replace(email, "[REDACTED_EMAIL]")
    .replace(iin, "[REDACTED_IIN]")
    .replace(phone, "[REDACTED_PHONE]");
}

function RatingButtons({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-xl text-xs font-black border transition-colors ${
            n === value
              ? "bg-[#A7E635] border-[#A7E635] text-slate-900"
              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
          }`}
          aria-label={`Set rating to ${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function getMainEssay(detail: ApplicationDetail): string | null {
  const v = detail.questionnaire_data?.answers?.main;
  if (typeof v === "string") return v;
  return null;
}

function loadLabels(): Record<number, EssayLabel> {
  try {
    const raw = localStorage.getItem(STORAGE_LABELS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, EssayLabel>;
    const out: Record<number, EssayLabel> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const id = Number(k);
      if (!Number.isFinite(id)) return;
      out[id] = v;
    });
    return out;
  } catch {
    return {};
  }
}

function saveLabels(labels: Record<number, EssayLabel>) {
  localStorage.setItem(STORAGE_LABELS, JSON.stringify(labels));
}

const DEFAULT_RUBRIC: Record<RubricKey, number> = {
  motivation: 3,
  clarity: 3,
  structure: 3,
  specificity: 3,
  english: 3,
};

export default function ReviewPage() {
  const [queue, setQueue] = useState<ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [labels, setLabels] = useState<Record<number, EssayLabel>>({});
  const [rubric, setRubric] = useState<Record<RubricKey, number>>(DEFAULT_RUBRIC);
  const [overall, setOverall] = useState(7);
  const [notes, setNotes] = useState("");
  const [flagPii, setFlagPii] = useState(false);
  const [flagLowEffort, setFlagLowEffort] = useState(false);
  const [flagNeedsFollowup, setFlagNeedsFollowup] = useState(false);
  const [includeRawInExport, setIncludeRawInExport] = useState(false);
  const [includeApplicationIdInExport, setIncludeApplicationIdInExport] = useState(false);

  useEffect(() => {
    setLabels(loadLabels());
  }, []);

  const loadQueue = useCallback(async () => {
    setIsQueueLoading(true);
    setQueueError(null);
    try {
      const first = await admissionsApi.getApplications({ limit: 200, offset: 0 });
      let acc: ApplicationSummary[] = first.items;
      const grandTotal = first.total ?? first.items.length;
      let offset = acc.length;
      while (offset < grandTotal) {
        const page: ApplicationListResponse = await admissionsApi.getApplications({ limit: 200, offset });
        acc = acc.concat(page.items);
        offset += page.items.length;
        if (page.items.length === 0) break;
        if (acc.length >= 2000) break;
      }
      setQueue(acc);
      setTotal(grandTotal);
      if (!selectedId && acc.length > 0) setSelectedId(acc[0].id);
    } catch (e: unknown) {
      setQueueError(e instanceof Error ? e.message : "Failed to load applications");
    } finally {
      setIsQueueLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const loadDetail = useCallback(async (applicationId: number) => {
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      const d = await admissionsApi.getApplication(applicationId);
      setDetail(d);

      const existing = labels[applicationId];
      if (existing) {
        setRubric(existing.rubric);
        setOverall(existing.overall_1_10);
        setNotes(existing.notes);
        setFlagPii(existing.flags.pii_detected);
        setFlagLowEffort(existing.flags.low_effort);
        setFlagNeedsFollowup(existing.flags.needs_followup);
      } else {
        setRubric(DEFAULT_RUBRIC);
        setOverall(7);
        setNotes("");
        setFlagPii(false);
        setFlagLowEffort(false);
        setFlagNeedsFollowup(false);
      }
    } catch (e: unknown) {
      setDetail(null);
      setDetailError(e instanceof Error ? e.message : "Failed to load application detail");
    } finally {
      setIsDetailLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    if (selectedId === null) return;
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const reviewedCount = useMemo(() => Object.keys(labels).length, [labels]);
  const selectedAnonId = useMemo(() => (selectedId ? anonIdForApplicationId(selectedId) : "—"), [selectedId]);
  const selectedEssayRaw = useMemo(() => (detail ? getMainEssay(detail) : null), [detail]);
  const selectedEssayRedacted = useMemo(() => (selectedEssayRaw ? redactEssay(selectedEssayRaw) : null), [selectedEssayRaw]);

  const goNextUnreviewed = useCallback(() => {
    const next = queue.find((a) => !labels[a.id]);
    if (next) setSelectedId(next.id);
  }, [labels, queue]);

  const saveCurrent = useCallback(() => {
    if (!detail || selectedId === null) return;
    const raw = getMainEssay(detail);
    const redacted = raw ? redactEssay(raw) : "";
    const payload: EssayLabel = {
      anon_id: anonIdForApplicationId(selectedId),
      created_at: nowIso(),
      application_id: selectedId,
      source: "questionnaire.main",
      rubric,
      overall_1_10: overall,
      notes,
      flags: {
        pii_detected: flagPii,
        low_effort: flagLowEffort,
        needs_followup: flagNeedsFollowup,
      },
      essay_redacted: redacted,
      ...(includeRawInExport && raw ? { essay_raw: raw } : {}),
    };

    const next = { ...labels, [selectedId]: payload };
    setLabels(next);
    saveLabels(next);
  }, [detail, selectedId, rubric, overall, notes, flagPii, flagLowEffort, flagNeedsFollowup, labels, includeRawInExport]);

  const exportJsonl = useCallback(() => {
    const lines = Object.values(labels).map((l) => {
      const out: Record<string, unknown> = {
        anon_id: l.anon_id,
        created_at: l.created_at,
        source: l.source,
        rubric: l.rubric,
        overall_1_10: l.overall_1_10,
        notes: l.notes,
        flags: l.flags,
        essay_redacted: l.essay_redacted,
      };
      if (includeApplicationIdInExport) out.application_id = l.application_id;
      if (includeRawInExport && l.essay_raw) out.essay_raw = l.essay_raw;
      return JSON.stringify(out);
    });
    const blob = new Blob([lines.join("\n") + "\n"], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anon_essay_labels_${new Date().toISOString().slice(0, 10)}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [includeApplicationIdInExport, includeRawInExport, labels]);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_LABELS);
    setLabels({});
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 min-h-screen font-sans text-slate-900">
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tight">Anonymous Essay Review</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Queue: {queue.length} loaded (total {total}) • Reviewed: {reviewedCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/applications"
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-700 hover:border-slate-300"
          >
            Applications
          </Link>
          <button
            type="button"
            onClick={goNextUnreviewed}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black"
          >
            Next Unreviewed
          </button>
          <button
            type="button"
            onClick={saveCurrent}
            className="px-4 py-2 rounded-xl bg-[#A7E635] text-slate-900 text-xs font-black uppercase tracking-widest hover:brightness-95"
            disabled={!detail || selectedId === null}
          >
            Save Label
          </button>
          <button
            type="button"
            onClick={exportJsonl}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-700 hover:border-slate-300"
            disabled={reviewedCount === 0}
          >
            Export JSONL
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-4 py-2 rounded-xl border border-red-200 text-xs font-black uppercase tracking-widest text-red-700 hover:border-red-300"
          >
            Clear Local Labels
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase italic tracking-widest">Queue</h2>
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="text-xs font-black text-slate-900 hover:underline"
              disabled={isQueueLoading}
            >
              Refresh
            </button>
          </div>

          {queueError && (
            <div className="p-4 text-sm font-bold text-red-700 bg-red-50 border-b border-red-100">
              {queueError}
            </div>
          )}

          <div className="max-h-[70vh] overflow-auto divide-y divide-gray-100">
            {isQueueLoading ? (
              <div className="p-6 text-sm font-bold text-slate-500">Loading…</div>
            ) : (
              queue.map((a) => {
                const anon = anonIdForApplicationId(a.id);
                const isReviewed = !!labels[a.id];
                const isActive = selectedId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isActive ? "bg-[#EEF8D4]" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{anon}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                          {a.pipeline_stage.replace(/_/g, " ")} • {a.decision_status}
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                        isReviewed ? "border-[#A7E635]/40 text-slate-900 bg-[#EEF8D4]" : "border-slate-200 text-slate-400"
                      }`}>
                        {isReviewed ? "Reviewed" : "New"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase italic tracking-tight">Essay</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {selectedAnonId} • Source: questionnaire.main • Redaction on
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={includeRawInExport}
                  onChange={(e) => setIncludeRawInExport(e.target.checked)}
                />
                Include raw in export
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={includeApplicationIdInExport}
                  onChange={(e) => setIncludeApplicationIdInExport(e.target.checked)}
                />
                Include app id in export
              </label>
            </div>

            <div className="p-8">
              {isDetailLoading ? (
                <div className="text-sm font-bold text-slate-500">Loading detail…</div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm font-bold text-red-700">
                  {detailError}
                </div>
              ) : !detail ? (
                <div className="text-sm font-bold text-slate-500">Select an application.</div>
              ) : selectedEssayRedacted ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
                    {selectedEssayRedacted}
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
                  No questionnaire essay found (answers.main is missing).
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
              <h2 className="text-lg font-black uppercase italic tracking-tight">Manual Label</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  [
                    ["motivation", "Motivation"],
                    ["clarity", "Clarity"],
                    ["structure", "Structure"],
                    ["specificity", "Specificity"],
                    ["english", "English"],
                  ] as Array<[RubricKey, string]>
                ).map(([key, label]) => (
                  <div key={key} className="p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      {label} (1–5)
                    </p>
                    <RatingButtons
                      value={rubric[key]}
                      max={5}
                      onChange={(v) => setRubric((prev) => ({ ...prev, [key]: v }))}
                    />
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Overall (1–10)
                </p>
                <RatingButtons value={overall} max={10} onChange={setOverall} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={flagPii} onChange={(e) => setFlagPii(e.target.checked)} />
                  PII detected
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={flagLowEffort} onChange={(e) => setFlagLowEffort(e.target.checked)} />
                  Low effort
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={flagNeedsFollowup} onChange={(e) => setFlagNeedsFollowup(e.target.checked)} />
                  Needs follow-up
                </label>
              </div>

              <div className="p-5 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full text-sm font-medium border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#A7E635]/30 focus:border-[#A7E635] transition-all"
                  placeholder="Optional reviewer notes (avoid personal identifiers)."
                />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-xs font-bold text-amber-800 leading-relaxed">
                Anonymous mode hides candidate identity in UI. Export still contains text; avoid sharing raw exports if they may include personal data.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
