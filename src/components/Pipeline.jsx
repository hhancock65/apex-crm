import React, { useState } from "react";
import { Card, EmptyState, IconBtn } from "./UI";
import { Modal, FormGroup, Input, Select } from "./Modal";
import { DateInput } from "./DatePicker";

function blank() { return { name: "", company: "", value: "", contact_name: "", close_date: "", stage: "" }; }

export function Pipeline({ deals, contacts = [], stages = [], stagesLoading, addDeal, updateDeal, deleteDeal, updateDealStage, onManageStages, isAdmin }) {
  const [addOpen, setAddOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState(blank());
  const [dragDealId, setDragDealId] = useState(null);

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }

  const stageNames = stages.map(s => s.name);
  const defaultStage = stageNames[0] || "";

  function openAdd()  { setForm({ ...blank(), stage: defaultStage }); setAddOpen(true); }
  function openEdit(d){ setForm({ name: d.name, company: d.company || "", value: d.value, contact_name: d.contact_name || "", close_date: d.close_date || "", stage: d.stage }); setEditTarget(d); }
  function saveAdd()  { if (!form.name.trim()) return; addDeal({ ...form, value: Number(form.value) || 0 }); setAddOpen(false); }
  function saveEdit() { if (!form.name.trim()) return; updateDeal(editTarget.id, { ...form, value: Number(form.value) || 0 }); setEditTarget(null); }

  const wonStage  = stages.find(s => s.is_won);
  const lostStage = stages.find(s => s.is_lost);
  const wonDeals  = deals.filter(d => d.stage === wonStage?.name);
  const winRate   = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  function handleDrop(stageName) {
    if (dragDealId) { updateDealStage(dragDealId, stageName); setDragDealId(null); }
  }

  if (stagesLoading) {
    return <EmptyState message="Loading pipeline stages..." />;
  }

  if (stages.length === 0) {
    return (
      <div>
        <EmptyState message="No pipeline stages configured yet." />
        {isAdmin && (
          <button onClick={onManageStages} style={{ marginTop: 10, fontSize: 13, color: "var(--accent)", background: "var(--surface)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>
            Set up pipeline stages →
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Win rate: <strong style={{ color: "var(--text)" }}>{winRate}%</strong></div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <button onClick={onManageStages} style={{ fontSize: 13, color: "var(--text-muted)", background: "transparent", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="2.5"/><path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.3 3.3l.7.7M10 10l.7.7M10 3.3l-.7.7M3.3 10l.7.7"/></svg>
              Manage stages
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>+ Add deal</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))`, gap: 12, overflowX: "auto" }}>
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.name);
          return (
            <div
              key={stage.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.name)}
              style={{ background: "var(--surface)", borderRadius: 12, padding: 10, border: "0.5px solid var(--border)", minHeight: 120 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "2px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>{stage.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, background: "var(--card-bg)", color: "var(--text-muted)", padding: "1px 7px", borderRadius: 20 }}>{stageDeals.length}</span>
              </div>

              {stageDeals.length === 0
                ? <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>No deals</div>
                : stageDeals.map(d => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragDealId(d.id)}
                    onClick={() => openEdit(d)}
                    style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 9, padding: "10px 12px", marginBottom: 8, cursor: "grab" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>{d.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>${Number(d.value || 0).toLocaleString()}</div>
                    {d.contact_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.contact_name}</div>}
                    {d.close_date && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M1 6h12M4 1v2M10 1v2"/></svg>
                        Closes {d.close_date}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      {stages.filter(s => s.id !== stage.id).slice(0, 3).map(s => (
                        <button
                          key={s.id}
                          onClick={e => { e.stopPropagation(); updateDealStage(d.id, s.name); }}
                          style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--surface)", border: "0.5px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          → {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          );
        })}
      </div>

      <Modal isOpen={addOpen} title="Add deal" onClose={() => setAddOpen(false)} onSave={saveAdd}>
        <FormGroup label="Deal name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. Q3 Renewal" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="Company name" /></FormGroup>
        <FormGroup label="Contact">
          <select value={form.contact_name} onChange={e => set("contact_name")(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
            <option value="">— Select a contact —</option>
            {contacts.map(c => <option key={c.id} value={c.name}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Value ($)"><Input value={form.value} onChange={set("value")} placeholder="e.g. 15000" type="number" /></FormGroup>
        <FormGroup label="Expected close date">
          <DateInput value={form.close_date} onChange={set("close_date")} placeholder="Pick expected close date" />
        </FormGroup>
        <FormGroup label="Stage"><Select value={form.stage} onChange={set("stage")} options={stageNames} /></FormGroup>
      </Modal>

      <Modal isOpen={!!editTarget} title="Edit deal" onClose={() => setEditTarget(null)} onSave={saveEdit}
        extraAction={{ label: "Delete", onClick: () => { deleteDeal(editTarget.id); setEditTarget(null); } }}
      >
        <FormGroup label="Deal name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. Q3 Renewal" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="Company name" /></FormGroup>
        <FormGroup label="Contact">
          <select value={form.contact_name} onChange={e => set("contact_name")(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
            <option value="">— Select a contact —</option>
            {contacts.map(c => <option key={c.id} value={c.name}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Value ($)"><Input value={form.value} onChange={set("value")} placeholder="e.g. 15000" type="number" /></FormGroup>
        <FormGroup label="Expected close date">
          <DateInput value={form.close_date} onChange={set("close_date")} placeholder="Pick expected close date" />
        </FormGroup>
        <FormGroup label="Stage"><Select value={form.stage} onChange={set("stage")} options={stageNames} /></FormGroup>
      </Modal>
    </div>
  );
}
