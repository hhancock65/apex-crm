import React, { useState, useRef, useEffect } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function CalendarPicker({ value, onChange, onClose }) {
  const today    = new Date();
  const selected = value ? new Date(value + "T00:00:00") : (isNaN(new Date(value)) ? null : new Date(value));
  const parsedSelected = value && !isNaN(Date.parse(value)) ? new Date(value) : null;

  const [viewDate, setViewDate] = useState(() => {
    const d = parsedSelected || today;
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
    return parsedSelected && parsedSelected.getFullYear() === year && parsedSelected.getMonth() === month && parsedSelected.getDate() === day;
  }

  // Pipeline close dates are often future-looking but can also be past
  // (e.g. logging a deal that already closed) — unlike Tasks, we do NOT
  // grey out past days here.
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ background: "var(--card-bg)", border: "0.5px solid var(--border-strong)", borderRadius: 12, padding: 14, width: 260, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3L5 7l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((day, i) => (
          <button key={i} onClick={() => day && selectDay(day)}
            disabled={!day}
            style={{
              width: "100%", aspectRatio: "1", border: "none", borderRadius: 6,
              background: isSelected(day) ? "#185FA5" : isToday(day) ? "#E6F1FB" : "transparent",
              color: isSelected(day) ? "#fff" : isToday(day) ? "#185FA5" : "var(--text)",
              fontSize: 12, fontWeight: isSelected(day) || isToday(day) ? 600 : 400,
              cursor: !day ? "default" : "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { if (day && !isSelected(day)) e.currentTarget.style.background = "var(--surface)"; }}
            onMouseLeave={e => { if (day && !isSelected(day)) e.currentTarget.style.background = isToday(day) ? "#E6F1FB" : "transparent"; }}
          >
            {day || ""}
          </button>
        ))}
      </div>

      <div style={{ borderTop: "0.5px solid var(--border)", marginTop: 10, paddingTop: 8, display: "flex", gap: 6 }}>
        <button onClick={() => selectDay(today.getDate())} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>Today</button>
        <button onClick={() => { const t = new Date(); t.setDate(t.getDate()+7); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); selectDay(t.getDate()); }} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>+7 days</button>
        <button onClick={() => { const t = new Date(); t.setDate(t.getDate()+30); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); selectDay(t.getDate()); }} style={{ flex: 1, padding: "5px", fontSize: 11, background: "var(--surface)", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontFamily: "inherit" }}>+30 days</button>
      </div>
    </div>
  );
}

// Reusable date input with dropdown calendar — used by both Tasks (due date)
// and Pipeline (expected close date).
export function DateInput({ value, onChange, placeholder = "Pick a date" }) {
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
        <span style={{ flex: 1 }}>{value || placeholder}</span>
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
