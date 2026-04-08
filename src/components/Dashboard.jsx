import React from "react";
import { OnboardingChecklist } from "./Onboarding";
import { Avatar, Badge, Card, SectionTitle, EmptyState } from "./UI";

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 10, padding: "1rem", border: "0.5px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || "var(--text)", letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const STAGES = ["Lead", "Qualified", "Proposal", "Won"];
const STAGE_COLORS = { Lead: "#EF9F27", Qualified: "#378ADD", Proposal: "#7F77DD", Won: "#639922" };

export function Dashboard({ contacts, deals, tasks, stats, onNavigate }) {
  const recentContacts = contacts.slice(0, 4);
  const pendingTasks = tasks.filter(t => !t.done).slice(0, 4);

  // Pipeline funnel data
  const stageData = STAGES.map(s => ({
    stage: s,
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((a, d) => a + (Number(d.value) || 0), 0),
  }));
  const maxCount = Math.max(...stageData.map(s => s.count), 1);

  return (
    <div>
      <OnboardingChecklist stats={stats} onNavigate={onNavigate} />
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: "1.5rem" }}>
        <StatCard label="Total contacts" value={stats.totalContacts} sub="in CRM" />
        <StatCard label="Open deals" value={stats.openDeals} sub="in pipeline" />
        <StatCard label="Pipeline value" value={"$" + stats.pipelineValue.toLocaleString()} sub="total" />
        <StatCard label="Win rate" value={stats.winRate + "%"} sub={`${stats.wonDeals} won`} color={stats.winRate >= 50 ? "#3B6D11" : "var(--text)"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        {/* Pipeline funnel */}
        <div>
          <SectionTitle>Pipeline funnel</SectionTitle>
          <Card>
            {stageData.every(s => s.count === 0)
              ? <EmptyState message="No deals yet." />
              : stageData.map(s => (
                <div key={s.stage} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.stage}</span>
                    <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{s.count} · ${s.value.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(s.count / maxCount) * 100}%`, background: STAGE_COLORS[s.stage], borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
              ))
            }
            <div style={{ borderTop: "0.5px solid var(--border)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Overall win rate</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: stats.winRate >= 50 ? "#3B6D11" : "var(--text)" }}>{stats.winRate}%</span>
            </div>
          </Card>
        </div>

        {/* Upcoming tasks */}
        <div>
          <SectionTitle>Upcoming tasks</SectionTitle>
          <Card>
            {pendingTasks.length === 0
              ? <EmptyState message="All tasks complete!" />
              : pendingTasks.map((t, i) => (
                <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderBottom: i < pendingTasks.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, marginTop: 1, flexShrink: 0, border: "0.5px solid var(--border-strong)" }} />
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>{t.title}</div>
                    {t.due && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Due {t.due}</div>}
                  </div>
                </div>
              ))
            }
          </Card>
        </div>
      </div>

      {/* Recent contacts */}
      <div>
        <SectionTitle>Recent contacts</SectionTitle>
        <Card>
          {recentContacts.length === 0
            ? <EmptyState message="No contacts yet. Add your first one!" />
            : recentContacts.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recentContacts.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                <Avatar name={c.name} index={i} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.company}</div>
                </div>
                <Badge label={c.status} />
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}
