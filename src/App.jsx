import React, { useState, useEffect } from "react";
import { useStore } from "./hooks/useStore";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { Contacts } from "./components/Contacts";
import { Pipeline } from "./components/Pipeline";
import { Tasks } from "./components/Tasks";
import { Notes } from "./components/Notes";
import { Users } from "./components/Users";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
  { id: "contacts", label: "Contacts", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> },
  { id: "pipeline", label: "Pipeline", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="3" height="9" rx="0.5"/><rect x="6" y="2" width="3" height="11" rx="0.5"/><rect x="11" y="6" width="3" height="7" rx="0.5"/></svg> },
  { id: "tasks", label: "Tasks", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8l2 2 4-4"/></svg> },
  { id: "notes", label: "Notes", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9.5h4"/></svg> },
  { id: "users", label: "Team", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-5 5-5"/><circle cx="12" cy="6" r="2"/><path d="M10 13c0-2.2 1.8-4 4-4"/></svg> },
];

const PAGE_TITLES = { dashboard: "Dashboard", contacts: "Contacts", pipeline: "Deal Pipeline", tasks: "Tasks", notes: "Activity Notes", users: "Team" };

function LoadingScreen() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span></div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("crm_dark") === "true");
  const auth = useAuth();
  const store = useStore(auth.user?.id);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("crm_dark", darkMode);
  }, [darkMode]);

  if (auth.initializing) return <LoadingScreen />;
  if (!auth.user) return <LoginPage onLogin={auth.login} error={auth.error} loading={auth.loading} />;

  const initials = auth.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-layout" style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "var(--font)" }}>

      {/* Sidebar */}
      <div className="sidebar" style={{ width: 200, minWidth: 200, background: "var(--card-bg)", borderRight: "0.5px solid var(--border)", display: "flex", flexDirection: "column", padding: "1.25rem 0" }}>
        <div className="sidebar-logo" style={{ padding: "0 1.25rem 1.75rem", fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--text)" }}>
          Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span>
        </div>

        {NAV.map(n => (
          <button key={n.id} onClick={() => { setView(n.id); setSearch(""); }}
            className={`nav-item${view === n.id ? " active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 1.25rem", fontSize: 13, color: view === n.id ? "var(--text)" : "var(--text-muted)", background: view === n.id ? "var(--surface)" : "transparent", borderLeft: `2px solid ${view === n.id ? "var(--accent)" : "transparent"}`, border: "none", borderLeft: `2px solid ${view === n.id ? "var(--accent)" : "transparent"}`, fontWeight: view === n.id ? 500 : 400, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { if (view !== n.id) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (view !== n.id) e.currentTarget.style.background = "transparent"; }}
          >
            {n.icon}
            {n.label}
            {n.id === "tasks" && store.stats.pendingTasks > 0 && (
              <span className="nav-badge" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, background: "#185FA5", color: "#fff", padding: "1px 6px", borderRadius: 20 }}>
                {store.stats.pendingTasks}
              </span>
            )}
          </button>
        ))}

        {/* Sidebar footer */}
        <div className="sidebar-footer" style={{ marginTop: "auto", borderTop: "0.5px solid var(--border)" }}>
          <div style={{ padding: "12px 1.25rem 6px", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.user.name || auth.user.username}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{auth.user.username} · {auth.user.role}</div>
            </div>
          </div>
          {/* Dark mode toggle */}
          <button onClick={() => setDarkMode(d => !d)} style={{ width: "100%", padding: "6px 1.25rem", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {darkMode
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="3"/><path d="M7 1v1M7 12v1M1 7h1M12 7h1M3 3l.7.7M10.3 10.3l.7.7M3 11l.7-.7M10.3 3.7l.7-.7"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z"/></svg>
            }
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          {/* Sign out */}
          <button onClick={auth.logout} style={{ width: "100%", padding: "6px 1.25rem 12px", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 10l3-3-3-3M13 7H5"/></svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "var(--card-bg)", borderBottom: "0.5px solid var(--border)", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{PAGE_TITLES[view]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {store.loadingData && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Syncing...</span>}
            <input className="topbar-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
              style={{ padding: "6px 12px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: 200 }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {view === "dashboard" && <Dashboard contacts={store.contacts} deals={store.deals} tasks={store.tasks} stats={store.stats} />}
          {view === "contacts" && <Contacts contacts={store.contacts} addContact={store.addContact} updateContact={store.updateContact} deleteContact={store.deleteContact} search={search} />}
          {view === "pipeline" && <Pipeline deals={store.deals} addDeal={store.addDeal} updateDeal={store.updateDeal} deleteDeal={store.deleteDeal} updateDealStage={store.updateDealStage} />}
          {view === "tasks" && <Tasks tasks={store.tasks} addTask={store.addTask} updateTask={store.updateTask} toggleTask={store.toggleTask} deleteTask={store.deleteTask} />}
          {view === "notes" && <Notes notes={store.notes} addNote={store.addNote} updateNote={store.updateNote} deleteNote={store.deleteNote} />}
          {view === "users" && <Users users={store.users} currentUser={auth.user} updateUserProfile={store.updateUserProfile} />}
        </div>
      </div>
    </div>
  );
}
