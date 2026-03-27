import React from "react";

export function TrialBanner({ daysLeft, plan, onUpgrade }) {
  if (plan !== "trial") return null;

  const urgent = daysLeft <= 3;
  const bg     = urgent ? "#FCEBEB" : "#FAEEDA";
  const border = urgent ? "#F09595" : "#EF9F27";
  const color  = urgent ? "#A32D2D" : "#854F0B";

  return (
    <div style={{ background: bg, borderBottom: `0.5px solid ${border}`, padding: "8px 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ fontSize: 13, color, fontWeight: 500 }}>
        {urgent
          ? `⚠️ Your trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Upgrade to keep your data.`
          : `🎉 You have ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your free trial.`
        }
      </div>
      <button onClick={onUpgrade} style={{ fontSize: 12, fontWeight: 600, color, background: "transparent", border: `0.5px solid ${color}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
        Upgrade now →
      </button>
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
          Your 14-day free trial is over. Upgrade to a paid plan to continue using Apex CRM and keep all your data.
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
