import React, { useState } from "react";
import { Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Textarea } from "./Modal";

export function Notes({ notes, addNote, updateNote, deleteNote }) {
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [text, setText] = useState("");

  function openAdd() { setText(""); setOpen(true); }
  function openEdit(n) { setText(n.text); setEditTarget(n); }
  function saveAdd() { if (!text.trim()) return; addNote({ text }); setText(""); setOpen(false); }
  function saveEdit() { if (!text.trim()) return; updateNote(editTarget.id, { text }); setEditTarget(null); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>Activity log ({notes.length})</SectionTitle>
        <button className="btn btn-primary" onClick={openAdd}>+ Add note</button>
      </div>
      <Card>
        {notes.length === 0
          ? <EmptyState message="No notes yet. Log your first activity!" />
          : notes.map((n, i) => (
            <div key={n.id} style={{ padding: "12px 0", borderBottom: i < notes.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 10, flex: 1 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#185FA5", flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{n.date}</div>
                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{n.text}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <IconBtn onClick={() => openEdit(n)} title="Edit note">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
                  </IconBtn>
                  <IconBtn onClick={() => deleteNote(n.id)} title="Delete note">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/></svg>
                  </IconBtn>
                </div>
              </div>
            </div>
          ))
        }
      </Card>
      <Modal isOpen={open} title="Add note" onClose={() => setOpen(false)} onSave={saveAdd}>
        <FormGroup label="Note"><Textarea value={text} onChange={setText} placeholder="Log a call, meeting, email, or any activity..." /></FormGroup>
      </Modal>
      <Modal isOpen={!!editTarget} title="Edit note" onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Note"><Textarea value={text} onChange={setText} placeholder="Log a call, meeting, email, or any activity..." /></FormGroup>
      </Modal>
    </div>
  );
}
