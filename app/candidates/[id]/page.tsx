import Link from "next/link";
import { notFound } from "next/navigation";
import type { ApplicantDetail } from "@/types/api";
import { getApplicant } from "@/lib/api-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "24px",
        borderRadius: 16,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        marginBottom: 20,
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px 32px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          color: "var(--text-primary)",
          fontSize: 14,
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{"—"}</span>}
      </div>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            View Document ↗
          </a>
        ) : (
          <span style={{ color: "#F59E0B", fontSize: 13, fontWeight: 500 }}>
            Missing
          </span>
        )}
      </div>
    </div>
  );
}

export default async function CandidateProfilePage({ params }: PageProps) {
  const { id } = await params;

  let candidate: ApplicantDetail | null = null;
  let errorMsg: string | null = null;

  try {
    candidate = await getApplicant(id);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "NOT_FOUND") {
      notFound();
    } else {
      errorMsg = msg;
    }
  }

  if (errorMsg) {
    return (
      <div style={{ padding: 40, color: "#EF4444", textAlign: "center" }}>
        <h2>Error Loading Candidate</h2>
        <p>{errorMsg}</p>
        <Link href="/applications" style={{ color: "var(--accent)", marginTop: 20, display: "inline-block" }}>
          Go Back
        </Link>
      </div>
    );
  }

  if (!candidate) {
     return null; // or loading state, but this is a Server Component, so it suspends until resolved
  }

  const displayName = candidate.full_name || `${candidate.first_name} ${candidate.last_name}`;

  return (
    <div style={{ padding: "40px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Back link */}
      <Link
        href="/applications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-secondary)",
          textDecoration: "none",
          fontSize: 13,
          marginBottom: 28,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Applications
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          {displayName.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase()}
        </div>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            {displayName}
          </h1>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Application ID: {candidate.id} • Status: <span style={{ color: "var(--text-primary)" }}>{candidate.application_status}</span>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Personal Details */}
        <SectionCard title="Personal Details">
          <Field label="Full Name" value={displayName} />
          <Field label="Date of Birth" value={candidate.date_of_birth} />
          <Field label="Gender" value={candidate.gender} />
          <Field label="Citizenship" value={candidate.citizenship} />
          <Field label="IIN" value={candidate.iin} />
          <Field label="Mobile Phone" value={candidate.mobile_phone} />
        </SectionCard>

        {/* Address */}
        <SectionCard title="Address">
          <Field label="Country" value={candidate.address_country} />
          <Field label="Region" value={candidate.address_region} />
          <Field label="City" value={candidate.address_city} />
          <Field label="Street" value={candidate.address_street} />
          <Field label="House" value={candidate.address_house} />
          <Field label="Apartment" value={candidate.address_apartment} />
        </SectionCard>

        {/* Documents */}
        <SectionCard title="Documents">
          <DocLink label="Identity Document" url={candidate.id_document_file_url} />
          <DocLink label="English Results" url={candidate.english_results_file_url} />
          <DocLink label="Certificate" url={candidate.certificate_file_url} />
          
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
              Additional Documents
            </div>
            <div>
              {candidate.additional_documents_urls && candidate.additional_documents_urls.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text-primary)", fontSize: 14 }}>
                  {candidate.additional_documents_urls.map((url, i) => (
                    <li key={i} style={{ paddingBottom: 4 }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                        Link {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: "#F59E0B", fontSize: 13, fontWeight: 500 }}>None</span>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
