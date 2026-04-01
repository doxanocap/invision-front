"use client";

export type StatusVariant = "complete" | "incomplete" | "flagged" | "review" | "pass" | "fail";

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
}

const variantStyles: Record<
  StatusVariant,
  { bg: string; color: string; dot: string }
> = {
  complete: {
    bg: "rgba(0, 200, 83, 0.12)",
    color: "#00C853",
    dot: "#00C853",
  },
  incomplete: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#F59E0B",
    dot: "#F59E0B",
  },
  flagged: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#EF4444",
    dot: "#EF4444",
  },
  review: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#F59E0B",
    dot: "#F59E0B",
  },
  pass: {
    bg: "rgba(0, 200, 83, 0.12)",
    color: "#00C853",
    dot: "#00C853",
  },
  fail: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#EF4444",
    dot: "#EF4444",
  },
};

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const s = variantStyles[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
