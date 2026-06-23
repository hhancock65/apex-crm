import React, { useState } from "react";

export function SignupPage({ onSignup, onLogin, error, loading, defaultPlan = "pro" }) {
  const [plan, setPlan] = useState(defaultPlan);
  const [form, setForm] = useState({ name: "", username: "", orgName: "", password: "", confirm: "" });
  const [localError, setLocalError] = useState("");

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    if (form.password !== form.confirm) { setLocalError("Passwords do not match."); return; }
    if (form.password.length < 8) { setLocalError("Password must be at least 8 characters."); return; }
    if (!/^[a-z0-9._-]{3,30}$/.test(form.username.toLowerCase())) { setLocalError("Username: 3–30 chars, letters/numbers/dots/dashes only."); return; }
    onSignup({ ...form, username: form.username.toLowerCase(), plan });
  }

  const displayError = localError || error;

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Left panel */}
      <div style={{ width: 420, background: "#0C1929", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "3rem 2.5rem", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
          Apex <span style={{ color: "#378ADD", fontWeight: 400 }}>CRM</span>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.3, letterSpacing: "-0.5px", marginBottom: "1.5rem" }}>
            14 days free.<br/>No credit card.
          </div>
          {/* Plan selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { id: "starter", label: "Starter", price: "$29/mo", desc: "2 users · 500 contacts" },
              { id: "pro", label: "Pro", price: "$99/mo", desc: "Unlimited everything" },
            ].map(p => (
              <button key={p.id} onClick={() => setPlan(p.id)} style={{
                background: plan === p.id ? "rgba(24,95,165,0.3)" : "rgba(255,255,255,0.04)",
                border: plan === p.id ? "1.5px solid #185FA5" : "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{p.desc}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: plan === p.id ? "#378ADD" : "rgba(255,255,255,0.5)" }}>{p.price}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 12, lineHeight: 1.6 }}>
            You won't be charged until your 14-day trial ends. Cancel anytime.
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>© 2026 Apex CRM</div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: "1.75rem" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.4px", marginBottom: 6 }}>Create your account</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Set up your team's CRM in under a minute.</div>
          </div>

          <form onSubmit={handleSubmit}>
            {[
              { label: "Your full name", key: "name", placeholder: "e.g. Sarah Mitchell", type: "text" },
              { label: "Username", key: "username", placeholder: "e.g. sarah (used to sign in)", type: "text" },
              { label: "Company name", key: "orgName", placeholder: "e.g. Acme Corp", type: "text" },
              { label: "Password", key: "password", placeholder: "Min. 8 characters", type: "password" },
              { label: "Confirm password", key: "confirm", placeholder: "Repeat password", type: "password" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>{field.label}</label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={set(field.key)}
                  placeholder={field.placeholder}
                  required
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 9, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
                />
              </div>
            ))}

            {displayError && (
              <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginBottom: 12 }}>
                {displayError}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, fontSize: 13, fontWeight: 600, background: loading ? "#7aA8CC" : "#185FA5", color: "#fff", border: "none", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4 }}>
              {loading ? "Creating account..." : `Start ${plan === "pro" ? "Pro" : "Starter"} trial →`}
            </button>
          </form>

          <div style={{ marginTop: "1.25rem", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <button onClick={onLogin} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}
