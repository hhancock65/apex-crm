import React, { useState } from "react";
import { Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input } from "./Modal";

function blank() { return { title: "", due: "" }; }

export function Tasks({ tasks, addTask, updateTask, toggleTask, deleteTask }) {
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blank());
  const [filter, setFilter] = useState("all");

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }
  function openAdd() { setForm(blank()); setOpen(true); }
  function openEdit(t) { setForm({ title: t.title, due: t.due || "" }); setEditTarget(t); }
  function saveAdd() { if (!form.title.trim()) return; addTask(form); setForm(blank()); setOpen(false); }
  function saveEdit() { if (!form.title.trim()) return; updateTask(editTarget.id, form); setEditTarget(null); }

  const filtered = tasks.filter(t => filter === "all" ? true : filter === "pending" ? !t.done : t.done);

  const TaskForm = () => (
    <>
      <FormGroup label="Task title *"><Input value={form.title} onChange={set("title")} placeholder="e.g. Follow up call" /></FormGroup>
      <FormGroup label="Due date"><Input value={form.due} onChange={set("due")} placeholder="e.g. Apr 1" /></FormGroup>
    </>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "pending", "done"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "0.5px solid var(--border-strong)", background: filter === f ? "var(--accent)" : "var(--card-bg)", color: filter === f ? "#fff" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add task</button>
      </div>

      <SectionTitle>{filtered.length} task{filtered.length !== 1 ? "s" : ""}</SectionTitle>
      <Card>
        {filtered.length === 0
          ? <EmptyState message="No tasks here." />
          : filtered.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0", borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <button onClick={() => toggleTask(t.id)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: t.done ? "none" : "0.5px solid var(--border-strong)", background: t.done ? "#185FA5" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, padding: 0, transition: "all 0.15s" }}>
                {t.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: t.done ? "var(--text-muted)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                {t.due && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Due {t.due}</div>}
              </div>
              <IconBtn onClick={() => openEdit(t)} title="Edit task">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
              </IconBtn>
              <IconBtn onClick={() => deleteTask(t.id)} title="Delete task">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/></svg>
              </IconBtn>
            </div>
          ))
        }
      </Card>

      <Modal isOpen={open} title="Add task" onClose={() => setOpen(false)} onSave={saveAdd}><TaskForm /></Modal>
      <Modal isOpen={!!editTarget} title="Edit task" onClose={() => setEditTarget(null)} onSave={saveEdit}><TaskForm /></Modal>
    </div>
  );
}
