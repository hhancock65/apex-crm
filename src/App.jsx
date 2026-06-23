import React, { useState, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useStore } from "./hooks/useStore";
import { useAuth } from "./hooks/useAuth";
import { useOrgSwitcher } from "./hooks/useOrgSwitcher";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { Contacts } from "./components/Contacts";
import { Pipeline } from "./components/Pipeline";
import { Tasks } from "./components/Tasks";
import { Notes } from "./components/Notes";
import { Users } from "./components/Users";
import { TrialBanner, ExpiredScreen } from "./components/TrialBanner";
import { UpgradeModal } from "./components/UpgradeModal";
import { AdminDashboard } from "./components/AdminDashboard";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { SubAccounts } from "./components/SubAccounts";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
  { id: "contacts", label: "Contacts", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> },
  { id: "pipeline", label: "Pipeline", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="3" height="9" rx="0.5"/><rect x="6" y="2" width="3" height="11" rx="0.5"/><rect x="11" y="6" width="3" height="7" rx="0.5"/></svg> },
  { id: "tasks", label: "Tasks", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8l2 2 4-4"/></svg> },
  { id: "notes", label: "Notes", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9.5h4"/></svg> },
  { id: "users", label: "Team", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-5 5-5"/><circle cx="12" cy="6" r="2"/><path d="M10 13c0-2.2 1.8-4 4-4"/></svg> },
  { id: "subaccounts", label: "Sub-accounts", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><path d="M9 11.5h5M11.5 9v5"/></svg> },
];

const PAGE_TITLES = { dashboard: "Dashboard", contacts: "Contacts", pipeline: "Deal Pipeline", tasks: "Tasks", notes: "Activity Notes", users: "Team", subaccounts: "Sub-accounts" };

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
  const [view, setView]       = useState("dashboard");
  const [screen, setScreen]   = useState("landing");
  const [search, setSearch]   = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAdmin, setShowAdmin]     = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("crm_dark") === "true");

  const auth        = useAuth();
  const orgSwitcher  = useOrgSwitcher(auth.user, auth.org);
  const store        = useStore(auth.user?.id, orgSwitcher.activeOrgId || auth.user?.org_id);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("crm_dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!auth.initializing) {
      if (auth.user) setScreen("app");
    }
  }, [auth.initializing, auth.user]);

  function goSignup() { setScreen("signup"); }
  function goLogin()  { setScreen("login"); }
  function goLanding(){ setScreen("landing"); }

  if (showAdmin && auth.user) {
    return <AdminDashboard currentUser={auth.user} onBack={() => setShowAdmin(false)} />;
  }

  if (auth.initializing) return <LoadingScreen />;

  // Public screens
  if (screen === "landing" && !auth.user) return <LandingPage onSignup={goSignup} onLogin={goLogin} />;

  // Clerk Sign In (replaces old LoginPage)
  if (screen === "login" && !auth.user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div>
        <SignIn />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={goLanding} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );

  // Clerk Sign Up (replaces old SignupPage)
  if (screen === "signup" && !auth.user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div>
        <SignUp />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={goLanding} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );

  if (!auth.user) return <LandingPage onSignup={goSignup} onLogin={goLogin} />;

  // Trial expired
  if (auth.isTrialExpired) return (
    <>
      <ExpiredScreen onUpgrade={() => setShowUpgrade(true)} onLogout={auth.logout} />
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} org={auth.org} user={auth.user} />
    </>
  );

  const initials = auth.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-layout" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "var(--font)" }}>

      {orgSwitcher.isOnSubAccount && (
        <div style={{ background: "#EEEDFE", borderBottom: "0.5px solid #C9C5F5", padding: "6px 1.5rem", fontSize: 12, color: "#534AB7", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <span>Viewing sub-account: <strong>{orgSwitcher.activeOrgMeta?.name}</strong></span>
          <button onClick={orgSwitcher.switchToHome} style={{ background: "none", border: "none", color: "#534AB7", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            ← Back to home workspace
          </button>
        </div>
      )}

      <TrialBanner daysLeft={auth.trialDaysLeft} plan={auth.org?.plan} onUpgrade={() => setShowUpgrade(true)} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div className="sidebar" style={{ width: 200, minWidth: 200, background: "var(--card-bg)", borderRight: "0.5px solid var(--border)", display: "flex", flexDirection: "column", padding: "1.25rem 0" }}>
          <div className="sidebar-logo" style={{ padding: "0 1.25rem 1.75rem", fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--text)" }}>
            Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span>
          </div>

          <WorkspaceSwitcher
            accessibleOrgs={orgSwitcher.accessibleOrgs}
            activeOrgId={orgSwitcher.activeOrgId}
            activeOrgMeta={orgSwitcher.activeOrgMeta}
            onSwitch={orgSwitcher.switchOrg}
            onManageSubAccounts={() => { setView("subaccounts"); setSearch(""); }}
            isAdmin={auth.user?.role === "Admin" && !orgSwitcher.isOnSubAccount}
          />

          {NAV.filter(n => n.id !== "subaccounts" || (auth.user?.role === "Admin" && !orgSwitcher.isOnSubAccount)).map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setSearch(""); }}
              className={`nav-item${view === n.id ? " active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 1.25rem", fontSize: 13, color: view === n.id ? "var(--text)" : "var(--text-muted)", background: view === n.id ? "var(--surface)" : "transparent", border: "none", borderLeft: `2px solid ${view === n.id ? "var(--accent)" : "transparent"}`, fontWeight: view === n.id ? 500 : 400, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}
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
            {auth.org && (
              <div style={{ padding: "10px 1.25rem 4px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 1 }}>Organization</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.org.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize", marginTop: 1 }}>{auth.org.plan} plan</div>
              </div>
            )}
            <div style={{ padding: "8px 1.25rem 6px", display: "flex", alignItems: "center", gap: 9, borderTop: "0.5px solid var(--border)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.user.name || auth.user.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{auth.user.username} · {auth.user.role}</div>
              </div>
            </div>
            <button onClick={() => setDarkMode(d => !d)} style={{ width: "100%", padding: "6px 1.25rem", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {darkMode ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="3"/><path d="M7 1v1M7 12v1M1 7h1M12 7h1M3 3l.7.7M10.3 10.3l.7.7M3 11l.7-.7M10.3 3.7l.7-.7"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z"/></svg>}
              {darkMode ? "Light mode" : "Dark mode"}
            </button>
            {auth.user?.role === "Admin" && (
              <button onClick={() => setShowAdmin(true)} style={{ width: "100%", padding: "6px 1.25rem", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="5" height="5" rx="0.8"/><rect x="8" y="1" width="5" height="5" rx="0.8"/><rect x="1" y="8" width="5" height="5" rx="0.8"/><rect x="8" y="8" width="5" height="5" rx="0.8"/></svg>
                Admin panel
              </button>
            )}
            <button onClick={auth.logout} style={{ width: "100%", padding: "6px 1.25rem 12px", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
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
          <div style={{ background: "var(--card-bg)", borderBottom: "0.5px solid var(--border)", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{PAGE_TITLES[view]}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {store.loadingData && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Syncing...</span>}
              <input className="topbar-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
                style={{ padding: "6px 12px", fontSize: 13, border: "0.5px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: 200 }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            {view === "dashboard" && <Dashboard contacts={store.contacts} deals={store.deals} tasks={store.tasks} stats={store.stats} />}
            {view === "contacts"  && <Contacts contacts={store.contacts} addContact={store.addContact} updateContact={store.updateContact} deleteContact={store.deleteContact} search={search} />}
            {view === "pipeline"  && <Pipeline deals={store.deals} addDeal={store.addDeal} updateDeal={store.updateDeal} deleteDeal={store.deleteDeal} updateDealStage={store.updateDealStage} />}
            {view === "tasks"     && <Tasks tasks={store.tasks} addTask={store.addTask} updateTask={store.updateTask} toggleTask={store.toggleTask} deleteTask={store.deleteTask} />}
            {view === "notes"     && <Notes notes={store.notes} addNote={store.addNote} updateNote={store.updateNote} deleteNote={store.deleteNote} />}
            {view === "users"     && <Users users={store.users} currentUser={auth.user} updateUserProfile={store.updateUserProfile} />}
            {view === "subaccounts" && (
              <SubAccounts
                org={auth.org}
                currentUser={auth.user}
                onSwitch={(id) => { orgSwitcher.switchOrg(id); setView("dashboard"); }}
                onUpgrade={() => setShowUpgrade(true)}
              />
            )}
          </div>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} org={auth.org} user={auth.user} />
    </div>
  );
}
