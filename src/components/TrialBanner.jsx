import React, { useState, useEffect } from "react";

function CountdownRing({ daysLeft, totalDays = 14 }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, daysLeft / totalDays);
  const strokeDashoffset = circumference * (1 - progress);
  const color = daysLeft <= 3 ? "#E24B4A" : daysLeft <= 7 ? "#EF9F27" : "#185FA5";

  return (
    <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
        <circle cx="20" cy="20" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color }}>
        {daysLeft}
      </div>
    </div>
  );
}

export function TrialBanner({ daysLeft, plan, onUpgrade }) {
  const [dismissed, setDismissed] = useState(false);

  if (plan !== "trial" || dismissed) return null;

  const urgent  = daysLeft <= 3;
  const warning = daysLeft <= 7;
  const bg      = urgent ? "#FFF5F5" : warning ? "#FFFBF0" : "#F0F7FF";
  const border  = urgent ? "#F09595" : warning ? "#FAC775" : "#B5D4F4";
  const textColor = urgent ? "#A32D2D" : warning ? "#854F0B" : "#185FA5";

  return (
    <div style={{ background: bg, borderBottom: `0.5px solid ${border}`, padding: "8px 1.5rem", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <CountdownRing daysLeft={daysLeft} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>
          {urgent
            ? `⚠️ Only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your free trial!`
            : `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
          }
        </div>
        <div style={{ fontSize: 11, color: textColor, opacity: 0.75, marginTop: 1 }}>
          {urgent
            ? "Upgrade now to keep your data and avoid interruption."
            : "Enjoying Apex CRM? Lock in your plan before the trial ends."
          }
        </div>
      </div>
      <button onClick={onUpgrade} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: urgent ? "#E24B4A" : warning ? "#EF9F27" : "#185FA5", border: "none", borderRadius: 7, padding: "6px 16px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        {urgent ? "Upgrade now →" : "Choose a plan →"}
      </button>
      {!urgent && (
        <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", color: textColor, opacity: 0.5, cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

export function ExpiredScreen({ onUpgrade, onLogout }) {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: "2rem" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 10, letterSpacing: "-0.4px" }}>Your trial has ended</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "2rem" }}>
          Your 14-day free trial is over. Upgrade to a paid plan to continue using Apex CRM — all your data is safe and waiting.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onUpgrade} style={{ padding: "12px", fontSize: 14, fontWeight: 600, background: "#185FA5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Choose a plan →
          </button>
          <button onClick={onLogout} style={{ padding: "10px", fontSize: 13, background: "transparent", color: "var(--text-muted)", border: "0.5px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
