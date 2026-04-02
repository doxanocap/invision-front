"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ApplicationSummary, DecisionStatus } from "@/types/api";
import { StatusBadge } from "./StatusBadge";

interface ApplicationsTableProps {
  rows: ApplicationSummary[];
}

function sortIndicator(
  field: "date" | "id",
  sortField: "date" | "id",
  sortDirection: "asc" | "desc"
) {
  if (sortField !== field) {
    return <span className="ml-1 opacity-20 group-hover:opacity-100 transition-opacity">↕</span>;
  }
  return <span className="ml-1 text-[#A7E635]">{sortDirection === "asc" ? "↑" : "↓"}</span>;
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

function DocStatus() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>Not Available</span>
    </div>
  );
}

export function ApplicationsTable({ rows }: ApplicationsTableProps) {
  const [sortField, setSortField] = useState<"date" | "id">("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: "date" | "id") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        const dateA = a.submitted_at || a.created_at;
        const dateB = b.submitted_at || b.created_at;
        comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
      } else {
        comparison = a.id - b.id;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, sortField, sortDirection]);


  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
      <table className="w-full text-left border-collapse min-w-[860px]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50 text-xs text-gray-500 uppercase font-bold tracking-wider">
            <th className="py-3 px-5 whitespace-nowrap">Candidate Name</th>
            <th className="py-3 px-5 whitespace-nowrap">Status</th>
            <th className="py-3 px-5 whitespace-nowrap">Priority</th>
            <th className="py-3 px-5 whitespace-nowrap">Document Status</th>
            <th 
              className="py-3 px-5 whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors group"
              onClick={() => handleSort("date")}
            >
              <div className="flex items-center">
                Date {sortIndicator("date", sortField, sortDirection)}
              </div>
            </th>
            <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedRows.map((row) => {
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
                    <Link
                      href={rowHref}
                      className="px-3.5 py-1.5 text-xs font-bold bg-[#A7E635] text-slate-900 rounded-full hover:brightness-95 transition-colors shadow-sm whitespace-nowrap block"
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
