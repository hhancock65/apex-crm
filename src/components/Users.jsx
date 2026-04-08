import React, { useState } from "react";
import { Avatar, Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input, Select } from "./Modal";

const ROLES = ["Admin", "Manager", "Sales Rep", "User"];

export function Users({ users, currentUser, org, updateUserProfile }) {
  const [editTarget, setEditTarget]   = useState(null);
  const [editForm, setEditForm]       = useState({ name: "", role: "User", real_email: "" });
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteForm, setInviteForm]   = useState({ name: "", username: "", email: "", role: "User" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const isAdmin     = currentUser?.role === "Admin";
  const seatsLimit  = org?.seats_limit || 2;
  const seatsUsed   = users.length;
  const atLimit     = seatsLimit !== -1 && seatsUsed >= seatsLimit;

  function setEdit(k)   { return v => setEditForm(f => ({ ...f, [k]: v })); }
  function setInvite(k) { return v => setInviteForm(f => ({ ...f, [k]: v })); }

  function openEdit(u) {
    setEditForm({ name: u.name || "", role: u.role || "User", real_email: u.real_email || "" });
    setEditTarget(u);
  }
  function saveEdit() {
    updateUserProfile(editTarget.id, editForm);
    setEditTarget(null);
  }

  async function sendInvite() {
    setInviteError(""); setInviteLoading(true);
    const trimmed = inviteForm.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(trimmed)) {
      setInviteError("Username: 3–30 chars, letters/numbers/dots/dashes only.");
      setInviteLoading(false); return;
    }
    if (!inviteForm.email.includes("@")) {
      setInviteError("Please enter a valid email address.");
      setInviteLoading(false); return;
    }

    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          inviteForm.name,
          username:      trimmed,
          email:         inviteForm.email.trim().toLowerCase(),
          role:          inviteForm.role,
          orgId:         currentUser?.org_id,
          inviterUserId: currentUser?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to invite user.");
        setInviteLoading(false); return;
      }
      setInviteSuccess({ ...data, username: trimmed, name: inviteForm.name });
      setInviteForm({ name: "", username: "", email: "", role: "User" });
    } catch (err) {
      setInviteError("Network error. Please try again.");
    }
    setInviteLoading(false);
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteError("");
    setInviteSuccess(null);
    setInviteForm({ name: "", username: "", email: "", role: "User" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <SectionTitle>Team members ({seatsUsed}{seatsLimit !== -1 ? ` / ${seatsLimit}` : ""})</SectionTitle>
        </div>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)} disabled={atLimit}
            className="btn btn-primary"
            title={atLimit ? `You've reached your ${seatsLimit}-user limit. Upgrade to Pro for unlimited members.` : ""}
            style={{ opacity: atLimit ? 0.5 : 1, cursor: atLimit ? "not-allowed" : "pointer" }}
          >
            + Invite member
          </button>
        )}
      </div>

      {/* Seats limit warning */}
      {isAdmin && atLimit && org?.plan !== "pro" && (
        <div style={{ background: "#FAEEDA", border: "0.5px solid #EF9F27", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#854F0B" }}>
          You've reached your {seatsLimit}-user limit on the {org?.plan} plan.{" "}
          <strong>Upgrade to Pro</strong> for unlimited team members.
        </div>
      )}

      <Card>
        {users.length === 0
          ? <EmptyState message="No team members found." />
          : users.map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < users.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <Avatar name={u.name || u.username || "?"} index={i} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  {u.name || u.username}
                  {u.id === currentUser?.id && (
                    <span style={{ fontSize: 10, color: "#185FA5", background: "#E6F1FB", padding: "1px 6px", borderRadius: 10 }}>You</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  @{u.username}{u.real_email ? ` · ${u.real_email}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 10px", borderRadius: 20, border: "0.5px solid var(--border)" }}>
                {u.role}
              </span>
              {isAdmin && (
                <IconBtn onClick={() => openEdit(u)} title="Edit member">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
                </IconBtn>
              )}
            </div>
          ))
        }
      </Card>

      {/* Invite modal */}
      <Modal isOpen={inviteOpen} title="Invite team member" onClose={closeInvite} onSave={inviteSuccess ? closeInvite : sendInvite}>
        {inviteSuccess ? (
          <div>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EAF3DE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#3B6D11" strokeWidth="1.8"><path d="M4 11l5 5L18 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{inviteSuccess.name} has been invited!</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>A welcome email with their login credentials has been sent. They can sign in immediately.</div>
            </div>
            <div style={{ background: "var(--surface)", borderRadius: 9, padding: "12px 14px", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Username</span>
                <code style={{ color: "var(--text)", fontFamily: "monospace" }}>{inviteSuccess.username}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Temp password</span>
                <code style={{ color: "var(--text)", fontFamily: "monospace" }}>{inviteSuccess.tempPassword}</code>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, textAlign: "center" }}>
              Share these credentials if the email doesn't arrive. They should change their password after first login.
            </div>
          </div>
        ) : (
          <>
            <FormGroup label="Full name *"><Input value={inviteForm.name} onChange={setInvite("name")} placeholder="e.g. Sarah Mitchell" /></FormGroup>
            <FormGroup label="Work email *"><Input value={inviteForm.email} onChange={setInvite("email")} placeholder="sarah@company.com" type="email" /></FormGroup>
            <FormGroup label="Username *">
              <Input value={inviteForm.username} onChange={v => setInvite("username")(v.toLowerCase())} placeholder="e.g. sarah (used to sign in)" />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>3–30 chars · letters, numbers, dots, dashes · no spaces</div>
            </FormGroup>
            <FormGroup label="Role"><Select value={inviteForm.role} onChange={setInvite("role")} options={ROLES} /></FormGroup>
            {inviteError && (
              <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginTop: 8 }}>
                {inviteError}
              </div>
            )}
            {inviteLoading && <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>Creating account and sending email...</div>}
          </>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} title={`Edit — @${editTarget?.username}`} onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Display name"><Input value={editForm.name} onChange={setEdit("name")} placeholder="e.g. Sarah Mitchell" /></FormGroup>
        <FormGroup label="Real email"><Input value={editForm.real_email} onChange={setEdit("real_email")} placeholder="sarah@company.com" type="email" /></FormGroup>
        <FormGroup label="Role"><Select value={editForm.role} onChange={setEdit("role")} options={ROLES} /></FormGroup>
      </Modal>
    </div>
  );
}
