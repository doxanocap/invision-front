"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ApplicationSummary, ApplicationFile, DecisionStatus } from "@/types/api";
import { StatusBadge } from "./StatusBadge";

interface ApplicationsTableProps {
  rows: ApplicationSummary[];
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0 border border-slate-200">
      {initials || "?"}
    </div>
  );
}

function PriorityBadge({ status }: { status?: DecisionStatus }) {
  if (status === "shortlisted") return <span className="bg-red-100 text-red-700 font-medium px-2.5 py-0.5 rounded-full text-xs">High</span>;
  if (status === "discussion") return <span className="bg-orange-100 text-orange-700 font-medium px-2.5 py-0.5 rounded-full text-xs">Medium</span>;
  if (status === "rejected") return <span className="bg-slate-100 text-slate-600 font-medium px-2.5 py-0.5 rounded-full text-xs">Low</span>;
  return <span className="bg-slate-50 text-slate-500 font-medium px-2.5 py-0.5 rounded-full text-xs">Unassigned</span>;
}

function AiScore({ score }: { score?: number | null }) {
  if (score === null || score === undefined) return <span className="text-slate-300 font-medium">--</span>;
  let color = "text-red-500";
  if (score >= 80) color = "text-[#84CC16]";
  else if (score >= 60) color = "text-amber-500";
  return (
    <span className={`font-bold text-sm ${color}`}>
      {score}<span className="text-slate-400 font-medium text-xs">/100</span>
    </span>
  );
}

function MotivationScore({ val }: { val?: number | null }) {
  if (val === null || val === undefined) return <span className="text-slate-300 font-medium">--</span>;
  return (
    <span className="font-bold text-sm text-slate-700">
      {val.toFixed(1)}<span className="text-slate-400 font-medium text-xs">/5.0</span>
    </span>
  );
}

function DocStatus() {
  const Badge = ({ text, type }: { text: string; type: "complete" | "warning" | "partial" }) => {
    let colorClass = "text-orange-500";
    let icon = (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );

    if (type === "complete") {
      colorClass = "text-green-600";
      icon = (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    } else if (type === "partial") {
      colorClass = "text-amber-500";
      icon = (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      );
    }

    return (
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${colorClass}`}>
        {icon} <span>{text}</span>
      </div>
    );
  };

  return <Badge text="No Documents" type="warning" />;
}

export function ApplicationsTable({ rows }: ApplicationsTableProps) {
  // Sort rows to bring newest to top based on submitted_at, or just ID if missing
  const recentFirst = useMemo(() => {
    return [...rows].sort((a, b) => b.id - a.id);
  }, [rows]);

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-500 uppercase font-bold tracking-wider">
            <th className="py-3 px-5 whitespace-nowrap">Candidate Name</th>
            <th className="py-3 px-5 whitespace-nowrap">Status</th>
            <th className="py-3 px-5 text-center whitespace-nowrap">AI Score</th>
            <th className="py-3 px-5 text-center whitespace-nowrap">Motivation</th>
            <th className="py-3 px-5 whitespace-nowrap">Priority</th>
            <th className="py-3 px-5 whitespace-nowrap">Document Status</th>
            <th className="py-3 px-5 whitespace-nowrap">Date</th>
            <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {recentFirst.map((row) => {
            const rowHref = `/candidates/${row.id}`;
            const dateStr = row.submitted_at
              ? new Date(row.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "N/A";
            const displayName = row.full_name || `${row.first_name} ${row.last_name}`;
            const idCode = `INV-${String(row.id).padStart(5, "0")}`;

            return (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors group">
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName} />
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {displayName}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {idCode}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-5">
                  <StatusBadge pipeline_stage={row.pipeline_stage} decision_status={row.decision_status} form_status={row.form_status} />
                </td>
                <td className="py-3 px-5 text-center">
                  <AiScore score={row.drive_score} />
                </td>
                <td className="py-3 px-5 text-center">
                  <MotivationScore val={row.drive_total_strong} />
                </td>
                <td className="py-3 px-5">
                  <PriorityBadge status={row.decision_status} />
                </td>
                <td className="py-3 px-5">
                  {/* DocStatus from files requires Detail type, in Summary we skip it or show partial */}
                  <DocStatus />
                </td>
                <td className="py-3 px-5 text-sm text-slate-500 whitespace-nowrap">
                  {dateStr}
                </td>
                <td className="py-3 px-5">
                  <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 transition-colors shadow-sm">
                      Send
                    </button>
                    <Link
                      href={rowHref}
                      className="px-3.5 py-1.5 text-xs font-bold bg-[#84CC16] text-white rounded-full hover:bg-[#72b513] transition-colors shadow-sm whitespace-nowrap block"
                    >
                      Open Profile
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
