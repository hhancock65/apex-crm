import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle, EmptyState } from "./UI";
import { Modal, FormGroup, Input } from "./Modal";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}

export function SubAccounts({ org, currentUser, trialDaysLeft, onSwitch, onUpgrade }) {
  const [subAccounts, setSubAccounts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState("");
  const [createOpen, setCreateOpen]   = useState(false);
  const [name, setName]               = useState("");
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState("");

  const plan        = org?.plan || "trial";
  const isTrial     = plan === "trial";
  const limit       = org?.sub_account_limit ?? 0;
  const isUnlimited = limit === -1;
  const usedCount   = subAccounts.length;
  const atLimit     = !isUnlimited && usedCount >= limit;
  const noAccess    = limit === 0; // trial or unrecognised plan

  async function fetchSubAccounts() {
    if (!org?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError("");
    const { data, error: fetchErr } = await supabase
      .from("organizations")
      .select("id, name, created_at, plan")
      .eq("parent_org_id", org.id)
      .order("created_at", { ascending: false });

    if (fetchErr) { setLoadError(fetchErr.message); setSubAccounts([]); }
    else          { setSubAccounts(data || []); }
    setLoading(false);
  }

  useEffect(() => { fetchSubAccounts(); }, [org?.id]);

  async function createSubAccount() {
    setError(""); setCreating(true);
    if (!org?.id)        { setError("Your organization hasn't finished loading yet. Please wait a moment and try again."); setCreating(false); return; }
    if (!currentUser?.id){ setError("Could not verify your account. Please refresh the page and try again."); setCreating(false); return; }
    if (!name.trim())    { setError("Please enter a name."); setCreating(false); return; }

    const { error: rpcError } = await supabase.rpc("create_sub_account", {
      p_parent_org_id: org.id,
      p_name:          name.trim(),
      p_creator_id:    currentUser.id,
    });

    if (rpcError) { setError(rpcError.message.replace(/^.*:\s*/, "")); setCreating(false); return; }

    setCreating(false);
    setCreateOpen(false);
    setName("");
    await fetchSubAccounts();
  }

  // ── Trial: not available yet ────────────────────────────────
  if (isTrial) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>Sub-accounts</SectionTitle>
        </div>

        <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#185FA5" strokeWidth="1.8">
              <rect x="2" y="2" width="7" height="7" rx="1.5"/>
              <rect x="13" y="2" width="7" height="7" rx="1.5"/>
              <rect x="2" y="13" width="7" height="7" rx="1.5"/>
              <path d="M13 16.5h7M16.5 13v7"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Sub-accounts aren't available during your trial
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "1.5rem", maxWidth: 400, margin: "0 auto 1.5rem" }}>
            Sub-accounts let you manage separate clients each with their own contacts, deals, and tasks — all from one login.
            {trialDaysLeft > 0 && (
              <><br /><br />Your trial ends in <strong style={{ color: trialDaysLeft <= 1 ? "#E24B4A" : "var(--text)" }}>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong>. Upgrade now to unlock this feature and keep your data.</>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onUpgrade} style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#185FA5", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
              Upgrade to Starter — $29/mo →
            </button>
            <button onClick={onUpgrade} style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600, background: "#8B5CF6", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
              Upgrade to Pro — $99/mo →
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            Starter: 5 sub-accounts &nbsp;·&nbsp; Pro: unlimited sub-accounts
          </div>
        </div>
      </div>
    );
  }

  // ── Paid plan but at the limit ──────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>
          Sub-accounts ({usedCount}{isUnlimited ? "" : ` / ${limit}`})
        </SectionTitle>
        <button
          className="btn btn-primary"
          onClick={() => { setError(""); setCreateOpen(true); }}
          disabled={atLimit}
          title={atLimit ? "Sub-account limit reached. Upgrade to Pro for unlimited." : ""}
          style={{ opacity: atLimit ? 0.5 : 1, cursor: atLimit ? "not-allowed" : "pointer" }}
        >
          + New sub-account
        </button>
      </div>

      {loadError && (
        <div style={{ background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#A32D2D" }}>
          Couldn't load sub-accounts: {loadError}
          <button onClick={fetchSubAccounts} style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#A32D2D", background: "transparent", border: "0.5px solid #F09595", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Retry
          </button>
        </div>
      )}

      {atLimit && (
        <div style={{ background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#854F0B", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>You've reached your {limit}-sub-account limit on the {plan} plan.</span>
          <button onClick={onUpgrade} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#854F0B", background: "transparent", border: "0.5px solid #EF9F27", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            Upgrade to Pro →
          </button>
        </div>
      )}

      <Card>
        {loading
          ? <EmptyState message="Loading sub-accounts..." />
          : subAccounts.length === 0
            ? <EmptyState message="No sub-accounts yet. Create one to manage a separate client's contacts, deals, and tasks." />
            : subAccounts.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < subAccounts.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#534AB7", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {initials(s.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Created {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <button onClick={() => onSwitch(s.id)} style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "var(--surface)", border: "0.5px solid var(--border-strong)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                  Switch to →
                </button>
              </div>
            ))
        }
      </Card>

      <Modal isOpen={createOpen} title="Create sub-account" onClose={() => { setCreateOpen(false); setError(""); }} onSave={createSubAccount} saveLabel={creating ? "Creating..." : "Create"}>
        <FormGroup label="Sub-account name *">
          <Input value={name} onChange={setName} placeholder="e.g. Acme Plumbing Co." />
        </FormGroup>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 8 }}>
          This creates a fully separate workspace with its own contacts, deals, and tasks. You'll be able to switch into it from the workspace switcher.
        </div>
        {error && (
          <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px" }}>
            {error}
          </div>
        )}
      </Modal>
    </div>
  );
}
