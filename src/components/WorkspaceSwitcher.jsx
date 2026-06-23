import React, { useState, useRef, useEffect } from "react";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}

export function WorkspaceSwitcher({ accessibleOrgs, activeOrgId, activeOrgMeta, onSwitch, onManageSubAccounts, isAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!accessibleOrgs || accessibleOrgs.length === 0) return null;

  const current = activeOrgMeta || accessibleOrgs[0];
  const hasMultiple = accessibleOrgs.length > 1;

  return (
    <div ref={ref} style={{ position: "relative", padding: "0 12px", marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 9,
          padding: "8px 10px", borderRadius: 9, border: "0.5px solid var(--border)",
          background: "var(--surface)", cursor: "pointer", fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: current.is_sub_account ? "#534AB7" : "#185FA5",
          color: "#fff", fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {initials(current.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {current.name}
          </div>
          {current.is_sub_account && (
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Sub-account</div>
          )}
        </div>
        {hasMultiple && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 12, right: 12, zIndex: 300,
          background: "var(--card-bg)", border: "0.5px solid var(--border-strong)", borderRadius: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.15)", overflow: "hidden",
        }}>
          <div style={{ maxHeight: 280, overflowY: "auto", padding: 6 }}>
            {accessibleOrgs.map(org => (
              <button
                key={org.id}
                onClick={() => { onSwitch(org.id); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 9px", borderRadius: 7, border: "none",
                  background: org.id === activeOrgId ? "var(--surface)" : "transparent",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
                onMouseEnter={e => { if (org.id !== activeOrgId) e.currentTarget.style.background = "var(--surface)"; }}
                onMouseLeave={e => { if (org.id !== activeOrgId) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: org.is_sub_account ? "#534AB7" : "#185FA5",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {initials(org.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {org.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{org.is_sub_account ? "Sub-account" : "Home workspace"}</div>
                </div>
                {org.id === activeOrgId && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#185FA5" strokeWidth="2"><path d="M2.5 6.5L5 9L10.5 3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div style={{ borderTop: "0.5px solid var(--border)", padding: 6 }}>
              <button
                onClick={() => { onManageSubAccounts(); setOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--accent)", fontSize: 12.5, fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3v8M3 7h8" strokeLinecap="round"/></svg>
                Manage sub-accounts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
