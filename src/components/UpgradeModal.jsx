import React, { useState } from "react";
import { startCheckout, openBillingPortal } from "../lib/stripe";

export function UpgradeModal({ isOpen, onClose, org, user }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleUpgrade(plan) {
    setError(""); setLoading(plan);
    try {
      await startCheckout({
        plan,
        orgId:   org?.id,
        orgName: org?.name,
        email:   user?.email,
      });
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  }

  async function handlePortal() {
    if (!org?.stripe_customer_id) return;
    setLoading("portal");
    try { await openBillingPortal(org.stripe_customer_id); }
    catch (err) { setError(err.message); setLoading(null); }
  }

  const isOnPlan = p => org?.plan === p;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 16, padding: "2rem", width: 520, maxWidth: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>Choose your plan</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20 }}>×</button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
          {[
            { id: "starter", label: "Starter", price: "$29", desc: "per month", features: ["2 team members", "500 contacts", "All core features", "Email support"] },
            { id: "pro",     label: "Pro",     price: "$99", desc: "per month", features: ["Unlimited members", "Unlimited contacts", "CSV import/export", "Priority support"], popular: true },
          ].map(plan => (
            <div key={plan.id} style={{ background: plan.popular ? "rgba(24,95,165,0.06)" : "var(--surface)", border: plan.popular ? "1.5px solid #185FA5" : "0.5px solid var(--border)", borderRadius: 12, padding: "1.25rem", position: "relative" }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#185FA5", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Most popular</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{plan.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 12 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.8px" }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{plan.desc}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke="#639922" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>
              <button
                disabled={loading === plan.id || isOnPlan(plan.id)}
                onClick={() => handleUpgrade(plan.id)}
                style={{ width: "100%", padding: "8px", fontSize: 13, fontWeight: 500, background: isOnPlan(plan.id) ? "var(--surface)" : plan.popular ? "#185FA5" : "transparent", color: isOnPlan(plan.id) ? "var(--text-muted)" : plan.popular ? "#fff" : "var(--text)", border: plan.popular ? "none" : "0.5px solid var(--border-strong)", borderRadius: 8, cursor: isOnPlan(plan.id) ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {loading === plan.id ? "Redirecting..." : isOnPlan(plan.id) ? "Current plan" : `Upgrade to ${plan.label} →`}
              </button>
            </div>
          ))}
        </div>

        {/* Manage billing link for paying customers */}
        {org?.stripe_customer_id && (
          <div style={{ textAlign: "center" }}>
            <button onClick={handlePortal} disabled={loading === "portal"} style={{ background: "none", border: "none", fontSize: 13, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>
              {loading === "portal" ? "Opening..." : "Manage billing & invoices →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
