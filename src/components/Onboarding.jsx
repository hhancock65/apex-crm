import React, { useState, useEffect } from "react";

const STEPS = [
  { id: "contact",  label: "Add your first contact",  desc: "Go to Contacts → + Add contact",  nav: "contacts" },
  { id: "deal",     label: "Create a deal",            desc: "Go to Pipeline → + Add deal",     nav: "pipeline" },
  { id: "task",     label: "Add a task",               desc: "Go to Tasks → + Add task",        nav: "tasks"    },
  { id: "note",     label: "Log an activity",          desc: "Go to Notes → + Add note",        nav: "notes"    },
  { id: "team",     label: "Invite a team member",     desc: "Go to Team → follow instructions",nav: "users"    },
];

export function OnboardingChecklist({ stats, onNavigate }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("crm_onboarding_done") === "true");
  const [open, setOpen] = useState(true);

  const completed = {
    contact: stats.totalContacts > 0,
    deal:    stats.openDeals > 0 || stats.wonDeals > 0,
    task:    stats.pendingTasks >= 0 && (stats.totalContacts > 0),
    note:    stats.totalContacts > 0,
    team:    false,
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const allDone   = doneCount >= 4;

  useEffect(() => {
    if (allDone) localStorage.setItem("crm_onboarding_done", "true");
  }, [allDone]);

  if (dismissed) return null;

  return (
    <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 14 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Get started — {doneCount}/{STEPS.length} done
          </div>
          {/* Progress bar */}
          <div style={{ width: 80, height: 5, background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(doneCount / STEPS.length) * 100}%`, background: "#185FA5", borderRadius: 3, transition: "width 0.4s" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
            {open ? "Hide" : "Show"}
          </button>
          <button onClick={() => { setDismissed(true); localStorage.setItem("crm_onboarding_done", "true"); }} style={{ background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
            Dismiss
          </button>
        </div>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {STEPS.map(step => {
            const done = completed[step.id];
            return (
              <div key={step.id} onClick={() => !done && onNavigate(step.nav)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: done ? "var(--surface)" : "transparent", cursor: done ? "default" : "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { if (!done) e.currentTarget.style.background = "var(--surface)"; }}
                onMouseLeave={e => { if (!done) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#185FA5" : "transparent", border: done ? "none" : "0.5px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {done
                    ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-strong)" }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: done ? "var(--text-muted)" : "var(--text)", textDecoration: done ? "line-through" : "none", fontWeight: done ? 400 : 500 }}>{step.label}</div>
                  {!done && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{step.desc}</div>}
                </div>
                {!done && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
