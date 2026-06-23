import React, { useState } from "react";
import { Avatar, Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input, Select } from "./Modal";

const ROLES = ["Admin", "Manager", "Sales Rep", "User"];

export function Users({ users, currentUser, updateUserProfile }) {
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", role: "User", real_email: "" });
  const isAdmin = currentUser?.role === "Admin";

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }
  function openEdit(u) { setForm({ name: u.name || "", role: u.role || "User", real_email: u.real_email || "" }); setEditTarget(u); }
  function saveEdit() { updateUserProfile(editTarget.id, form); setEditTarget(null); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>Team members ({users.length})</SectionTitle>
        {isAdmin && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--surface)", padding: "4px 12px", borderRadius: 20, border: "0.5px solid var(--border)" }}>
            Admin view
          </div>
        )}
      </div>

      <Card>
        {users.length === 0
          ? <EmptyState message="No team members found." />
          : users.map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < users.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <Avatar name={u.name || u.username || "?"} index={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                  {u.name || u.username}
                  {u.id === currentUser?.id && <span style={{ fontSize: 10, color: "#185FA5", background: "#E6F1FB", padding: "1px 6px", borderRadius: 10, marginLeft: 6 }}>You</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{u.username}{u.real_email ? ` · ${u.real_email}` : ""}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 10px", borderRadius: 20, border: "0.5px solid var(--border)" }}>{u.role}</span>
              {isAdmin && (
                <IconBtn onClick={() => openEdit(u)} title="Edit user">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
                </IconBtn>
              )}
            </div>
          ))
        }
      </Card>

      {isAdmin && (
        <div style={{ marginTop: 16, background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#854F0B", marginBottom: 4 }}>How to add a new team member</div>
          <div style={{ fontSize: 12, color: "#854F0B", lineHeight: 1.7 }}>
            1. Go to <strong>supabase.com</strong> → Authentication → Users → Add user<br/>
            2. Set email as: <code style={{ background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: 3 }}>username@apexcrm.internal</code> and a password<br/>
            3. Return here and click the edit icon to set their display name, real email, and role
          </div>
        </div>
      )}

      <Modal isOpen={!!editTarget} title={`Edit — @${editTarget?.username}`} onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Display name"><Input value={form.name} onChange={set("name")} placeholder="e.g. Sarah Mitchell" /></FormGroup>
        <FormGroup label="Real email"><Input value={form.real_email} onChange={set("real_email")} placeholder="sarah@company.com" type="email" /></FormGroup>
        <FormGroup label="Role"><Select value={form.role} onChange={set("role")} options={ROLES} /></FormGroup>
      </Modal>
    </div>
  );
}
