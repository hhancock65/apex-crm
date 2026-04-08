import React from "react";
import { Avatar, Badge, Card, SectionTitle, EmptyState, IconBtn } from "./UI";

export function ContactDetail({ contact, deals, tasks, notes, onClose, onEdit, onAddDeal, index = 0 }) {
  if (!contact) return null;

  const contactDeals = deals.filter(d =>
    d.contact_name?.toLowerCase() === contact.name?.toLowerCase() ||
    d.company?.toLowerCase() === contact.company?.toLowerCase()
  );
  const contactTasks = tasks.filter(t =>
    t.title?.toLowerCase().includes(contact.name?.toLowerCase()) ||
    t.title?.toLowerCase().includes(contact.company?.toLowerCase())
  );
  const contactNotes = notes.filter(n =>
    n.text?.toLowerCase().includes(contact.name?.toLowerCase()) ||
    n.text?.toLowerCase().includes(contact.company?.toLowerCase())
  );

  const STAGE_COLORS = {
    Lead:      { bg: "#FAEEDA", color: "#854F0B" },
    Qualified: { bg: "#E6F1FB", color: "#185FA5" },
    Proposal:  { bg: "#EEEDFE", color: "#534AB7" },
    Won:       { bg: "#EAF3DE", color: "#3B6D11" },
    Lost:      { bg: "#FCEBEB", color: "#A32D2D" },
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 0 }}
    >
      <div style={{ width: 420, height: "100vh", background: "var(--card-bg)", borderLeft: "0.5px solid var(--border)", display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={contact.name} index={index} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{contact.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{contact.company}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <IconBtn onClick={onEdit} title="Edit contact">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
            </IconBtn>
            <IconBtn onClick={onClose} title="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l10 10M12 2L2 12"/></svg>
            </IconBtn>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>

          {/* Contact info */}
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Status</span>
              <Badge label={contact.status} />
            </div>
            {contact.email && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Email</span>
                <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Phone</span>
                <a href={`tel:${contact.phone}`} style={{ fontSize: 12, color: "var(--text)", textDecoration: "none" }}>{contact.phone}</a>
              </div>
            )}
          </div>

          {/* Deals */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-text-secondary, #7A7875)" }}>Deals ({contactDeals.length})</div>
              <button onClick={() => onAddDeal && onAddDeal(contact)} style={{ fontSize: 11, fontWeight: 500, color: "#185FA5", background: "#E6F1FB", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>+ Add deal</button>
            </div>
            <Card style={{ padding: contactDeals.length === 0 ? "0.75rem 1.25rem" : "0 1.25rem" }}>
              {contactDeals.length === 0
                ? <EmptyState message="No deals linked yet." />
                : contactDeals.map((d, i) => {
                    const sc = STAGE_COLORS[d.stage] || STAGE_COLORS.Lead;
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < contactDeals.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>${Number(d.value).toLocaleString()}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, padding: "2px 9px", borderRadius: 20 }}>{d.stage}</span>
                      </div>
                    );
                  })
              }
            </Card>
          </div>

          {/* Tasks */}
          <div style={{ marginBottom: "1.25rem" }}>
            <SectionTitle>Related tasks ({contactTasks.length})</SectionTitle>
            <Card style={{ padding: contactTasks.length === 0 ? "0.75rem 1.25rem" : "0 1.25rem" }}>
              {contactTasks.length === 0
                ? <EmptyState message="No related tasks." />
                : contactTasks.map((t, i) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: i < contactTasks.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: t.done ? "#185FA5" : "transparent", border: t.done ? "none" : "0.5px solid var(--border-strong)", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t.done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: t.done ? "var(--text-muted)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                      {t.due && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Due {t.due}</div>}
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "1.25rem" }}>
            <SectionTitle>Related notes ({contactNotes.length})</SectionTitle>
            <Card style={{ padding: contactNotes.length === 0 ? "0.75rem 1.25rem" : "0 1.25rem" }}>
              {contactNotes.length === 0
                ? <EmptyState message="No related notes." />
                : contactNotes.map((n, i) => (
                  <div key={n.id} style={{ padding: "10px 0", borderBottom: i < contactNotes.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{n.date}</div>
                    <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>{n.text}</div>
                  </div>
                ))
              }
            </Card>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
