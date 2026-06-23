import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export function ForgotPassword({ onBack }) {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setError("Please enter your username."); setLoading(false); return; }
    const internalEmail = `${trimmed}@apexcrm.internal`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(internalEmail, {
      redirectTo: window.location.origin + "?reset=true",
    });
    setLoading(false);
    if (err) { setError("Could not send reset email. Check your username and try again."); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#3B6D11" strokeWidth="1.8"><path d="M4 11l5 5L18 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Check your email</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          A password reset link has been sent to the email address associated with <strong>{username}</strong>. Check your inbox and follow the link to reset your password.
        </div>
        <button onClick={onBack} className="btn" style={{ fontSize: 13 }}>Back to sign in</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.4px", marginBottom: 6 }}>Reset password</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Enter your username and we'll send a reset link to your email.</div>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 5 }}>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="your username" required autoFocus
            style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 9, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
          />
        </div>
        {error && (
          <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginBottom: 14 }}>{error}</div>
        )}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, fontSize: 13, fontWeight: 600, background: loading ? "#7aA8CC" : "#185FA5", color: "#fff", border: "none", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>← Back to sign in</button>
      </div>
    </div>
  );
}
