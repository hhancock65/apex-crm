import React, { useState, useEffect } from "react";
import { useStore } from "./hooks/useStore";
import { useAuth } from "./hooks/useAuth";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { Dashboard } from "./components/Dashboard";
import { Contacts } from "./components/Contacts";
import { Pipeline } from "./components/Pipeline";
import { Tasks } from "./components/Tasks";
import { Notes } from "./components/Notes";
import { Users } from "./components/Users";
import { TrialBanner, ExpiredScreen } from "./components/TrialBanner";
import { UpgradeModal } from "./components/UpgradeModal";
import { AdminDashboard } from "./components/AdminDashboard";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
  { id: "contacts",  label: "Contacts",  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg> },
  { id: "pipeline",  label: "Pipeline",  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="3" height="9" rx="0.5"/><rect x="6" y="2" width="3" height="11" rx="0.5"/><rect x="11" y="6" width="3" height="7" rx="0.5"/></svg> },
  { id: "tasks",     label: "Tasks",     icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8l2 2 4-4"/></svg> },
  { id: "notes",     label: "Notes",     icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9.5h4"/></svg> },
  { id: "users",     label: "Team",      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-5 5-5"/><circle cx="12" cy="6" r="2"/><path d="M10 13c0-2.2 1.8-4 4-4"/></svg> },
];

const PAGE_TITLES = {
  dashboard: "Dashboard", contacts: "Contacts", pipeline: "Deal Pipeline",
  tasks: "Tasks", notes: "Activity Notes", users: "Team",
};

function LoadingScreen() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView]               = useState("dashboard");
  const [screen, setScreen]           = useState("landing");
  const [search, setSearch]           = useState("");
  const [signupPlan, setSignupPlan]   = useState("pro");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAdmin, setShowAdmin]     = useState(false);
  const [darkMode, setDarkMode]       = useState(() => localStorage.getItem("crm_dark") === "true");

  const auth  = useAuth();
  const store = useStore(auth.user?.id, auth.user?.org_id);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("crm_dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!auth.initializing && auth.user) setScreen("app");
  }, [auth.initializing, auth.user]);

  // Detect Supabase email confirmation token or error in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      setScreen("confirming");
      setTimeout(() => {
        window.history.replaceState(null, "", window.location.pathname);
      }, 2000);
    } else if (hash && hash.includes("error=access_denied")) {
      // Link expired or already used
      setScreen("link_expired");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const [confirmEmail, setConfirmEmail] = useState("");

  async function handleSignup(formData) {
    const result = await auth.signup({ ...formData, plan: signupPlan });
    if (result === "confirm") {
      setConfirmEmail(formData.email);
    } else if (result === true) {
      setScreen("app");
    }
  }

  function goSignup(plan) { setSignupPlan(plan || "pro"); setScreen("signup"); }
  function goLogin()      { setScreen("login"); }
  function goLanding()    { setScreen("landing"); }

  // Expired or invalid confirmation link
  if (screen === "link_expired") return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: "2rem" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#A32D2D" strokeWidth="1.8"><circle cx="11" cy="11" r="9"/><path d="M11 7v4M11 15h.01"/></svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Confirmation link expired</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
          This link has expired or already been used. Confirmation links are valid for 24 hours. Please sign up again to get a new link.
        </div>
        <button onClick={() => setScreen("signup")} style={{ padding: "10px 24px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginRight: 10 }}>
          Sign up again
        </button>
        <button onClick={() => setScreen("login")} style={{ padding: "10px 24px", background: "transparent", color: "var(--text-muted)", border: "0.5px solid var(--border-strong)", borderRadius: 9, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Sign in
        </button>
      </div>
    </div>
  );

  // Loading or processing email confirmation token
  if (auth.initializing || screen === "confirming") return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFamily: "var(--font)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {screen === "confirming" ? "Confirming your account..." : "Loading..."}
        </div>
        <div style={{ width: 32, height: 32, border: "2px solid var(--border)", borderTop: "2px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Admin dashboard (full screen override)
  if (showAdmin && auth.user) {
    return <AdminDashboard currentUser={auth.user} onBack={() => setShowAdmin(false)} />;
  }

  // Public screens
  if (!auth.user) {
    if (screen === "signup")  return <SignupPage onSignup={handleSignup} onLogin={goLogin} error={auth.error} loading={auth.loading} defaultPlan={signupPlan} needsConfirmation={auth.needsConfirmation} confirmEmail={confirmEmail} />;
    if (screen === "login")   return <LoginPage  onLogin={auth.login}   error={auth.error} loading={auth.loading} onSignup={goSignup} onBack={goLanding} />;
    return <LandingPage onSignup={goSignup} onLogin={goLogin} />;
  }

  // Trial expired
  if (auth.isTrialExpired) {
    return (
      <div>
        <ExpiredScreen onUpgrade={() => setShowUpgrade(true)} onLogout={auth.logout} />
        <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} org={auth.org} user={auth.user} />
      </div>
    );
  }

  const initials = (auth.user.name || auth.user.username || "U")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "var(--font)" }}>

      {/* Trial banner */}
      <TrialBanner daysLeft={auth.trialDaysLeft} plan={auth.org?.plan} onUpgrade={() => setShowUpgrade(true)} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div className="sidebar" style={{ width: 200, minWidth: 200, background: "var(--card-bg)", borderRight: "0.5px solid var(--border)", display: "flex", flexDirection: "column", padding: "1.25rem 0" }}>
          <div className="sidebar-logo" style={{ padding: "0 1.25rem 1.75rem", fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--text)" }}>
            Apex <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>CRM</span>
          </div>

          {NAV.map(n => (
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
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Organization</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.org.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>{auth.org.plan} plan</div>
              </div>
            )}

            <div style={{ padding: "8px 1.25rem 6px", display: "flex", alignItems: "center", gap: 9, borderTop: "0.5px solid var(--border)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E6F1FB", color: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth.user.name || auth.user.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{auth.user.username} · {auth.user.role}</div>
              </div>
            </div>

            {auth.user.role === "Admin" && (
              <button onClick={() => setShowAdmin(true)} style={{ width: "100%", padding: "6px 1.25rem", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="5" height="5" rx="0.8"/><rect x="8" y="1" width="5" height="5" rx="0.8"/><rect x="1" y="8" width="5" height="5" rx="0.8"/><rect x="8" y="8" width="5" height="5" rx="0.8"/></svg>
                Admin panel
              </button>
            )}

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

            <button onClick={auth.logout} style={{ width: "100%", padding: "6px 1.25rem 12px", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9 10l3-3-3-3M13 7H5"/></svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Main content */}
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
            {view === "contacts"  && <Contacts  contacts={store.contacts} addContact={store.addContact} updateContact={store.updateContact} deleteContact={store.deleteContact} search={search} />}
            {view === "pipeline"  && <Pipeline  deals={store.deals} addDeal={store.addDeal} updateDeal={store.updateDeal} deleteDeal={store.deleteDeal} updateDealStage={store.updateDealStage} />}
            {view === "tasks"     && <Tasks     tasks={store.tasks} addTask={store.addTask} updateTask={store.updateTask} toggleTask={store.toggleTask} deleteTask={store.deleteTask} />}
            {view === "notes"     && <Notes     notes={store.notes} addNote={store.addNote} updateNote={store.updateNote} deleteNote={store.deleteNote} />}
            {view === "users"     && <Users     users={store.users} currentUser={auth.user} updateUserProfile={store.updateUserProfile} />}
          </div>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} org={auth.org} user={auth.user} />
    </div>
  );
}
