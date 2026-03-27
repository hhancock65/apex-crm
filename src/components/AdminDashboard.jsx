import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const PLAN_COLORS = {
  trial:     { bg: "#FAEEDA", color: "#854F0B" },
  starter:   { bg: "#E6F1FB", color: "#185FA5" },
  pro:       { bg: "#EAF3DE", color: "#3B6D11" },
  cancelled: { bg: "#FCEBEB", color: "#A32D2D" },
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, padding: "1rem", border: "0.5px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "var(--text)", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function AdminDashboard({ currentUser, onBack }) {
  const [orgs, setOrgs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select(`
        id, name, slug, plan, trial_ends_at,
        stripe_customer_id, seats_limit, contacts_limit, created_at,
        profiles (id, username, name, real_email, role)
      `)
      .order("created_at", { ascending: false });
    setOrgs(data || []);
    setLoading(false);
  }

  async function updatePlan(orgId, plan) {
    await supabase.from("organizations").update({
      plan,
      seats_limit:    plan === "pro" ? -1 : plan === "starter" ? 2 : 2,
      contacts_limit: plan === "pro" ? -1 : plan === "starter" ? 500 : 500,
    }).eq("id", orgId);
    fetchOrgs();
  }

  async function extendTrial(orgId) {
    const newEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("organizations").update({ trial_ends_at: newEnd }).eq("id", orgId);
    fetchOrgs();
  }

  const filtered = orgs.filter(o => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.profiles?.some(p => p.real_email?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === "all" || o.plan === filter;
    return matchSearch && matchFilter;
  });

  // MRR calculation
  const mrr = orgs.reduce((total, o) => {
    if (o.plan === "starter") return total + 29;
    if (o.plan === "pro")     return total + 99;
    return total;
  }, 0);

  const trialCount   = orgs.filter(o => o.plan === "trial").length;
  const paidCount    = orgs.filter(o => o.plan === "starter" || o.plan === "pro").length;
  const cancelCount  = orgs.filter(o => o.plan === "cancelled").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Topbar */}
      <div style={{ background: "var(--card-bg)", borderBottom: "0.5px solid var(--border)", padding: "0 2rem", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span></div>
          <div style={{ fontSize: 11, fontWeight: 600, background: "#FCEBEB", color: "#A32D2D", padding: "2px 8px", borderRadius: 6 }}>Admin</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Customer Dashboard</div>
        </div>
        <button onClick={onBack} style={{ fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          ← Back to CRM
        </button>
      </div>

      <div style={{ padding: "1.5rem 2rem" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: "1.5rem" }}>
          <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} sub="monthly recurring" color="#3B6D11" />
          <StatCard label="Total orgs" value={orgs.length} sub="all time" />
          <StatCard label="Active trials" value={trialCount} sub="converting" />
          <StatCard label="Paying" value={paidCount} sub="customers" color="#185FA5" />
          <StatCard label="Cancelled" value={cancelCount} sub="churned" color={cancelCount > 0 ? "#A32D2D" : undefined} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by company or email..."
            style={{ padding: "7px 12px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: 260 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "trial", "starter", "pro", "cancelled"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, border: "0.5px solid var(--border-strong)", background: filter === f ? "var(--accent)" : "var(--card-bg)", color: filter === f ? "#fff" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                {f}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{filtered.length} org{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1.5fr", gap: 0, padding: "10px 16px", borderBottom: "0.5px solid var(--border)", background: "var(--surface)" }}>
            {["Company", "Plan", "Admin", "Members", "Joined", "Actions"].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
            ))}
          </div>

          {loading
            ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
            : filtered.length === 0
              ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No organizations found.</div>
              : filtered.map((org, i) => {
                  const admin = org.profiles?.find(p => p.role === "Admin") || org.profiles?.[0];
                  const pc = PLAN_COLORS[org.plan] || PLAN_COLORS.trial;
                  const daysLeft = org.plan === "trial"
                    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null;

                  return (
                    <div key={org.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1.5fr", gap: 0, padding: "12px 16px", borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none", alignItems: "center" }}>
                      {/* Company */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{org.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>/{org.slug}</div>
                      </div>

                      {/* Plan */}
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, padding: "2px 9px", borderRadius: 20, textTransform: "capitalize" }}>
                          {org.plan}
                        </span>
                        {daysLeft !== null && (
                          <div style={{ fontSize: 10, color: daysLeft <= 3 ? "#A32D2D" : "var(--text-muted)", marginTop: 3 }}>
                            {daysLeft}d left
                          </div>
                        )}
                      </div>

                      {/* Admin */}
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text)" }}>{admin?.name || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin?.real_email || `@${admin?.username}` || "—"}</div>
                      </div>

                      {/* Members */}
                      <div style={{ fontSize: 13, color: "var(--text)" }}>{org.profiles?.length || 0}</div>

                      {/* Joined */}
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {org.plan === "trial" && (
                          <button onClick={() => extendTrial(org.id)} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 5, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
                            +14d
                          </button>
                        )}
                        {org.plan !== "pro" && org.plan !== "cancelled" && (
                          <button onClick={() => updatePlan(org.id, "pro")} style={{ fontSize: 11, padding: "3px 8px", background: "#185FA5", border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                            → Pro
                          </button>
                        )}
                        {org.plan !== "starter" && org.plan !== "cancelled" && (
                          <button onClick={() => updatePlan(org.id, "starter")} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 5, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
                            → Starter
                          </button>
                        )}
                        {org.plan !== "cancelled" && (
                          <button onClick={() => { if(window.confirm("Cancel this org?")) updatePlan(org.id, "cancelled"); }} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "0.5px solid #F09595", borderRadius: 5, color: "#A32D2D", cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                          </button>
                        )}
                        {org.plan === "cancelled" && (
                          <button onClick={() => updatePlan(org.id, "trial")} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 5, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </div>
    </div>
  );
}
