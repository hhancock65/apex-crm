import React, { useState } from "react";
import { ForgotPassword } from "./ForgotPassword";

export function LoginPage({ onLogin, error, loading, onSignup, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  function handleSubmit(e) { e.preventDefault(); onLogin(username, password); }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Left — branding */}
      <div style={{ width: 420, background: "#0C1929", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "3rem 2.5rem", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
          Apex <span style={{ color: "#378ADD", fontWeight: 400 }}>CRM</span>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.3, letterSpacing: "-0.5px", marginBottom: "1.5rem" }}>Your clients,<br/>organized.</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>A simple, powerful CRM for teams that care about real relationships — not endless software complexity.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[{ icon: "👥", label: "Contact management" }, { icon: "📊", label: "Deal pipeline" }, { icon: "✅", label: "Tasks & reminders" }, { icon: "📝", label: "Activity notes" }].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 14 }}>{f.icon}</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{f.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>© 2026 Apex CRM. All rights reserved.</div>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {showForgot
            ? <ForgotPassword onBack={() => setShowForgot(false)} />
            : (
              <>
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.4px", marginBottom: 6 }}>Sign in</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Enter your username and password to continue</div>
                </div>
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 5 }}>Username</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="e.g. hhancock" required autoFocus autoComplete="username" spellCheck={false}
                      style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: `0.5px solid ${error ? "#E24B4A" : "var(--border-strong)"}`, borderRadius: 9, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Password</label>
                      <button type="button" onClick={() => setShowForgot(true)} style={{ background: "none", border: "none", fontSize: 12, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Forgot password?</button>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                        style={{ width: "100%", padding: "9px 40px 9px 12px", fontSize: 13, border: `0.5px solid ${error ? "#E24B4A" : "var(--border-strong)"}`, borderRadius: 9, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
                      />
                      <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)" }}>
                        {showPw
                          ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"/><circle cx="7.5" cy="7.5" r="1.75"/><line x1="2" y1="2" x2="13" y2="13"/></svg>
                          : <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 7.5S3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5z"/><circle cx="7.5" cy="7.5" r="1.75"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  {error && (
                    <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#A32D2D" strokeWidth="1.5"><circle cx="6.5" cy="6.5" r="5.5"/><path d="M6.5 4v3M6.5 9h.01"/></svg>
                      {error}
                    </div>
                  )}
                  <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, fontSize: 13, fontWeight: 600, background: loading ? "#7aA8CC" : "#185FA5", color: "#fff", border: "none", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {loading && <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}><path d="M7 1a6 6 0 1 0 6 6" strokeLinecap="round"/></svg>}
                    {loading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
                <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No account? </span><button onClick={onSignup} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Start free trial</button>
                </div>
              </>
            )
          }
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
