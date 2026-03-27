import React, { useState, useEffect } from "react";

export function Modal({ isOpen, title, onClose, onSave, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{
        background: "var(--card-bg)", border: "0.5px solid var(--border)",
        borderRadius: 14, padding: "1.5rem", width: 380, maxWidth: "100%",
        animation: "slideUp 0.18s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: 2,
          }}>×</button>
        </div>
        {children}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

export function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "7px 10px", fontSize: 13,
        border: "0.5px solid var(--border-strong)", borderRadius: 8,
        background: "var(--bg)", color: "var(--text)",
        fontFamily: "inherit", outline: "none",
      }}
    />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "7px 10px", fontSize: 13,
        border: "0.5px solid var(--border-strong)", borderRadius: 8,
        background: "var(--bg)", color: "var(--text)",
        fontFamily: "inherit", outline: "none", cursor: "pointer",
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      style={{
        width: "100%", padding: "7px 10px", fontSize: 13,
        border: "0.5px solid var(--border-strong)", borderRadius: 8,
        background: "var(--bg)", color: "var(--text)",
        fontFamily: "inherit", outline: "none", resize: "vertical",
      }}
    />
  );
}
