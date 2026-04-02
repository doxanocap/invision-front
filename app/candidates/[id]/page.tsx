"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { admissionsApi, downloadFile } from "@/lib/api";
import { Tooltip } from "@/components/Tooltip";
import type {
  ApplicationCaseEvaluationResponse,
  ApplicationAdminDetail,
  ApplicationAssessmentResponse,
  ApplicationDriveEvaluationResponse,
  ApplicationFile,
  ApplicationFileAccessResponse,
  CandidateCaseState,
  DecisionStatus,
  PipelineStage,
} from "@/types/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return "—";
  }
};

const getPipelineBadge = (stage: PipelineStage) => {
  const map: Record<PipelineStage, { label: string; color: string; dot: string }> = {
    pending: { label: "Pending", color: "bg-gray-100 text-gray-700", dot: "bg-gray-500" },
    case_sent: { label: "Case Sent", color: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
    case_answered: { label: "Case Answered", color: "bg-blue-100 text-blue-700", dot: "bg-blue-600" },
    committee_review: { label: "Under Review", color: "bg-[#EEF8D4] text-slate-900", dot: "bg-[#A7E635]" },
    decision_sent: { label: "Decision Sent", color: "bg-green-100 text-green-700", dot: "bg-green-600" },
  };
  const config = map[stage] || map.pending;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

const getDecisionBadge = (status: DecisionStatus) => {
  if (status === "pending") return null;
  const map: Record<DecisionStatus, { label: string; color: string }> = {
    shortlisted: { label: "Shortlisted", color: "bg-green-100 text-green-700" },
    discussion: { label: "Discussion", color: "bg-yellow-100 text-yellow-700" },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
    pending: { label: "Pending", color: "bg-gray-100 text-gray-700" }
  };
  const config = map[status];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  );
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function toScore10(v: number | null) {
  if (v === null) return null;
  return Number((clamp01(v) * 10).toFixed(1));
}

function formatPercent01(v: number | null, decimals: 0 | 1 = 0) {
  if (v === null) return "—";
  const pct = clamp01(v) * 100;
  return `${pct.toFixed(decimals)}%`;
}

function formatPercentOutOf10(v: number | null, decimals: 0 | 1 = 0) {
  if (v === null) return "—";
  const clamped = Math.max(0, Math.min(10, v));
  const pct = clamped * 10;
  return `${pct.toFixed(decimals)}%`;
}

function formatMs(ms: number | null) {
  if (ms === null) return "—";
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function numberFromUnknown(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function textFromUnknown(v: unknown): string | null {
  if (typeof v === "string") return v;
  return null;
}

function booleanFromUnknown(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function extractCandidateSolutionText(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  const directKeys = ["answer", "answer_text", "solution", "candidate_solution", "text", "content"];
  for (const k of directKeys) {
    const t = textFromUnknown(payload[k]);
    if (t && t.trim()) return t;
  }

  const nested = payload["answer_payload"];
  if (nested && typeof nested === "object") {
    try {
      return JSON.stringify(nested, null, 2);
    } catch {
      // ignore
    }
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
}

function renderJsonOrText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractReadableTextFromUnknown(value: unknown): string {
  const tryParseJsonString = (raw: string): unknown | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("\"") && trimmed.endsWith("\""));
    if (!looksLikeJson) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  };

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);

  const fromRecord = (obj: Record<string, unknown>): string | null => {
    const directKeys = ["text", "main", "answer", "content", "solution", "response", "value"];
    for (const key of directKeys) {
      const t = textFromUnknown(obj[key]);
      if (t && t.trim()) return t;
    }

    const firstStringValue =
      Object.keys(obj).length === 1 ? textFromUnknown(Object.values(obj)[0]) : null;
    if (firstStringValue && firstStringValue.trim()) return firstStringValue;

    const nestedKeys = ["data", "payload", "answer_payload", "result"];
    for (const key of nestedKeys) {
      const nested = obj[key];
      if (isRecord(nested)) {
        const nestedText = fromRecord(nested);
        if (nestedText && nestedText.trim()) return nestedText;
      }
    }

    const stringPairs = Object.entries(obj)
      .map(([k, v]) => {
        const t = textFromUnknown(v);
        if (!t || !t.trim()) return null;
        return `${k}: ${t}`;
      })
      .filter(Boolean) as string[];
    if (stringPairs.length > 0) return stringPairs.join("\n\n");

    return null;
  };

  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    return parsed === null ? value : extractReadableTextFromUnknown(parsed);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === "string" ? v : null))
      .filter(Boolean) as string[];
    if (parts.length === value.length && parts.length > 0) return parts.join("\n\n");
    return renderJsonOrText(value);
  }
  if (isRecord(value)) {
    const extracted = fromRecord(value);
    return extracted ?? renderJsonOrText(value);
  }
  return renderJsonOrText(value);
}

function guessTextareaRows(text: string, minRows = 8, maxRows = 18): number {
  const lines = text.split(/\r\n|\r|\n/).length;
  const estimated = lines + 2;
  return Math.max(minRows, Math.min(maxRows, estimated));
}

type VideoTaggingHighlight = {
  token: string;
  pos_category: string;
  start: number;
  end: number;
};

type VideoTaggingResult = {
  text: string;
  value_code: string;
  value_name: string;
  reasoning: string;
  score: number;
  highlights: VideoTaggingHighlight[];
};

type VideoTaggingMetrics = {
  overall_score?: number | null;
  coverage?: number | null;
  balance_score?: number | null;
  strongest?: string[] | null;
  weakest?: string[] | null;
};

type VideoTaggingPayload = {
  lang?: string | null;
  results: VideoTaggingResult[];
  summary?: Record<string, number> | null;
  metrics?: VideoTaggingMetrics | null;
};

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseVideoTaggingPayload(payload: Record<string, unknown> | null): VideoTaggingPayload | null {
  if (!payload) return null;
  const resultsRaw = payload["results"];
  if (!Array.isArray(resultsRaw)) return null;

  const results: VideoTaggingResult[] = resultsRaw
    .map((item) => {
      if (!isPlainRecord(item)) return null;
      const text = textFromUnknown(item["text"]) ?? "";
      const value_code = textFromUnknown(item["value_code"]) ?? "";
      const value_name = textFromUnknown(item["value_name"]) ?? "";
      const reasoning = textFromUnknown(item["reasoning"]) ?? "";
      const score = numberFromUnknown(item["score"]) ?? NaN;

      const highlightsRaw = item["highlights"];
      const highlights: VideoTaggingHighlight[] = Array.isArray(highlightsRaw)
        ? (highlightsRaw
            .map((h) => {
              if (!isPlainRecord(h)) return null;
              const token = textFromUnknown(h["token"]) ?? "";
              const pos_category = textFromUnknown(h["pos_category"]) ?? "";
              const start = numberFromUnknown(h["start"]) ?? NaN;
              const end = numberFromUnknown(h["end"]) ?? NaN;
              if (!token || !pos_category) return null;
              if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
              return { token, pos_category, start, end };
            })
            .filter(Boolean) as VideoTaggingHighlight[])
        : [];

      if (!Number.isFinite(score)) return null;
      if (!text.trim() && !reasoning.trim() && !value_code.trim()) return null;
      return { text, value_code, value_name, reasoning, score, highlights };
    })
    .filter(Boolean) as VideoTaggingResult[];

  const summaryRaw = payload["summary"];
  const summary: Record<string, number> | null =
    isPlainRecord(summaryRaw)
      ? Object.fromEntries(
          Object.entries(summaryRaw)
            .map(([k, v]) => [k, numberFromUnknown(v)])
            .filter(([, v]) => v !== null) as Array<[string, number]>
        )
      : null;

  const metricsRaw = payload["metrics"];
  const metrics: VideoTaggingMetrics | null =
    isPlainRecord(metricsRaw)
      ? {
          overall_score: numberFromUnknown(metricsRaw["overall_score"]),
          coverage: numberFromUnknown(metricsRaw["coverage"]),
          balance_score: numberFromUnknown(metricsRaw["balance_score"]),
          strongest: Array.isArray(metricsRaw["strongest"])
            ? (metricsRaw["strongest"].filter((x: unknown): x is string => typeof x === "string") as string[])
            : null,
          weakest: Array.isArray(metricsRaw["weakest"])
            ? (metricsRaw["weakest"].filter((x: unknown): x is string => typeof x === "string") as string[])
            : null,
        }
      : null;

  return {
    lang: textFromUnknown(payload["lang"]),
    results,
    summary,
    metrics,
  };
}

function formatMaybePercent(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  if (!Number.isFinite(v)) return "—";
  if (v >= 0 && v <= 1) return `${Math.round(v * 100)}%`;
  return String(v);
}

function renderHighlights(text: string, highlights: VideoTaggingHighlight[]) {
  const safe = highlights
    .map((h) => ({
      ...h,
      start: Math.max(0, Math.min(text.length, Math.floor(h.start))),
      end: Math.max(0, Math.min(text.length, Math.floor(h.end))),
    }))
    .filter((h) => h.end > h.start)
    .sort((a, b) => a.start - b.start);

  const nonOverlapping: VideoTaggingHighlight[] = [];
  let lastEnd = 0;
  for (const h of safe) {
    if (h.start < lastEnd) continue;
    nonOverlapping.push(h);
    lastEnd = h.end;
  }

  const parts: Array<{ key: string; text: string; highlight?: VideoTaggingHighlight }> = [];
  let cursor = 0;
  for (const h of nonOverlapping) {
    if (h.start > cursor) parts.push({ key: `t-${cursor}`, text: text.slice(cursor, h.start) });
    parts.push({ key: `h-${h.start}-${h.end}`, text: text.slice(h.start, h.end), highlight: h });
    cursor = h.end;
  }
  if (cursor < text.length) parts.push({ key: `t-${cursor}`, text: text.slice(cursor) });

  return (
    <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p) =>
        p.highlight ? (
          <Tooltip
            key={p.key}
            content={
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {p.highlight.pos_category.replace(/_/g, " ")}
                </div>
                <div className="text-xs font-bold text-slate-900">{p.highlight.token}</div>
              </div>
            }
            className="inline"
          >
            <span className="rounded-md bg-[#A7E635]/25 px-1.5 py-0.5 text-slate-900">
              {p.text}
            </span>
          </Tooltip>
        ) : (
          <span key={p.key}>{p.text}</span>
        )
      )}
    </p>
  );
}

function extractDriveFromAssessmentPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;

  const compositeRaw =
    numberFromUnknown(payload["composite"]) ??
    numberFromUnknown(payload["drive_score"]) ??
    numberFromUnknown(payload["score"]) ??
    null;

  const tier = textFromUnknown(payload["tier"]) ?? null;

  const driveScores =
    payload["drive_scores"] && typeof payload["drive_scores"] === "object"
      ? (payload["drive_scores"] as Record<string, unknown>)
      : null;

  const dimsRaw = {
    disciplined_resilience:
      numberFromUnknown(payload["disciplined_resilience"]) ??
      (driveScores ? numberFromUnknown(driveScores["disciplined_resilience"]) : null),
    responsible_innovation:
      numberFromUnknown(payload["responsible_innovation"]) ??
      (driveScores ? numberFromUnknown(driveScores["responsible_innovation"]) : null),
    insightful_vision:
      numberFromUnknown(payload["insightful_vision"]) ??
      (driveScores ? numberFromUnknown(driveScores["insightful_vision"]) : null),
    values_driven_leadership:
      numberFromUnknown(payload["values_driven_leadership"]) ??
      (driveScores ? numberFromUnknown(driveScores["values_driven_leadership"]) : null),
    entrepreneurial_execution:
      numberFromUnknown(payload["entrepreneurial_execution"]) ??
      (driveScores ? numberFromUnknown(driveScores["entrepreneurial_execution"]) : null),
  };

  const hasAny =
    compositeRaw !== null ||
    tier !== null ||
    Object.values(dimsRaw).some((v) => v !== null);

  if (!hasAny) return null;

  const scaleTo10 = (v: number | null) => {
    if (v === null) return null;
    if (v <= 1) return Number((clamp01(v) * 10).toFixed(1));
    return Number(v.toFixed(1));
  };

  return {
    composite10: scaleTo10(compositeRaw),
    tier,
    dims10: {
      D: scaleTo10(dimsRaw.disciplined_resilience),
      R: scaleTo10(dimsRaw.responsible_innovation),
      I: scaleTo10(dimsRaw.insightful_vision),
      V: scaleTo10(dimsRaw.values_driven_leadership),
      E: scaleTo10(dimsRaw.entrepreneurial_execution),
    },
  };
}

function buildDriveFromEvaluation(evaluation: ApplicationCaseEvaluationResponse) {
  return {
    composite10: evaluation.composite === null ? null : Number((clamp01(evaluation.composite) * 10).toFixed(1)),
    tier: evaluation.tier,
    dims10: {
      D: toScore10(evaluation.disciplined_resilience),
      R: toScore10(evaluation.responsible_innovation),
      I: toScore10(evaluation.insightful_vision),
      V: toScore10(evaluation.values_driven_leadership),
      E: toScore10(evaluation.entrepreneurial_execution),
    },
  };
}

type DriveLetter = "D" | "R" | "I" | "V" | "E";

const DRIVE_DIMENSIONS: Array<{
  letter: DriveLetter;
  title: string;
  tooltip: string;
  getValue: (e: ApplicationCaseEvaluationResponse) => number | null;
}> = [
  {
    letter: "D",
    title: "Disciplined Resilience",
    tooltip: "Stays consistent under pressure, works methodically, and closes tasks without giving up.",
    getValue: (e) => e.disciplined_resilience,
  },
  {
    letter: "R",
    title: "Responsible Innovation",
    tooltip: "Applies creativity responsibly: validates assumptions, considers risks, and avoids harmful shortcuts.",
    getValue: (e) => e.responsible_innovation,
  },
  {
    letter: "I",
    title: "Insightful Vision",
    tooltip: "Sees the core problem clearly, reasons about trade-offs, and anticipates downstream effects.",
    getValue: (e) => e.insightful_vision,
  },
  {
    letter: "V",
    title: "Values-Driven Leadership",
    tooltip: "Acts with integrity, communicates clearly, and keeps decisions aligned with shared values.",
    getValue: (e) => e.values_driven_leadership,
  },
  {
    letter: "E",
    title: "Entrepreneurial Execution",
    tooltip: "Ships pragmatic solutions, prioritizes impact, and executes effectively with limited time/resources.",
    getValue: (e) => e.entrepreneurial_execution,
  },
];

function DriveMetricCard({
  letter,
  title,
  tooltip,
  value10,
}: {
  letter: DriveLetter;
  title: string;
  tooltip: string;
  value10: number | null;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Tooltip content={<span className="font-semibold">{tooltip}</span>}>
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                {letter}
              </span>
            </Tooltip>
            <p className="text-sm font-black text-slate-900 leading-tight">{title}</p>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-2">Hover the letter for details</p>
        </div>
        <div className="shrink-0 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-black text-slate-700">
          {value10 === null ? "—" : `${value10}/10`}
        </div>
      </div>
    </div>
  );
}

function CaseEvaluationCard({
  evaluation,
  caseSentAt,
  caseAnsweredAt,
  assessment,
}: {
  evaluation: ApplicationCaseEvaluationResponse | null | undefined;
  caseSentAt: string | null;
  caseAnsweredAt: string | null;
  assessment: ApplicationAssessmentResponse | null;
}) {
  const assessmentPayload = assessment?.case_answer?.response_payload ?? null;
  const assessmentDrive = extractDriveFromAssessmentPayload(assessmentPayload);
  const driveFromEvaluation = evaluation ? buildDriveFromEvaluation(evaluation) : null;
  const drive = assessmentDrive ?? driveFromEvaluation;

  if (!evaluation) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {DRIVE_DIMENSIONS.map((d) => (
              <Tooltip key={d.letter} content={<span className="font-semibold">{d.letter} — {d.title}</span>}>
                <span className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                  {d.letter}
                </span>
              </Tooltip>
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">D R I V E</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline</p>
            <div className="mt-3 space-y-2 text-sm font-bold text-slate-800">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Case sent</span>
                <span>{formatDate(caseSentAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Case answered</span>
                <span>{formatDate(caseAnsweredAt)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#F4F9EB] border border-[#E2EFCD]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">DRIVE Score</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-black text-slate-900">
                {drive?.composite10 ?? "—"}
              </span>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">out of 10</span>
            </div>
            <p className="text-sm font-semibold text-slate-600 mt-4">
              Status: {assessment?.case_answer?.status ?? "not_started"}
            </p>
            {drive?.tier ? (
              <p className="text-xs font-black text-slate-500 mt-2">Tier: {drive.tier}</p>
            ) : null}
          </div>
        </div>

        {drive ? (
          <div className="grid grid-cols-1 gap-3">
            <DriveMetricCard letter="D" title="Disciplined Resilience" tooltip={DRIVE_DIMENSIONS[0].tooltip} value10={drive.dims10.D} />
            <DriveMetricCard letter="R" title="Responsible Innovation" tooltip={DRIVE_DIMENSIONS[1].tooltip} value10={drive.dims10.R} />
            <DriveMetricCard letter="I" title="Insightful Vision" tooltip={DRIVE_DIMENSIONS[2].tooltip} value10={drive.dims10.I} />
            <DriveMetricCard letter="V" title="Values-Driven Leadership" tooltip={DRIVE_DIMENSIONS[3].tooltip} value10={drive.dims10.V} />
            <DriveMetricCard letter="E" title="Entrepreneurial Execution" tooltip={DRIVE_DIMENSIONS[4].tooltip} value10={drive.dims10.E} />
          </div>
        ) : null}
      </div>
    );
  }

  if (evaluation.status === "pending" || evaluation.status === "processing") {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
        <p className="text-sm font-black text-slate-900">AI analysis in progress…</p>
        <p className="text-xs font-semibold text-slate-500 mt-2">Queued: {formatDate(evaluation.queued_at)}</p>
        <p className="text-xs font-semibold text-slate-500">Status: {evaluation.status}</p>
      </div>
    );
  }

  if (evaluation.status === "failed") {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-100">
        <p className="text-sm font-black text-red-800">AI evaluation failed</p>
        <p className="text-xs font-semibold text-red-700 mt-2">{evaluation.error_message || "Unknown error"}</p>
      </div>
    );
  }

  const composite10 = drive?.composite10 ?? (evaluation.composite === null ? null : Number((clamp01(evaluation.composite) * 10).toFixed(1)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {DRIVE_DIMENSIONS.map((d) => (
            <Tooltip key={d.letter} content={<span className="font-semibold">{d.letter} — {d.title}</span>}>
              <span className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                {d.letter}
              </span>
            </Tooltip>
          ))}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">D R I V E</span>
      </div>

      <div className="p-6 rounded-3xl bg-[#F4F9EB] border border-[#E2EFCD]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">DRIVE Score</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-black text-slate-900">
                {composite10 === null ? "—" : composite10}
              </span>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">out of 10</span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-2">Completed: {formatDate(evaluation.completed_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {drive?.tier ? (
              <span className="px-3 py-1 rounded-full bg-white border border-[#E2EFCD] text-[10px] font-black uppercase tracking-widest text-slate-700">
                {drive.tier}
              </span>
            ) : null}
            {evaluation.is_hidden_talent ? (
              <span className="px-3 py-1 rounded-full bg-white border border-[#E2EFCD] text-[10px] font-black uppercase tracking-widest text-slate-900">
                ⚡ Hidden Talent
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-600 mt-4">
          Summary: Hover each letter to understand what it measures.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {drive ? (
          <>
            <DriveMetricCard letter="D" title="Disciplined Resilience" tooltip={DRIVE_DIMENSIONS[0].tooltip} value10={drive.dims10.D} />
            <DriveMetricCard letter="R" title="Responsible Innovation" tooltip={DRIVE_DIMENSIONS[1].tooltip} value10={drive.dims10.R} />
            <DriveMetricCard letter="I" title="Insightful Vision" tooltip={DRIVE_DIMENSIONS[2].tooltip} value10={drive.dims10.I} />
            <DriveMetricCard letter="V" title="Values-Driven Leadership" tooltip={DRIVE_DIMENSIONS[3].tooltip} value10={drive.dims10.V} />
            <DriveMetricCard letter="E" title="Entrepreneurial Execution" tooltip={DRIVE_DIMENSIONS[4].tooltip} value10={drive.dims10.E} />
          </>
        ) : (
          DRIVE_DIMENSIONS.map((d) => (
            <DriveMetricCard
              key={d.letter}
              letter={d.letter}
              title={d.title}
              tooltip={d.tooltip}
              value10={toScore10(d.getValue(evaluation))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PresentationEvaluationCard({ evaluation }: { evaluation: ApplicationDriveEvaluationResponse | null }) {
  if (!evaluation) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
        No video evaluation available.
      </div>
    );
  }

  if (evaluation.status === "pending" || evaluation.status === "processing") {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
        <p className="text-sm font-black text-slate-900">Video analysis in progress…</p>
        <p className="text-xs font-semibold text-slate-500 mt-2">Queued: {formatDate(evaluation.queued_at)}</p>
        <p className="text-xs font-semibold text-slate-500">Status: {evaluation.status}</p>
      </div>
    );
  }

  if (evaluation.status === "failed") {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-100">
        <p className="text-sm font-black text-red-800">Video evaluation failed</p>
        <p className="text-xs font-semibold text-red-700 mt-2">{evaluation.error_message || "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluation.summary_payload ? (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Video Analysis Summary</p>
          <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(evaluation.summary_payload, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
          No summary_payload.
        </div>
      )}

      {evaluation.results_payload ? (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Results</p>
          <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(evaluation.results_payload, null, 2)}
          </pre>
        </div>
      ) : null}

      <p className="text-xs font-semibold text-slate-500">Completed: {formatDate(evaluation.completed_at)}</p>
    </div>
  );
}


export default function CandidateDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const applicationId = Number(id);
  const [app, setApp] = useState<ApplicationAdminDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "video" | "assessment">("personal");
  const [fileAccessById, setFileAccessById] = useState<Record<number, ApplicationFileAccessResponse>>({});
  const [fileAccessLoadingById, setFileAccessLoadingById] = useState<Record<number, boolean>>({});
  const [rawCopied, setRawCopied] = useState(false);

  const [applicationCase, setApplicationCase] = useState<CandidateCaseState | null>(null);
  const [applicationCaseLoading, setApplicationCaseLoading] = useState(false);
  const [applicationCaseError, setApplicationCaseError] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<ApplicationAssessmentResponse | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const [solutionTextById, setSolutionTextById] = useState<Record<number, string>>({});
  const [solutionTextLoadingById, setSolutionTextLoadingById] = useState<Record<number, boolean>>({});
  const [solutionTextErrorById, setSolutionTextErrorById] = useState<Record<number, string>>({});

  const getErrStatus = (err: unknown): number | undefined => {
    if (!err || typeof err !== "object") return undefined;
    const maybeStatus = (err as { status?: unknown }).status;
    return typeof maybeStatus === "number" ? maybeStatus : undefined;
  };

  const getErrMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (!err || typeof err !== "object") return "Unknown error";
    const maybeMessage = (err as { message?: unknown }).message;
    return typeof maybeMessage === "string" ? maybeMessage : "Unknown error";
  };

  const fetchApp = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIs404(false);

    try {
      const data = await admissionsApi.getApplication(applicationId);
      setApp(data);
    } catch (err: unknown) {
      if (getErrStatus(err) === 404) {
        setIs404(true);
      } else {
        setError(getErrMessage(err) || "Failed to load application");
      }
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  const handleDecision = useCallback(async (status: DecisionStatus) => {
    if (!app) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await admissionsApi.setDecision(app.id, status);
      await fetchApp();
    } catch (err: unknown) {
      setError(getErrMessage(err) || "Failed to update decision");
    } finally {
      setIsActionLoading(false);
    }
  }, [app, fetchApp]);

  const handleSendDecision = useCallback(async () => {
    if (!app) return;
    setIsActionLoading(true);
    setError(null);
    try {
      await admissionsApi.sendDecision(app.id);
      await fetchApp();
    } catch (err: unknown) {
      setError(getErrMessage(err) || "Failed to send decision");
    } finally {
      setIsActionLoading(false);
    }
  }, [app, fetchApp]);

  const ensureFileAccess = useCallback(async (file: ApplicationFile) => {
    if (!app) return;
    if (fileAccessById[file.id]) return;
    if (fileAccessLoadingById[file.id]) return;

    setFileAccessLoadingById((prev) => ({ ...prev, [file.id]: true }));
    try {
      const access = await admissionsApi.getApplicationFileAccess(app.id, file.id);
      setFileAccessById((prev) => ({ ...prev, [file.id]: access }));
    } finally {
      setFileAccessLoadingById((prev) => ({ ...prev, [file.id]: false }));
    }
  }, [app, fileAccessById, fileAccessLoadingById]);

  const loadSolutionText = useCallback(async (file: ApplicationFile) => {
    if (!app) return;
    if (solutionTextById[file.id]) return;
    if (solutionTextLoadingById[file.id]) return;

    setSolutionTextLoadingById((prev) => ({ ...prev, [file.id]: true }));
    setSolutionTextErrorById((prev) => ({ ...prev, [file.id]: "" }));

    try {
      const cached = fileAccessById[file.id];
      const access =
        cached ?? (await admissionsApi.getApplicationFileAccess(app.id, file.id));
      if (!cached) setFileAccessById((prev) => ({ ...prev, [file.id]: access }));

      const res = await fetch(access.download_url);
      if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

      const contentType = res.headers.get("content-type") || "";
      const isText = contentType.startsWith("text/") || contentType.includes("json");
      if (!isText) throw new Error(`Not a text file (${contentType || "unknown"})`);

      const raw = await res.text();
      const trimmed = raw.trim();
      const maybeJson =
        contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("\"");
      let rendered = raw;
      if (maybeJson) {
        try {
          rendered = extractReadableTextFromUnknown(JSON.parse(trimmed));
        } catch {
          rendered = raw;
        }
      }

      const maxLen = 20000;
      if (rendered.length > maxLen) rendered = `${rendered.slice(0, maxLen)}\n\n…(truncated)`;
      setSolutionTextById((prev) => ({ ...prev, [file.id]: rendered }));
    } catch (err: unknown) {
      setSolutionTextErrorById((prev) => ({ ...prev, [file.id]: getErrMessage(err) || "Failed to load solution" }));
    } finally {
      setSolutionTextLoadingById((prev) => ({ ...prev, [file.id]: false }));
    }
  }, [app, fileAccessById, solutionTextById, solutionTextLoadingById]);

  useEffect(() => {
    if (!app) return;

    if (activeTab === "video") {
      const videoFile =
        app.files.find((f) => f.category === "presentation_video") ??
        app.files.find((f) => f.section === "presentation") ??
        null;
      if (videoFile) void ensureFileAccess(videoFile);
    }

    if (activeTab === "assessment") {
      const assessmentFiles = app.files.filter((f) => f.section === "case_response");
      assessmentFiles.forEach((f) => {
        void ensureFileAccess(f);
        void loadSolutionText(f);
      });

      if (!applicationCase && !applicationCaseLoading) {
        setApplicationCaseLoading(true);
        setApplicationCaseError(null);
        admissionsApi
          .getApplicationCase(app.id)
          .then((c) => setApplicationCase(c))
          .catch((err: unknown) => setApplicationCaseError(getErrMessage(err) || "Failed to load candidate case"))
          .finally(() => setApplicationCaseLoading(false));
      }
    }
  }, [
    activeTab,
    app,
    ensureFileAccess,
    loadSolutionText,
    applicationCase,
    applicationCaseLoading,
  ]);

  // Fetch assessment once per application (used in sidebar and video/case tabs).
  useEffect(() => {
    if (!app) return;
    if (assessment || assessmentLoading) return;

    setAssessmentLoading(true);
    setAssessmentError(null);
    admissionsApi
      .getApplicationAssessment(app.id)
      .then((a) => setAssessment(a))
      .catch((err: unknown) => setAssessmentError(getErrMessage(err) || "Failed to load assessment"))
      .finally(() => setAssessmentLoading(false));
  }, [app, assessment, assessmentLoading]);

  const openFile = useCallback(async (file: ApplicationFile) => {
    if (!app) return;
    const cached = fileAccessById[file.id];
    const access =
      cached ?? (await admissionsApi.getApplicationFileAccess(app.id, file.id));
    if (!cached) setFileAccessById((prev) => ({ ...prev, [file.id]: access }));
    window.open(access.download_url, "_blank", "noopener,noreferrer");
  }, [app, fileAccessById]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-8" />
        <div className="flex gap-8 items-start">
          <div className="flex-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 flex gap-6">
              <div className="w-20 h-20 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="h-8 w-64 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 h-64" />
            <div className="bg-white p-8 rounded-2xl border border-gray-100 h-64" />
          </div>
          <div className="w-80 bg-white p-6 rounded-2xl border border-gray-100 h-64" />
        </div>
      </div>
    );
  }

  if (is404) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Application not found</h1>
          <p className="text-gray-500 mb-6 text-sm">ID: {id}</p>
          <Link href="/applications" className="text-slate-900 font-bold hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-bold mb-4">Error: {error}</p>
          <button onClick={fetchApp} className="bg-[#A7E635] text-slate-900 px-6 py-2 rounded-lg font-bold mb-4 block w-full hover:brightness-95 transition-colors">
            Try again
          </button>
          <Link href="/applications" className="text-gray-500 text-sm hover:underline">
            ← Back to list
          </Link>
        </div>
      </div>
    );
  }

  const initials = app.full_name?.split(" ").map(n => n[0]).join("").substring(0, 2) || "??";
  const docCategories: Record<string, string> = {
    id_document: "Identity Document",
    english_results: "English Exam Results",
    certificate: "Academic Certificate",
    additional_document: "Additional Document",
    social_status_document: "Social Status Certificate",
    father_income_document: "Father Income Document",
    mother_income_document: "Mother Income Document",
    guardian_income_document: "Guardian Income Document",
  };

  const requiredCategories = ["id_document", "english_results", "certificate"];
  const missingCategories = requiredCategories.filter(cat => !app.files.some(f => f.category === cat));
  const presentationVideoFile =
    app.files.find((f) => f.category === "presentation_video") ??
    app.files.find((f) => f.section === "presentation") ??
    null;
  const caseResponseFiles = app.files.filter((f) => f.section === "case_response");
  const assessmentSolutionText = extractCandidateSolutionText(assessment?.case_answer?.response_payload ?? null);
  const assessmentCasePayload = assessment?.case_answer?.response_payload ?? null;
  const assessmentDriveSidebar = extractDriveFromAssessmentPayload(assessmentCasePayload);
  const assessmentGrowth = numberFromUnknown(assessmentCasePayload?.["growth_score"]);
  const assessmentAuthenticity = numberFromUnknown(assessmentCasePayload?.["authenticity_score"]);
  const assessmentProcessingMs = numberFromUnknown(assessmentCasePayload?.["processing_time_ms"]);
  const assessmentHiddenTalent = booleanFromUnknown(assessmentCasePayload?.["is_hidden_talent"]);
  const assessmentCandidateName = textFromUnknown(assessmentCasePayload?.["candidate_name"]);
  const rawAssessmentText =
    assessmentCasePayload ? JSON.stringify(assessmentCasePayload, null, 2) : "";

  const tierStyles: Record<string, { pill: string; dot: string }> = {
    green: { pill: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
    yellow: { pill: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
    red: { pill: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  };
  const tierKey = assessmentDriveSidebar?.tier?.toLowerCase() ?? "";
  const tierStyle = tierStyles[tierKey] ?? { pill: "bg-white/70 text-slate-700 border-white/60", dot: "bg-slate-400" };

  const copyRawAssessment = async () => {
    if (!rawAssessmentText) return;
    try {
      await navigator.clipboard.writeText(rawAssessmentText);
      setRawCopied(true);
      window.setTimeout(() => setRawCopied(false), 1200);
    } catch {
      // ignore (no permission / unsupported)
    }
  };
  const presentationVideoUrl = presentationVideoFile
    ? fileAccessById[presentationVideoFile.id]?.download_url
    : undefined;
  const presentationVideoLoading = presentationVideoFile
    ? !!fileAccessLoadingById[presentationVideoFile.id]
    : false;

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 min-h-screen font-sans text-slate-900">
      <Link href="/applications" className="inline-flex items-center text-slate-500 text-sm font-semibold mb-6 hover:text-slate-800 transition-colors">
        <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Applications
      </Link>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main Content */}
        <div className="flex-1 w-full space-y-8">
          
          {/* SECTION 1: HEADER */}
          <header className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-[#A7E635] text-slate-900 rounded-2xl flex items-center justify-center text-2xl font-extrabold uppercase shadow-sm">
                {initials}
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-extrabold tracking-tight">Candidate Profile</div>
                <div className="text-lg font-semibold text-slate-900">{app.full_name}</div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Submitted: {app.submitted_at ? formatDate(app.submitted_at) : "—"}
                  </span>
                  <span className="text-slate-400">User ID: INV-{app.id}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {getPipelineBadge(app.pipeline_stage)}
              {getDecisionBadge(app.decision_status)}
            </div>
          </header>

          {/* SECTION 2: INFO ROW */}
	          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
	            {[
	              { label: "Application status", value: `${app.form_status === 'submitted' ? 'Submitted' : 'Draft'} and ${app.pipeline_stage === 'committee_review' ? 'awaiting committee review' : app.pipeline_stage.replace(/_/g, ' ')}` },
	              { label: "City", value: app.city || "—" },
	              { label: "Primary contact", value: app.contacts_data?.mobile_phone || app.mobile_phone || "—" },
	              { label: "Gender", value: app.gender || "—" }
	            ].map((item, idx) => (
	              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
	                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
	                <p className="text-sm font-bold text-slate-800 leading-tight">{item.value}</p>
	              </div>
	            ))}
	          </div>

            {/* TABS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3">
              <div className="flex gap-2 text-sm font-black">
                <button
                  type="button"
                  onClick={() => setActiveTab("personal")}
                  className={`px-4 py-2.5 rounded-xl transition-colors ${
                    activeTab === "personal"
                      ? "bg-[#EEF8D4] text-slate-900 border border-[#A7E635]/30"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Personal Information
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("video")}
                  className={`px-4 py-2.5 rounded-xl transition-colors ${
                    activeTab === "video"
                      ? "bg-[#EEF8D4] text-slate-900 border border-[#A7E635]/30"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Video Presentation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("assessment")}
                  className={`px-4 py-2.5 rounded-xl transition-colors ${
                    activeTab === "assessment"
                      ? "bg-[#EEF8D4] text-slate-900 border border-[#A7E635]/30"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Online Assessment
                </button>
              </div>
            </div>

            {activeTab === "personal" && (
              <>
	          {/* SECTION 3: PERSONAL INFORMATION */}
	          {app.profile_data && (
	            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
	              <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
	                <h2 className="text-lg font-black uppercase italic tracking-tight">Personal Information</h2>
	              </div>
	              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile Data */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Basic Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Last Name" value={app.profile_data.last_name} />
                      <Field label="First Name" value={app.profile_data.first_name} />
                      <Field label="Patronymic" value={app.profile_data.patronymic} />
                      <Field label="Date of Birth" value={formatDate(app.profile_data.date_of_birth)} />
                      <Field label="Gender" value={app.profile_data.gender} />
                    </div>
                  </div>

                  {/* Identity Data */}
                  {app.identity_data && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Identity</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="IIN" value={app.identity_data.iin} />
                        <Field label="Type of Document" value={app.identity_data.identity_document_type} />
                        <Field label="Document Number" value={app.identity_data.document_no} />
                        <Field label="Citizenship" value={app.identity_data.citizenship} />
                        <Field label="Authority" value={app.identity_data.authority} />
                        <Field label="Date of Issue" value={formatDate(app.identity_data.date_of_issue)} />
                      </div>
                    </div>
                  )}

                  {/* Contacts Data */}
                  {app.contacts_data && (
                    <div className="space-y-4 md:col-span-2">
                       <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-gray-100 pb-2">Contacts</h3>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Field label="Phone" value={app.contacts_data.mobile_phone} />
                        <Field label="Telegram" value={app.contacts_data.telegram_handle} />
                        <Field label="Instagram" value={app.contacts_data.instagram_handle} />
                        <Field label="WhatsApp" value={app.contacts_data.whatsapp_number} />
                       </div>
                    </div>
                  )}
                </div>
              </div>
	            </section>
	          )}

          {/* SECTION 4: EDUCATION */}
          {app.education_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                 <h2 className="text-lg font-black uppercase italic tracking-tight">Education</h2>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                 <Field label="English Exam" value={app.education_data.english_exam_type} />
                 <Field label="Certificate" value={app.education_data.certificate_type} />
	                 <div>
	                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Presentation</p>
	                   {app.education_data.presentation_link ? (
	                     <p className="text-sm font-bold text-slate-900">Provided</p>
	                   ) : (
	                     <p className="text-sm font-semibold text-slate-400">—</p>
	                   )}
	                 </div>
	               </div>
	            </section>
	          )}

          {/* SECTION 5: DOCUMENTS */}
          {app.files.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                <h2 className="text-lg font-black uppercase italic tracking-tight">Documents</h2>
              </div>
              <div className="p-8 space-y-6">
                {/* Status Summary */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  {missingCategories.length === 0 ? (
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      All required documents received
                    </div>
                  ) : (
                    missingCategories.map(cat => (
                      <div key={cat} className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Missing: {docCategories[cat]}
                      </div>
                    ))
                  )}
                </div>

                <div className="divide-y divide-gray-100">
                  {app.files.map(file => (
                    <div key={file.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-[#A7E635]/10 group-hover:text-slate-900 transition-colors">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{file.original_name}</p>
                          <p className="text-[10px] font-black uppercase text-slate-400 mt-0.5">
                            {docCategories[file.category] || file.category.replace(/_/g, ' ')} • {formatSize(file.size_bytes)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-xs font-semibold text-slate-400">{formatDate(file.created_at)}</p>
                        <button 
                          onClick={() => downloadFile(file.id, file.original_name, "admissions", app.id)}
                          className="p-2 text-slate-400 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100"
                          title="Download"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                      </div>
                    </div>

                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 6: FAMILY */}
          {app.family_data && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
                 <h2 className="text-lg font-black uppercase italic tracking-tight">Family</h2>
               </div>
               <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                 {app.family_data.father && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Father</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.father.last_name || ''} ${app.family_data.father.first_name || ''} ${app.family_data.father.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-slate-900 font-bold">{app.family_data.father.mobile_phone || "—"}</p>
                   </div>
                 )}
                 {app.family_data.mother && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mother</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.mother.last_name || ''} ${app.family_data.mother.first_name || ''} ${app.family_data.mother.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-slate-900 font-bold">{app.family_data.mother.mobile_phone || "—"}</p>
                   </div>
                 )}
                 {app.family_data.guardian && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Guardian</p>
                     <p className="text-sm font-bold text-slate-900">{`${app.family_data.guardian.last_name || ''} ${app.family_data.guardian.first_name || ''} ${app.family_data.guardian.patronymic || ''}`.trim() || '—'}</p>
                     <p className="text-xs text-slate-900 font-bold">{app.family_data.guardian.mobile_phone || "—"}</p>
                   </div>
                 )}
               </div>
            </section>
          )}

          {/* SECTION 7: ADDRESS */}
	          {app.address_data && (
	            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
	               <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
	                 <h2 className="text-lg font-black uppercase italic tracking-tight">Address</h2>
	               </div>
	               <div className="p-8">
	                 <p className="text-sm font-bold text-slate-800">
	                   {[app.address_data.country, app.address_data.region, app.address_data.city, `${app.address_data.street} ${app.address_data.house}`, app.address_data.apartment ? `apt ${app.address_data.apartment}` : null].filter(Boolean).join(", ")}
	                 </p>
	               </div>
	            </section>
	          )}
              </>
            )}

            {activeTab === "video" && (
              <>
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black uppercase italic tracking-tight">Video Presentation</h2>
                      <p className="text-xs font-semibold text-slate-400 mt-1">Candidate video response (category: presentation_video)</p>
                    </div>
                    {presentationVideoFile && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openFile(presentationVideoFile)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                          disabled={presentationVideoLoading}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadFile(presentationVideoFile.id, presentationVideoFile.original_name, "admissions", app.id)}
                          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-colors"
                          disabled={presentationVideoLoading}
                        >
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-8">
                    {!presentationVideoFile ? (
                      <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
                        No presentation video uploaded yet.
                      </div>
                    ) : presentationVideoLoading && !presentationVideoUrl ? (
                      <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
                        Loading video…
                      </div>
                    ) : presentationVideoUrl ? (
                      <div className="space-y-4">
                        <video
                          className="w-full rounded-2xl border border-gray-100 bg-black"
                          controls
                          src={presentationVideoUrl}
                        />
                        <div className="flex flex-wrap gap-6 text-xs font-bold text-slate-500">
                          <div>File: {presentationVideoFile.original_name}</div>
                          <div>Type: {presentationVideoFile.mime_type}</div>
                          <div>Size: {formatSize(presentationVideoFile.size_bytes)}</div>
                          <div>Uploaded: {formatDate(presentationVideoFile.created_at)}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-500">
                        Video link not available.
                      </div>
                    )}
                  </div>
                </section>

	                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
	                  <div className="px-8 py-5 border-b border-gray-50 bg-slate-50/50">
	                    <h2 className="text-lg font-black uppercase italic tracking-tight">Video Evaluation</h2>
	                  </div>
	                  <div className="p-8">
                      {/* Assessment status + transcript (from /api/applications/{id}/assessment) */}
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI pipeline</p>
                            <p className="text-sm font-black text-slate-900 mt-2">
                              Video: {assessment?.presentation.status ?? "—"}
                            </p>
                            <p className="text-xs font-semibold text-slate-500 mt-1">
                              Stage: {assessment?.presentation.stage ?? "—"} • Audio: {assessment?.presentation.audio_extraction_status ?? "—"} • Eval: {assessment?.presentation.evaluation_status ?? "—"}
                            </p>
                          </div>
                          {assessment?.presentation.error_message ? (
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-widest">
                              Failed
                            </span>
                          ) : assessment?.presentation.status === "completed" ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-widest">
                              Completed
                            </span>
                          ) : assessment?.presentation.status === "processing" ? (
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-widest">
                              Processing
                            </span>
                          ) : assessment?.presentation.status ? (
                            <span className="px-3 py-1 rounded-full bg-white text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                              {assessment.presentation.status}
                            </span>
                          ) : null}
                        </div>

                        {assessmentLoading ? (
                          <div className="mt-4 space-y-2 animate-pulse">
                            <div className="h-4 w-2/3 bg-white rounded" />
                            <div className="h-4 w-full bg-white/80 rounded" />
                          </div>
                        ) : assessmentError ? (
                          <p className="mt-4 text-xs font-semibold text-red-700">{assessmentError}</p>
                        ) : assessment?.presentation.error_message ? (
                          <p className="mt-4 text-xs font-semibold text-red-700">{assessment.presentation.error_message}</p>
                        ) : assessment ? (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-semibold text-slate-600">
                            <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                              Queued: <span className="font-black text-slate-900">{formatDate(assessment.presentation.queued_at ?? null)}</span>
                            </div>
                            <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                              Started: <span className="font-black text-slate-900">{formatDate(assessment.presentation.started_at ?? null)}</span>
                            </div>
                            <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                              Done: <span className="font-black text-slate-900">{formatDate(assessment.presentation.completed_at ?? null)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-xs font-semibold text-slate-500">
                            No assessment data.
                          </div>
                        )}

                        {assessment?.presentation.response_payload ? (
                          <div className="mt-5">
                            {(() => {
                              const parsed = parseVideoTaggingPayload(assessment.presentation.response_payload);

                              const handleCopyRaw = async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    JSON.stringify(assessment.presentation.response_payload, null, 2)
                                  );
                                } catch {
                                  // ignore
                                }
                              };

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between gap-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                      Transcript / post-tagging
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleCopyRaw}
                                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                                    >
                                      Copy raw
                                    </button>
                                  </div>

                                  {parsed ? (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Language</p>
                                          <p className="text-sm font-black text-slate-900 mt-1">{parsed.lang || "—"}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overall score</p>
                                          <p className="text-sm font-black text-slate-900 mt-1">
                                            {parsed.metrics?.overall_score ?? "—"}
                                          </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Coverage</p>
                                          <p className="text-sm font-black text-slate-900 mt-1">
                                            {formatMaybePercent(parsed.metrics?.coverage)}
                                          </p>
                                        </div>
                                      </div>

                                        {parsed.summary && Object.keys(parsed.summary).length > 0 ? (
                                          <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Summary</p>
                                            <div className="flex flex-wrap gap-2">
                                              {Object.entries(parsed.summary).map(([k, v]) => (
                                              <span
                                                key={k}
                                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700"
                                              >
                                                <span className="text-slate-500">{k}</span>
                                                <span className="text-slate-900">{v}</span>
                                              </span>
                                            ))}
                                          </div>
                                          </div>
                                        ) : null}

                                      {parsed.results.length > 0 ? (
                                        (() => {
                                          const segmentMap = new Map<
                                            string,
                                            { text: string; results: VideoTaggingResult[]; highlights: VideoTaggingHighlight[] }
                                          >();

                                          for (const r of parsed.results) {
                                            const key = r.text.trim();
                                            if (!key) continue;
                                            const existing = segmentMap.get(key);
                                            if (!existing) {
                                              segmentMap.set(key, { text: r.text, results: [r], highlights: [...r.highlights] });
                                            } else {
                                              existing.results.push(r);
                                              existing.highlights.push(...r.highlights);
                                            }
                                          }

                                          const segments = Array.from(segmentMap.values());

                                          return (
                                            <div className="space-y-4">
                                              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                  Transcript (deduped)
                                                </p>
                                                <div className="space-y-6">
                                                  {segments.map((seg, i) => {
                                                    const codes = Array.from(
                                                      new Set(seg.results.map((r) => (r.value_code || "?").trim().toUpperCase()))
                                                    );
                                                    const dedupHighlights = (() => {
                                                      const seen = new Set<string>();
                                                      const out: VideoTaggingHighlight[] = [];
                                                      for (const h of seg.highlights) {
                                                        const key = `${h.start}:${h.end}:${h.token}:${h.pos_category}`;
                                                        if (seen.has(key)) continue;
                                                        seen.add(key);
                                                        out.push(h);
                                                      }
                                                      return out;
                                                    })();

                                                    return (
                                                      <div key={`seg-${i}`} className="space-y-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                          {codes.map((code) => {
                                                            const itemsForCode = seg.results.filter(
                                                              (r) => r.value_code?.trim().toUpperCase() === code
                                                            );
                                                            const bestScore =
                                                              itemsForCode.length > 0
                                                                ? Math.max(...itemsForCode.map((r) => r.score))
                                                                : null;
                                                            const primary = itemsForCode[0];
                                                            const label =
                                                              primary?.value_name?.split("/")[0]?.trim() || primary?.value_name || code;

                                                            return (
                                                              <Tooltip
                                                                key={`${i}-${code}`}
                                                                content={
                                                                  <div className="space-y-3">
                                                                    <div className="flex items-center justify-between gap-4">
                                                                      <div className="flex items-center gap-2">
                                                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-black">
                                                                          {code}
                                                                        </span>
                                                                        <div className="min-w-0">
                                                                          <div className="text-xs font-black text-slate-900 truncate">
                                                                            {label}
                                                                          </div>
                                                                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                            Strength signal
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                      <span className="shrink-0 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                                                        Score <span className="text-slate-900">{bestScore ?? "—"}</span>
                                                                      </span>
                                                                    </div>

                                                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                                                        Transcript excerpt
                                                                      </div>
                                                                      <div className="text-xs font-semibold text-slate-800 whitespace-pre-wrap break-words">
                                                                        {seg.text}
                                                                      </div>
                                                                    </div>

                                                                    {primary?.reasoning?.trim() ? (
                                                                      <div>
                                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                                                          Why it’s strong
                                                                        </div>
                                                                        <div className="text-xs font-semibold text-slate-700 whitespace-pre-wrap break-words">
                                                                          {primary.reasoning}
                                                                        </div>
                                                                      </div>
                                                                    ) : (
                                                                      <div className="text-xs font-semibold text-slate-500">
                                                                        No reasoning available.
                                                                      </div>
                                                                    )}
                                                                  </div>
                                                                }
                                                              >
                                                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700 cursor-default">
                                                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-black">
                                                                    {code}
                                                                  </span>
                                                                  <span>{bestScore ?? "—"}</span>
                                                                </span>
                                                              </Tooltip>
                                                            );
                                                          })}
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-100 bg-[#FBFBFC] p-4">
                                                          {dedupHighlights.length > 0
                                                            ? renderHighlights(seg.text, dedupHighlights)
                                                            : (
                                                              <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                                                                {seg.text}
                                                              </p>
                                                            )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <div className="p-4 rounded-2xl border border-slate-100 bg-white text-sm font-semibold text-slate-500">
                                          No post-tagging results found.
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <pre className="text-xs whitespace-pre-wrap break-words max-h-[260px] overflow-auto rounded-2xl border border-slate-100 bg-white p-4">
                                      {extractReadableTextFromUnknown(assessment.presentation.response_payload)}
                                    </pre>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>

                      {app.presentation_evaluation ? (
                        <details className="mt-6">
                          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Legacy evaluation payload
                          </summary>
                          <div className="mt-4">
                            <PresentationEvaluationCard evaluation={app.presentation_evaluation} />
                          </div>
                        </details>
                      ) : null}
	                  </div>
	                </section>
	              </>
	            )}

            {activeTab === "assessment" && (
              <div className="space-y-8">
                {/* PROVIDED TASK */}
	                  <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
	                    <div className="px-8 py-7 border-b border-gray-50 flex items-center justify-between">
	                      <h2 className="text-xl font-black tracking-tight text-slate-900">Provided Task (TZ)</h2>
	                      <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
	                        Case #{applicationCase?.case_question?.id ?? "—"}
	                      </span>
	                    </div>
	                    <div className="p-6">
	                      {applicationCaseLoading ? (
	                        <div className="space-y-4 animate-pulse">
	                          <div className="h-6 w-1/2 bg-slate-100 rounded-lg" />
	                          <div className="space-y-2">
	                            <div className="h-4 w-full bg-slate-50 rounded" />
                            <div className="h-4 w-5/6 bg-slate-50 rounded" />
                          </div>
                        </div>
	                      ) : applicationCaseError ? (
	                        <div className="p-6 rounded-2xl bg-red-50 border border-red-100 text-sm font-semibold text-red-700">
	                          {applicationCaseError}
	                        </div>
	                      ) : applicationCase?.case_question ? (
	                        <div className="space-y-4">
	                          <div className="text-base font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
	                            {applicationCase.case_question.prompt}
	                          </div>
	                        </div>
	                      ) : (
	                        <div className="text-sm font-semibold text-slate-400 italic">Task details not available.</div>
                      )}
                    </div>
                  </section>

                {/* CANDIDATE SOLUTION */}
	                  <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
	                    <div className="px-8 py-7 border-b border-gray-50">
	                      <h2 className="text-xl font-black tracking-tight text-slate-900">Candidate Solution</h2>
	                    </div>
	                    <div className="p-6 space-y-6">
	                      {applicationCase?.answer?.answer_payload ? (
	                        <div className="space-y-4">
	                          <div className="flex flex-wrap gap-6 text-xs font-bold text-slate-500">
	                            <div>Started: {formatDate(applicationCase.answer.started_at)}</div>
	                            <div>Submitted: {formatDate(applicationCase.answer.submitted_at)}</div>
	                          </div>
	                          {(() => {
	                            const solutionText = extractReadableTextFromUnknown(applicationCase.answer.answer_payload);
	                            return (
	                          <textarea
	                            readOnly
	                            spellCheck={false}
	                            value={solutionText}
	                            rows={guessTextareaRows(solutionText, 8, 18)}
	                            className="w-full p-6 rounded-2xl border-2 border-gray-100 bg-white shadow-inner focus:outline-none focus:border-[#A7E635] transition-all font-medium text-slate-800 leading-relaxed resize-y"
	                          />
	                            );
	                          })()}
	                        </div>
	                      ) : null}

                      {caseResponseFiles.length > 0 ? (
                        <div className="space-y-6">
                          {caseResponseFiles.map((file) => {
                            const text = solutionTextById[file.id];
                            const isLoadingText = !!solutionTextLoadingById[file.id];
                            const textError = solutionTextErrorById[file.id];
                            const hasText = Boolean(text);

                            return (
                              <div key={file.id} className="space-y-6">
                                <div className="p-5 rounded-2xl border border-slate-100 bg-[#FBFBFC] flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0 text-slate-900">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-slate-900 truncate">{file.original_name}</p>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                        {formatSize(file.size_bytes)} • {formatDate(file.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                     <button
                                      onClick={() => void loadSolutionText(file)}
                                      disabled={isLoadingText || hasText}
                                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:bg-slate-200 disabled:text-slate-500 transition-colors shadow-sm"
                                    >
                                      {hasText ? "Loaded" : isLoadingText ? "Loading…" : "Load Text"}
                                    </button>
                                     <button
                                      onClick={() => openFile(file)}
                                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => downloadFile(file.id, file.original_name, "admissions", app.id)}
                                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>

                                {textError ? (
                                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm font-semibold text-red-700">
                                    {textError}
                                  </div>
                                ) : null}

	                                {isLoadingText ? (
	                                  <div className="space-y-3 animate-pulse">
	                                    <div className="h-4 w-full bg-slate-50 rounded" />
	                                    <div className="h-4 w-5/6 bg-slate-50 rounded" />
	                                  </div>
	                                ) : hasText ? (
	                                  <div className="relative group">
	                                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#A7E635]/20 rounded-full group-hover:bg-[#A7E635]/40 transition-colors" />
	                                    {(() => {
	                                      const normalizedText = typeof text === "string" ? text : "";
	                                      return (
	                                    <textarea
	                                      readOnly
	                                      spellCheck={false}
	                                      value={normalizedText}
	                                      rows={guessTextareaRows(normalizedText, 10, 22)}
	                                      className="w-full p-6 rounded-2xl border-2 border-gray-100 bg-white shadow-inner focus:outline-none focus:border-[#A7E635] transition-all font-medium text-slate-800 leading-relaxed resize-y"
	                                    />
	                                      );
	                                    })()}
	                                  </div>
	                                ) : (
	                                  <p className="text-xs font-bold text-slate-400 italic">Click “Load Text” to display solution as text.</p>
	                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : !applicationCase?.answer?.answer_payload ? (
                        <div className="p-10 text-center space-y-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <p className="text-sm font-bold text-slate-400">
                            No answer submitted yet.
                          </p>
                          {app.case_answered_at ? (
                            <p className="text-xs font-semibold text-slate-500">
                              Case is marked as answered ({formatDate(app.case_answered_at)}), but there is no uploaded file in <span className="font-black">files[]</span> with section <span className="font-black">case_response</span>.
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-slate-400">
                              No assessment submission files (section: case_response).
                            </p>
                          )}
                          {assessmentLoading ? (
                            <div className="mt-6 space-y-3 animate-pulse text-left">
                              <div className="h-4 w-3/4 bg-slate-50 rounded" />
                              <div className="h-4 w-full bg-slate-50 rounded" />
                              <div className="h-4 w-5/6 bg-slate-50 rounded" />
                            </div>
	                          ) : assessmentSolutionText ? (
	                            <div className="mt-6 text-left">
	                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
	                                Candidate solution (from /assessment)
	                              </p>
	                              {(() => {
	                                const normalizedText = extractReadableTextFromUnknown(assessmentSolutionText);
	                                return (
	                              <textarea
	                                readOnly
	                                spellCheck={false}
	                                value={normalizedText}
	                                rows={guessTextareaRows(normalizedText, 10, 22)}
	                                className="w-full p-6 rounded-2xl border-2 border-gray-100 bg-white shadow-inner focus:outline-none focus:border-[#A7E635] transition-all font-medium text-slate-800 leading-relaxed resize-y"
	                              />
	                                );
	                              })()}
	                            </div>
	                          ) : assessmentError ? (
                            <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm font-semibold text-red-700">
                              {assessmentError}
                            </div>
                          ) : null}
                          {app.current_case_evaluation?.response_payload ? (
                            <div className="mt-6 text-left">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                Debug: response_payload
                              </p>
                              <pre className="text-xs whitespace-pre-wrap break-words max-h-[320px] overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                {JSON.stringify(app.current_case_evaluation.response_payload, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </section>
              </div>
	            )}

        </div>

        {/* SIDEBAR: ACTION PANEL */}
        <aside className="w-full lg:w-80 lg:sticky lg:top-8 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="px-6 py-6 border-b border-gray-100">
               <h2 className="text-xl font-extrabold tracking-tight">Action Panel</h2>
               <p className="text-sm text-slate-500 mt-2">
                 Move the application forward, or send committee decision.
               </p>
             </div>
             <div className="p-6 space-y-4">
                {(app.pipeline_stage === "committee_review" || app.pipeline_stage === "case_answered") ? (
                  <div className="space-y-3">
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("shortlisted")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl font-bold text-sm transition-all ${
                        app.decision_status === "shortlisted"
                          ? "bg-[#A7E635] text-slate-900"
                          : "bg-[#EEF8D4] text-slate-900 hover:brightness-95"
                      }`}
                    >
                      ⭐ Shortlist
                    </button>
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("discussion")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl font-bold text-sm transition-all ${
                        app.decision_status === "discussion"
                          ? "bg-amber-500 text-white"
                          : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
                      }`}
                    >
                      💬 Discussion
                    </button>
                    <button 
                      disabled={isActionLoading}
                      onClick={() => handleDecision("rejected")}
                      className={`w-full flex items-center justify-center p-3 rounded-xl font-bold text-sm transition-all ${
                        app.decision_status === "rejected"
                          ? "bg-red-500 text-white"
                          : "bg-red-500/10 text-red-700 hover:bg-red-500/15"
                      }`}
                    >
                      ✕ Reject
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-sm font-semibold text-slate-500">Decision status locked</p>
                  </div>
                )}

                {app.decision_status !== "pending" && (
                   <button 
                    disabled={isActionLoading || app.pipeline_stage === "decision_sent"}
                    onClick={handleSendDecision}
                    className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white p-3 rounded-xl font-bold text-sm transition-all"
                   >
                     {app.pipeline_stage === "decision_sent" ? "✓ Decision Sent" : "Send Decision"}
                   </button>
                )}

                {error && <p className="text-red-600 text-sm font-semibold text-center">{error}</p>}

             </div>
          </div>
          
          <div className="bg-[#EEF8D4] p-6 rounded-2xl border border-[#A7E635]/30">
            <h3 className="text-xs font-extrabold uppercase text-slate-900 tracking-widest mb-2">Assisted Review</h3>
            {assessmentLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-2/3 bg-white/60 rounded" />
                <div className="h-4 w-full bg-white/50 rounded" />
              </div>
            ) : assessmentError ? (
              <p className="text-xs font-semibold text-red-700 leading-relaxed">{assessmentError}</p>
            ) : assessment ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">DRIVE score</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {assessmentDriveSidebar?.composite10 ?? "—"}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">/ 10</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        ({formatPercentOutOf10(assessmentDriveSidebar?.composite10 ?? null)})
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mt-2">
                      Overall: <span className="font-black">{assessment.overall_status}</span>
                    </p>
                  </div>
                  {assessmentDriveSidebar?.tier ? (
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${tierStyle.pill}`}>
                      <span className={`w-2 h-2 rounded-full ${tierStyle.dot}`} />
                      {assessmentDriveSidebar.tier}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                  <div className="rounded-xl bg-white/60 border border-white/60 px-3 py-2">
                    Case: <span className="font-black">{assessment.case_answer.status}</span>
                  </div>
                  <div className="rounded-xl bg-white/60 border border-white/60 px-3 py-2">
                    Video: <span className="font-black">{assessment.presentation.status}</span>
                  </div>
                </div>

                {assessmentDriveSidebar ? (
                  <div className="grid grid-cols-5 gap-2">
                    {(["D", "R", "I", "V", "E"] as const).map((letter) => {
                      const value =
                        letter === "D"
                          ? assessmentDriveSidebar.dims10.D
                          : letter === "R"
                            ? assessmentDriveSidebar.dims10.R
                            : letter === "I"
                              ? assessmentDriveSidebar.dims10.I
                              : letter === "V"
                                ? assessmentDriveSidebar.dims10.V
                                : assessmentDriveSidebar.dims10.E;
                      return (
                        <div
                          key={letter}
                          className="rounded-xl bg-white/70 border border-white/60 px-2 py-2 text-center"
                        >
                          <div className="text-[10px] font-black text-slate-900">{letter}</div>
                          <div className="text-[10px] font-bold text-slate-600">
                            {formatPercentOutOf10(value, 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="space-y-1 text-xs font-semibold text-slate-600">
                  {assessmentCandidateName ? <div>Candidate: {assessmentCandidateName}</div> : null}
                  {assessmentHiddenTalent !== null ? <div>Hidden talent: {assessmentHiddenTalent ? "yes" : "no"}</div> : null}
                  {assessmentGrowth !== null ? <div>Growth: {formatPercent01(assessmentGrowth, 0)}</div> : null}
                  {assessmentAuthenticity !== null ? <div>Authenticity: {formatPercent01(assessmentAuthenticity, 1)}</div> : null}
                  {assessmentProcessingMs !== null ? <div>Processing: {formatMs(assessmentProcessingMs)}</div> : null}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Raw result</p>
                  <button
                    type="button"
                    onClick={() => void copyRawAssessment()}
                    disabled={!rawAssessmentText}
                    className="px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-white disabled:opacity-60"
                  >
                    {rawCopied ? "Copied" : "Copy raw"}
                  </button>
                </div>
                <details className="rounded-xl bg-white/60 border border-white/60 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-black text-slate-700">Show raw assessment payload</summary>
                  <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words max-h-[240px] overflow-auto">
                    {rawAssessmentText}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                AI analysis results will be available after the technical committee concludes initial evaluation.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-[#F3F6EA] p-4">
      <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900 leading-tight">{value || "—"}</p>
    </div>
  );
}
