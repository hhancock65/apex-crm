import React, { useState } from "react";

export function LandingPage({ onSignup, onLogin }) {
  const [plan, setPlan] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: "#0C1929", fontFamily: "var(--font)", color: "#fff" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 3rem", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>
          Apex <span style={{ color: "#378ADD", fontWeight: 400 }}>CRM</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={onLogin} style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)", color: "#fff", padding: "7px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Sign in
          </button>
          <button onClick={() => onSignup("starter")} style={{ background: "#185FA5", border: "none", color: "#fff", padding: "7px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            Start free trial
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "5rem 2rem 4rem" }}>
        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#378ADD", background: "rgba(55,138,221,0.12)", border: "0.5px solid rgba(55,138,221,0.3)", padding: "4px 14px", borderRadius: 20, marginBottom: "1.5rem" }}>
          14-day free trial · No credit card required
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-1.5px", marginBottom: "1.5rem", maxWidth: 700, margin: "0 auto 1.5rem" }}>
          The CRM that gets<br/>out of your way
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 2.5rem" }}>
          Simple, fast, and built for small teams who want to close deals — not manage software.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={() => onSignup("pro")} style={{ background: "#185FA5", border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Start free trial →
          </button>
          <button onClick={onLogin} style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "12px 28px", borderRadius: 10, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            Sign in
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, borderTop: "0.5px solid rgba(255,255,255,0.08)", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
        {[
          { icon: "👥", title: "Contact management", desc: "Keep every client relationship organized in one place with custom statuses and notes." },
          { icon: "📊", title: "Visual pipeline", desc: "Drag and drop deals through your sales stages. See your win rate at a glance." },
          { icon: "✅", title: "Tasks & follow-ups", desc: "Never miss a follow-up. Set due dates and get your team aligned on next steps." },
          { icon: "📝", title: "Activity log", desc: "Log calls, emails, and meetings. Full history of every client interaction." },
          { icon: "👥", title: "Team collaboration", desc: "Invite your team, assign roles, and work on the same data in real time." },
          { icon: "🔒", title: "Secure by default", desc: "Your data is isolated, encrypted, and protected. Each company gets their own space." },
        ].map(f => (
          <div key={f.title} style={{ padding: "2rem 2.5rem", borderRight: "0.5px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div style={{ padding: "5rem 2rem", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 12 }}>Simple, honest pricing</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>Start free for 14 days. No credit card required.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Starter */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "2rem" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Starter</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1px" }}>$29</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>/month</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>Per company · billed monthly</div>
            <button onClick={() => onSignup("starter")} style={{ width: "100%", padding: "10px", background: "transparent", border: "0.5px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginBottom: "1.5rem" }}>
              Start free trial
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Up to 2 team members", "500 contacts", "Unlimited deals & tasks", "Pipeline & activity log", "Email support"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#639922" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div style={{ background: "rgba(24,95,165,0.15)", border: "1.5px solid #185FA5", borderRadius: 14, padding: "2rem", position: "relative" }}>
            <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#185FA5", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 14px", borderRadius: 20 }}>Most popular</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Pro</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1px" }}>$99</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>/month</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: "1.5rem" }}>Per company · billed monthly</div>
            <button onClick={() => onSignup("pro")} style={{ width: "100%", padding: "10px", background: "#185FA5", border: "none", color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "1.5rem" }}>
              Start free trial
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Unlimited team members", "Unlimited contacts", "CSV import & export", "Pipeline & activity log", "Priority support", "Early access to new features"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#378ADD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", padding: "2rem 3rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Apex <span style={{ color: "#378ADD", fontWeight: 400 }}>CRM</span></div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2026 Apex CRM. All rights reserved.</div>
      </div>
    </div>
  );
}
