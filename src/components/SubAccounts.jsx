import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input } from "./Modal";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}

export function SubAccounts({ org, currentUser, onSwitch, onUpgrade }) {
  const [subAccounts, setSubAccounts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [createOpen, setCreateOpen]   = useState(false);
  const [name, setName]               = useState("");
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState("");

  const limit       = org?.sub_account_limit ?? 0;
  const usedCount    = subAccounts.length;
  const isUnlimited = limit === -1;
  const atLimit      = !isUnlimited && usedCount >= limit;
  const noAccess     = limit === 0;

  async function fetchSubAccounts() {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id, name, created_at, plan")
      .eq("parent_org_id", org?.id)
      .order("created_at", { ascending: false });
    setSubAccounts(data || []);
    setLoading(false);
  }

  useEffect(() => { if (org?.id) fetchSubAccounts(); }, [org?.id]);

  async function createSubAccount() {
    setError(""); setCreating(true);
    if (!name.trim()) { setError("Please enter a name."); setCreating(false); return; }

    const { data, error: rpcError } = await supabase.rpc("create_sub_account", {
      p_parent_org_id: org.id,
      p_name:          name.trim(),
      p_creator_id:    currentUser.id,
    });

    if (rpcError) {
      setError(rpcError.message.replace(/^.*:\s*/, "")); // strip Postgres prefix
      setCreating(false);
      return;
    }

    setCreating(false);
    setCreateOpen(false);
    setName("");
    await fetchSubAccounts();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>
          Sub-accounts ({usedCount}{isUnlimited ? "" : ` / ${limit}`})
        </SectionTitle>
        <button
          className="btn btn-primary"
          onClick={() => setCreateOpen(true)}
          disabled={atLimit || noAccess}
          title={noAccess ? "Upgrade to Starter or Pro to use sub-accounts" : atLimit ? "Sub-account limit reached" : ""}
          style={{ opacity: (atLimit || noAccess) ? 0.5 : 1, cursor: (atLimit || noAccess) ? "not-allowed" : "pointer" }}
        >
          + New sub-account
        </button>
      </div>

      {noAccess && (
        <div style={{ background: "#E6F1FB", border: "0.5px solid #B5D4F4", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>Sub-accounts let you manage separate clients from one login. Available on Starter (5 sub-accounts) and Pro (unlimited).</span>
          <button onClick={onUpgrade} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#fff", background: "#185FA5", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            Upgrade →
          </button>
        </div>
      )}

      {!noAccess && atLimit && (
        <div style={{ background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#854F0B", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>You've reached your {limit}-sub-account limit on the {org?.plan} plan.</span>
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
                <button
                  onClick={() => onSwitch(s.id)}
                  style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "var(--surface)", border: "0.5px solid var(--border-strong)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                >
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
