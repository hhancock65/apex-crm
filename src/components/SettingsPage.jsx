import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { startCheckout, openBillingPortal } from "../lib/stripe";
import { LANGUAGES } from "../lib/i18n";

const PLAN_COLORS = {
  trial:     { bg: "#FAEEDA", color: "#854F0B" },
  starter:   { bg: "#E6F1FB", color: "#185FA5" },
  pro:       { bg: "#EAF3DE", color: "#3B6D11" },
  cancelled: { bg: "#FCEBEB", color: "#A32D2D" },
};

function Section({ title, children }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: "1rem", paddingBottom: "0.75rem", borderBottom: "0.5px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 16, marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", disabled }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 8, background: disabled ? "var(--surface)" : "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
    />
  );
}

export function SettingsPage({ user, org, trialDaysLeft, language, onLanguageChange, onUpdateProfile }) {
  const [tab, setTab]               = useState("profile");
  const [name, setName]             = useState(user?.name || "");
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwMsg, setPwMsg]           = useState("");
  const [pwLoading, setPwLoading]   = useState(false);
  const [billingLoading, setBillingLoading] = useState(null);
  const [annual, setAnnual]         = useState(false);

  const planColor = PLAN_COLORS[org?.plan] || PLAN_COLORS.trial;

  async function saveProfile() {
    setSaving(true); setSaveMsg("");
    const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
    setSaving(false);
    setSaveMsg(error ? "Failed to save." : "Saved!");
    if (!error && onUpdateProfile) onUpdateProfile({ name });
    setTimeout(() => setSaveMsg(""), 3000);
  }

  async function changePassword() {
    setPwMsg(""); setPwLoading(true);
    if (newPw !== confirmPw) { setPwMsg("Passwords do not match."); setPwLoading(false); return; }
    if (newPw.length < 8)    { setPwMsg("Password must be at least 8 characters."); setPwLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    setPwMsg(error ? error.message : "Password updated successfully!");
    if (!error) { setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    setTimeout(() => setPwMsg(""), 4000);
  }

  async function handleUpgrade(plan) {
    setBillingLoading(plan);
    try {
      await startCheckout({ plan, annual, orgId: org?.id, orgName: org?.name, email: user?.email });
    } catch (err) { console.error(err); }
    setBillingLoading(null);
  }

  async function handlePortal() {
    if (!org?.stripe_customer_id) return;
    setBillingLoading("portal");
    try { await openBillingPortal(org.stripe_customer_id); }
    catch (err) { console.error(err); }
    setBillingLoading(null);
  }

  const TABS = [
    { id: "profile",  label: "Profile" },
    { id: "billing",  label: "Billing" },
    { id: "language", label: "Language" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", borderBottom: "0.5px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? "var(--text)" : "var(--text-muted)",
            background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
            cursor: "pointer", fontFamily: "inherit", marginBottom: -1, transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <>
          <Section title="Account information">
            <Field label="Display name">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </Field>
            <Field label="Username">
              <Input value={user?.username || ""} disabled placeholder="username" />
            </Field>
            <Field label="Email">
              <Input value={user?.email || ""} disabled placeholder="your@email.com" />
            </Field>
            <Field label="Role">
              <Input value={user?.role || ""} disabled />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button onClick={saveProfile} disabled={saving} style={{ padding: "7px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saveMsg && <span style={{ fontSize: 12, color: saveMsg.includes("Failed") ? "#A32D2D" : "#3B6D11" }}>{saveMsg}</span>}
            </div>
          </Section>

          <Section title="Change password">
            <Field label="New password">
              <Input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="Min. 8 characters" />
            </Field>
            <Field label="Confirm password">
              <Input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" placeholder="Repeat new password" />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button onClick={changePassword} disabled={pwLoading || !newPw} style={{ padding: "7px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: !newPw ? 0.5 : 1 }}>
                {pwLoading ? "Updating..." : "Update password"}
              </button>
              {pwMsg && <span style={{ fontSize: 12, color: pwMsg.includes("success") ? "#3B6D11" : "#A32D2D" }}>{pwMsg}</span>}
            </div>
          </Section>

          {org && (
            <Section title="Organization">
              <Field label="Company name"><Input value={org.name || ""} disabled /></Field>
              <Field label="Plan">
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, background: planColor.bg, color: planColor.color, padding: "3px 10px", borderRadius: 20, textTransform: "capitalize" }}>{org.plan}</span>
                  {org.plan === "trial" && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{trialDaysLeft} days remaining</span>}
                </div>
              </Field>
            </Section>
          )}
        </>
      )}

      {/* Billing tab */}
      {tab === "billing" && (
        <>
          <Section title="Current plan">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", textTransform: "capitalize" }}>{org?.plan || "Trial"}</div>
                {org?.plan === "trial" && (
                  <div style={{ fontSize: 13, color: trialDaysLeft <= 3 ? "#A32D2D" : "var(--text-muted)", marginTop: 4 }}>
                    {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining in your free trial
                  </div>
                )}
                {org?.plan === "starter" && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>$29/month · 2 users · 500 contacts</div>}
                {org?.plan === "pro"     && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>$99/month · Unlimited everything</div>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, background: planColor.bg, color: planColor.color, padding: "4px 14px", borderRadius: 20, textTransform: "capitalize" }}>{org?.plan}</span>
            </div>

            {/* Manage billing for paying customers */}
            {org?.stripe_customer_id && (
              <button onClick={handlePortal} disabled={billingLoading === "portal"} style={{ fontSize: 13, color: "var(--accent)", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", display: "block" }}>
                {billingLoading === "portal" ? "Opening..." : "Manage billing & invoices →"}
              </button>
            )}
          </Section>

          {/* Upgrade options — show if not pro */}
          {org?.plan !== "pro" && (
            <Section title="Upgrade your plan">
              {/* Annual toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 13, color: annual ? "var(--text-muted)" : "var(--text)", fontWeight: annual ? 400 : 500 }}>Monthly</span>
                <button onClick={() => setAnnual(a => !a)} style={{ width: 44, height: 24, borderRadius: 12, background: annual ? "var(--accent)" : "var(--surface)", border: "0.5px solid var(--border-strong)", cursor: "pointer", position: "relative", padding: 0, transition: "background 0.2s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: annual ? 23 : 3, transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 13, color: annual ? "var(--text)" : "var(--text-muted)", fontWeight: annual ? 500 : 400 }}>
                  Annual <span style={{ fontSize: 11, background: "#EAF3DE", color: "#3B6D11", padding: "1px 7px", borderRadius: 20, marginLeft: 4 }}>2 months free</span>
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { id: "starter", label: "Starter", monthlyPrice: "$29", annualPrice: "$24", desc: "2 users · 500 contacts", features: ["All core CRM features", "2 team members", "500 contacts", "Email support"] },
                  { id: "pro",     label: "Pro",     monthlyPrice: "$99", annualPrice: "$82", desc: "Unlimited everything",  features: ["Everything in Starter", "Unlimited members", "Unlimited contacts", "CSV import/export", "Priority support"], popular: true },
                ].map(plan => {
                  const isCurrentPlan = org?.plan === plan.id;
                  const price = annual ? plan.annualPrice : plan.monthlyPrice;
                  return (
                    <div key={plan.id} style={{ background: plan.popular ? "rgba(24,95,165,0.05)" : "var(--surface)", border: plan.popular ? "1.5px solid var(--accent)" : "0.5px solid var(--border)", borderRadius: 12, padding: "1.25rem", position: "relative" }}>
                      {plan.popular && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>Most popular</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{plan.label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px" }}>{price}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/mo</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>{plan.desc}</div>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5L10 3.5" stroke="#639922" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {f}
                        </div>
                      ))}
                      <button disabled={isCurrentPlan || billingLoading === plan.id} onClick={() => handleUpgrade(plan.id)}
                        style={{ width: "100%", padding: "8px", marginTop: 12, fontSize: 13, fontWeight: 500, background: isCurrentPlan ? "var(--surface)" : plan.popular ? "var(--accent)" : "transparent", color: isCurrentPlan ? "var(--text-muted)" : plan.popular ? "#fff" : "var(--text)", border: plan.popular ? "none" : "0.5px solid var(--border-strong)", borderRadius: 8, cursor: isCurrentPlan ? "default" : "pointer", fontFamily: "inherit" }}>
                        {billingLoading === plan.id ? "Redirecting..." : isCurrentPlan ? "Current plan" : `Upgrade to ${plan.label} →`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {org?.plan === "pro" && (
            <div style={{ background: "#EAF3DE", border: "0.5px solid #97C459", borderRadius: 10, padding: "1rem 1.25rem", fontSize: 13, color: "#3B6D11" }}>
              ✓ You're on the Pro plan — all features are unlocked.
            </div>
          )}
        </>
      )}

      {/* Language tab */}
      {tab === "language" && (
        <Section title="Language preference">
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
            Choose your preferred language for the interface. This setting is saved locally on this device.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => onLanguageChange(lang.code)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: language === lang.code ? "1.5px solid var(--accent)" : "0.5px solid var(--border)", background: language === lang.code ? "rgba(24,95,165,0.06)" : "var(--card-bg)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" }}
              >
                <span style={{ fontSize: 22 }}>{lang.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{lang.label}</div>
                </div>
                {language === lang.code && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
