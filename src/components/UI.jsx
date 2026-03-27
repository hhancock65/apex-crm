import React from "react";

const AVATAR_COLORS = [
  { bg: "#E6F1FB", color: "#185FA5" },
  { bg: "#EAF3DE", color: "#3B6D11" },
  { bg: "#FAEEDA", color: "#854F0B" },
  { bg: "#FBEAF0", color: "#993556" },
  { bg: "#EEEDFE", color: "#534AB7" },
];

export function Avatar({ name, index = 0, size = 36 }) {
  const c = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: c.bg, color: c.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 500, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export const STATUS_BADGE = {
  Lead: { bg: "#FAEEDA", color: "#854F0B" },
  Qualified: { bg: "#E6F1FB", color: "#185FA5" },
  Proposal: { bg: "#EEEDFE", color: "#534AB7" },
  Won: { bg: "#EAF3DE", color: "#3B6D11" },
  Lost: { bg: "#FCEBEB", color: "#A32D2D" },
};

export function Badge({ label }) {
  const s = STATUS_BADGE[label] || STATUS_BADGE["Qualified"];
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "0.5px solid var(--border)",
      borderRadius: 12,
      padding: "1rem 1.25rem",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
      textTransform: "uppercase", color: "var(--text-muted)",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ borderTop: "0.5px solid var(--border)", margin: "0" }} />;
}

export function EmptyState({ message }) {
  return (
    <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "1rem 0" }}>
      {message}
    </div>
  );
}

export function IconBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none", border: "none", cursor: "pointer",
      color: "var(--text-muted)", padding: 4, borderRadius: 6,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
      onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
    >
      {children}
    </button>
  );
}
