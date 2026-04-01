import Link from "next/link";

export default function DashboardStub() {
  return (
    <div style={{ padding: "80px 32px", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px dashed var(--border)",
          borderRadius: 16,
          padding: "48px 32px",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
          This page is under construction. Let's go back for now.
        </p>
        <Link
          href="/applications"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "var(--accent)",
            color: "#111",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Go to Applications
        </Link>
      </div>
    </div>
  );
}
