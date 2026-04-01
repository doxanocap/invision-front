"use client";

import Link from "next/link";
import type { ApplicantDetail, ApplicationStatus } from "@/types/api";
import { StatusBadge, type StatusVariant } from "./StatusBadge";

interface ApplicationsTableProps {
  rows: ApplicantDetail[];
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

  const colors = [
    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
    "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
    "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
    "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
    "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
  ];
  const idx = (name.charCodeAt(0) || 0) % colors.length;

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: colors[idx],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function DocumentStatusCell({ raw }: { raw: ApplicantDetail }) {
  let label = "All Docs Received";
  let ok = true;

  if (!raw.id_document_file_url) {
    label = "Missing Identity Doc";
    ok = false;
  } else if (!raw.english_results_file_url) {
    label = "Missing English Result";
    ok = false;
  } else if (!raw.certificate_file_url) {
    label = "Missing Certificate";
    ok = false;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      {ok ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <span
        style={{
          fontSize: 13,
          color: ok ? "var(--text-primary)" : "#F59E0B",
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const COL_STYLES: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
  color: "var(--text-primary)",
  verticalAlign: "middle",
};

const HEADER_STYLES: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-secondary)",
};

export function ApplicationsTable({ rows }: ApplicationsTableProps) {
  function getStatusDisplay(status: ApplicationStatus): { label: string; variant: StatusVariant } {
    switch (status) {
      case "new":
        return { label: "New", variant: "incomplete" };
      case "in_review":
        return { label: "In Review", variant: "review" };
      case "shortlisted":
        return { label: "Shortlisted", variant: "complete" };
      case "accepted":
        return { label: "Accepted", variant: "complete" };
      case "rejected":
        return { label: "Rejected", variant: "fail" };
      default:
        return { label: status, variant: "incomplete" };
    }
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: 220 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 160 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={HEADER_STYLES}>Candidate Name</th>
            <th style={HEADER_STYLES}>Status</th>
            <th style={{ ...HEADER_STYLES, textAlign: "center" }}>AI Score</th>
            <th style={{ ...HEADER_STYLES, textAlign: "center" }}>Motivation</th>
            <th style={HEADER_STYLES}>Priority</th>
            <th style={HEADER_STYLES}>Document Status</th>
            <th style={HEADER_STYLES}>Date</th>
            <th style={{ ...HEADER_STYLES, textAlign: "center" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const displayName = row.full_name || `${row.first_name} ${row.last_name}`;
            const idCode = `INV-${String(row.id).padStart(5, "0")}`;
            const statusDisplay = getStatusDisplay(row.application_status);
            const dateFormatted = new Date(row.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <tr
                key={row.id}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)";
                }}
              >
                {/* Candidate Name */}
                <td style={COL_STYLES}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={displayName} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 13,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {idCode}
                      </div>
                    </div>
                  </div>
                </td>

                <td style={COL_STYLES}>
                  <StatusBadge
                    variant={statusDisplay.variant}
                    label={statusDisplay.label}
                  />
                </td>

                <td style={{ ...COL_STYLES, textAlign: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                </td>

                <td style={{ ...COL_STYLES, textAlign: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                </td>

                <td style={COL_STYLES}>
                   <span style={{ color: "var(--text-muted)" }}>—</span>
                </td>

                <td style={COL_STYLES}>
                  <DocumentStatusCell raw={row} />
                </td>

                <td style={{ ...COL_STYLES, color: "var(--text-secondary)" }}>
                  {dateFormatted}
                </td>

                <td style={{ ...COL_STYLES, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                    <Link
                      href={`/candidates/${row.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 14px",
                        borderRadius: 8,
                        background: "var(--accent)",
                        color: "#0A0A0A",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        transition: "background 0.15s ease",
                      }}
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
