import React, { useState, useRef, useEffect } from "react";
import { Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input } from "./Modal";

// ── Mini calendar picker ──────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function CalendarPicker({ value, onChange, onClose }) {
  const today    = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [viewDate, setViewDate] = useState(() => {
    const d = selected || today;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  function selectDay(day) {
    const d = new Date(year, month, day);
    const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    onChange(formatted);
    onClose();
  }

  function isToday(day) {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  }

  function isSelected(day) {
    return selected && selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day;
  }

  function isPast(day) {
    const d = new Date(year, month, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border-strong)", borderRadius: 12, padding: 14, width: 260, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((day, i) => (
          <button key={i} onClick={() => day && !isPast(day) && selectDay(day)}
            disabled={!day || isPast(day)}
            style={{
              width: "100%", aspectRatio: "1", border: "none", borderRadius: 6,
              background: isSelected(day) ? "#185FA5" : isToday(day) ? "#E6F1FB" : "transparent",
              color: isSelected(day) ? "#fff" : isPast(day) ? "var(--border-strong)" : isToday(day) ? "#185FA5" : "var(--text)",
              fontSize: 12, fontWeight: isSelected(day) || isToday(day) ? 600 : 400,
              cursor: !day || isPast(day) ? "default" : "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { if (day && !isPast(day) && !isSelected(day)) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (day && !isPast(day) && !isSelected(day)) e.currentTarget.style.background = "transparent"; }}
          >
            {day || ""}
          </button>
        ))}
      </div>

      {/* Today shortcut */}
      <div style={{ borderTop: "0.5px solid var(--border)", marginTop: 10, paddingTop: 8, display: "flex", gap: 6 }}>
        <button onClick={() => selectDay(today.getDate())} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>Today</button>
        <button onClick={() => { const t = new Date(); t.setDate(t.getDate()+1); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); selectDay(t.getDate()); }} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>Tomorrow</button>
        <button onClick={() => { const t = new Date(); t.setDate(t.getDate()+7); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); selectDay(t.getDate()); }} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>+7 days</button>
      </div>
    </div>
  );
}

function DateInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: value ? "var(--text)" : "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ flexShrink: 0, opacity: 0.6 }}>
          <rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M1 6h12M4 1v2M10 1v2"/>
        </svg>
        <span style={{ flex: 1 }}>{value || "Pick a date"}</span>
        {value && (
          <button onClick={e => { e.stopPropagation(); onChange(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200 }}>
          <CalendarPicker value={value} onChange={onChange} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ── Tasks component ───────────────────────────────────────────
function blank() { return { title: "", due: "" }; }

export function Tasks({ tasks, addTask, updateTask, toggleTask, deleteTask }) {
  const [open, setOpen]           = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]           = useState(blank());
  const [filter, setFilter]       = useState("all");

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }
  function openAdd()  { setForm(blank()); setOpen(true); }
  function openEdit(t){ setForm({ title: t.title, due: t.due || "" }); setEditTarget(t); }
  function saveAdd()  { if (!form.title.trim()) return; addTask(form); setForm(blank()); setOpen(false); }
  function saveEdit() { if (!form.title.trim()) return; updateTask(editTarget.id, form); setEditTarget(null); }

  const filtered = tasks.filter(t =>
    filter === "all" ? true : filter === "pending" ? !t.done : t.done
  );

  // Check if a task is overdue
  function isOverdue(due) {
    if (!due) return false;
    const d = new Date(due); const today = new Date();
    d.setHours(0,0,0,0); today.setHours(0,0,0,0);
    return d < today;
  }

  const TaskForm = () => (
    <>
      <FormGroup label="Task title *">
        <Input value={form.title} onChange={set("title")} placeholder="e.g. Follow up call" />
      </FormGroup>
      <FormGroup label="Due date">
        <DateInput value={form.due} onChange={set("due")} />
      </FormGroup>
    </>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "pending", "done"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "0.5px solid var(--border-strong)", background: filter === f ? "var(--accent)" : "var(--card-bg)", color: filter === f ? "#fff" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", textTransform: "capitalize" }}>
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
          : filtered.map((t, i) => {
              const overdue = !t.done && isOverdue(t.due);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0", borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none" }}>
                  <button onClick={() => toggleTask(t.id)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: t.done ? "none" : "0.5px solid var(--border-strong)", background: t.done ? "#185FA5" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, padding: 0, transition: "all 0.15s" }}>
                    {t.done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: t.done ? "var(--text-muted)" : "var(--text)", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                    {t.due && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: overdue ? "#A32D2D" : "var(--text-muted)", marginTop: 2 }}>
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M1 6h12M4 1v2M10 1v2"/></svg>
                        {overdue ? "Overdue · " : "Due "}{t.due}
                      </div>
                    )}
                  </div>
                  <IconBtn onClick={() => openEdit(t)} title="Edit task">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
                  </IconBtn>
                  <IconBtn onClick={() => deleteTask(t.id)} title="Delete task">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/></svg>
                  </IconBtn>
                </div>
              );
            })
        }
      </Card>

      <Modal isOpen={open} title="Add task" onClose={() => setOpen(false)} onSave={saveAdd}>
        <FormGroup label="Task title *"><Input value={form.title} onChange={set("title")} placeholder="e.g. Follow up call" /></FormGroup>
        <FormGroup label="Due date"><DateInput value={form.due} onChange={set("due")} /></FormGroup>
      </Modal>

      <Modal isOpen={!!editTarget} title="Edit task" onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Task title *"><Input value={form.title} onChange={set("title")} placeholder="e.g. Follow up call" /></FormGroup>
        <FormGroup label="Due date"><DateInput value={form.due} onChange={set("due")} /></FormGroup>
      </Modal>
    </div>
  );
}
