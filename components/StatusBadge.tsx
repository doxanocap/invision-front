"use client";

import type { PipelineStage, DecisionStatus, FormStatus } from "@/types/api";

interface StatusBadgeProps {
  pipeline_stage?: PipelineStage | null;
  decision_status?: DecisionStatus | null;
  form_status?: FormStatus | null;
}

const PIPELINE_MAP: Record<string, { label: string; textClass: string; bgClass: string; dotClass: string }> = {
  pending: { label: "Ожидание", textClass: "text-slate-600", bgClass: "bg-slate-100", dotClass: "bg-slate-400" },
  case_sent: { label: "Кейс отправлен", textClass: "text-blue-700", bgClass: "bg-blue-50", dotClass: "bg-blue-500" },
  case_answered: { label: "Кейс получен", textClass: "text-indigo-700", bgClass: "bg-indigo-50", dotClass: "bg-indigo-500" },
  committee_review: { label: "На проверке", textClass: "text-amber-700", bgClass: "bg-amber-50", dotClass: "bg-amber-500" },
  decision_sent: { label: "Решение отправлено", textClass: "text-[#84CC16]", bgClass: "bg-[#84CC16]/10", dotClass: "bg-[#84CC16]" },
};

const DECISION_MAP: Record<string, { label: string; textClass: string; bgClass: string; dotClass: string }> = {
  shortlisted: { label: "Шортлист", textClass: "text-[#84CC16]", bgClass: "bg-[#84CC16]/10", dotClass: "bg-[#84CC16]" },
  discussion: { label: "Обсуждение", textClass: "text-orange-700", bgClass: "bg-orange-50", dotClass: "bg-orange-500" },
  rejected: { label: "Отклонён", textClass: "text-red-700", bgClass: "bg-red-50", dotClass: "bg-red-500" },
};

const FORM_MAP: Record<string, { label: string; textClass: string; bgClass: string; dotClass: string }> = {
  draft: { label: "Черновик", textClass: "text-slate-500", bgClass: "bg-slate-50", dotClass: "bg-slate-300" },
  submitted: { label: "Заявка подана", textClass: "text-emerald-700", bgClass: "bg-emerald-50", dotClass: "bg-emerald-500" }
};

export function StatusBadge({ pipeline_stage, decision_status, form_status }: StatusBadgeProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {form_status && FORM_MAP[form_status] && (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${FORM_MAP[form_status].bgClass} ${FORM_MAP[form_status].textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${FORM_MAP[form_status].dotClass}`} />
          {FORM_MAP[form_status].label}
        </span>
      )}
      {pipeline_stage && PIPELINE_MAP[pipeline_stage] && (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${PIPELINE_MAP[pipeline_stage].bgClass} ${PIPELINE_MAP[pipeline_stage].textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PIPELINE_MAP[pipeline_stage].dotClass}`} />
          {PIPELINE_MAP[pipeline_stage].label}
        </span>
      )}
      {decision_status && decision_status !== "pending" && DECISION_MAP[decision_status] && (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${DECISION_MAP[decision_status].bgClass} ${DECISION_MAP[decision_status].textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DECISION_MAP[decision_status].dotClass}`} />
          {DECISION_MAP[decision_status].label}
        </span>
      )}
    </div>
  );
}
