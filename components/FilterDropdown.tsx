"use client";

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const isActive = value && value !== "all";

  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: isActive ? "var(--accent-dim)" : "var(--bg-card)",
          border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
          color: isActive ? "var(--accent)" : "var(--text-secondary)",
          borderRadius: 8,
          padding: "7px 32px 7px 12px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          minWidth: 90,
        }}
      >
        <option value="all">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: isActive ? "var(--accent)" : "var(--text-muted)",
        }}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
