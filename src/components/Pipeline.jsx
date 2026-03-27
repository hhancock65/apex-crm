import React, { useState, useRef } from "react";
import { SectionTitle, IconBtn } from "./UI";
import { Modal, FormGroup, Input, Select } from "./Modal";

const STAGES = ["Lead", "Qualified", "Proposal", "Won"];
const STAGE_COLORS = {
  Lead:      { bg: "#FAEEDA", text: "#854F0B", dot: "#EF9F27" },
  Qualified: { bg: "#E6F1FB", text: "#185FA5", dot: "#378ADD" },
  Proposal:  { bg: "#EEEDFE", text: "#534AB7", dot: "#7F77DD" },
  Won:       { bg: "#EAF3DE", text: "#3B6D11", dot: "#639922" },
};
function blank() { return { name: "", company: "", value: "", stage: "Lead", contact_name: "", close_date: "" }; }

function DealCard({ deal, onDelete, onEdit, onMoveStage, onDragStart }) {
  const currentIdx = STAGES.indexOf(deal.stage);
  const canAdvance = currentIdx < STAGES.length - 1;
  const canGoBack  = currentIdx > 0;
  return (
    <div draggable onDragStart={e => onDragStart(e, deal.id)}
      style={{ background: "var(--card-bg)", border: "0.5px solid var(--border)", borderRadius: 9, padding: "10px 12px", marginBottom: 8, cursor: "grab", transition: "border-color 0.15s", userSelect: "none" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-strong)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
      onDragEnd={e => e.currentTarget.style.opacity = "1"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", flex: 1, paddingRight: 4 }}>{deal.name}</div>
        <div style={{ display: "flex", gap: 2 }}>
          <IconBtn onClick={() => onEdit(deal)} title="Edit deal">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>
          </IconBtn>
          <IconBtn onClick={() => onDelete(deal.id)} title="Delete deal">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/></svg>
          </IconBtn>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "4px 0 1px" }}>${Number(deal.value).toLocaleString()}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: deal.contact_name || deal.close_date ? 4 : 8 }}>{deal.company}</div>
      {deal.contact_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Contact: {deal.contact_name}</div>}
      {deal.close_date && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Close: {deal.close_date}</div>}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {canGoBack && (
          <button onClick={() => onMoveStage(deal.id, STAGES[currentIdx - 1])}
            style={{ flex: 1, fontSize: 11, padding: "3px 0", border: "0.5px solid var(--border-strong)", borderRadius: 6, background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 5l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {STAGES[currentIdx - 1]}
          </button>
        )}
        {canAdvance && (
          <button onClick={() => onMoveStage(deal.id, STAGES[currentIdx + 1])}
            style={{ flex: 1, fontSize: 11, padding: "3px 0", border: "0.5px solid #185FA5", borderRadius: 6, background: "#185FA5", color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
            onMouseEnter={e => e.currentTarget.style.background = "#0C447C"}
            onMouseLeave={e => e.currentTarget.style.background = "#185FA5"}
          >
            {STAGES[currentIdx + 1]}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

export function Pipeline({ deals, addDeal, updateDeal, deleteDeal, updateDealStage }) {
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blank());
  const [dragOverStage, setDragOverStage] = useState(null);
  const dragId = useRef(null);

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }

  function openAdd() { setForm(blank()); setOpen(true); }
  function openEdit(deal) { setForm({ name: deal.name, company: deal.company||"", value: deal.value||"", stage: deal.stage, contact_name: deal.contact_name||"", close_date: deal.close_date||"" }); setEditTarget(deal); }
  function saveAdd() { if (!form.name.trim()) return; addDeal({ ...form, value: Number(form.value)||0 }); setForm(blank()); setOpen(false); }
  function saveEdit() { if (!form.name.trim()) return; updateDeal(editTarget.id, { ...form, value: Number(form.value)||0 }); setEditTarget(null); }

  function handleDragStart(e, id) { dragId.current = id; e.dataTransfer.effectAllowed = "move"; e.currentTarget.style.opacity = "0.45"; }
  function handleDragOver(e, stage) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }
  function handleDrop(e, stage) { e.preventDefault(); setDragOverStage(null); if (dragId.current) { updateDealStage(dragId.current, stage); dragId.current = null; } }

  const stageTotal = s => deals.filter(d => d.stage === s).reduce((a, d) => a + (Number(d.value)||0), 0);
  const winRate = deals.length > 0 ? Math.round((deals.filter(d => d.stage === "Won").length / deals.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SectionTitle>Deal pipeline</SectionTitle>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Win rate: <strong style={{ color: "var(--text)" }}>{winRate}%</strong></span>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add deal</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        {STAGES.map(stage => {
          const sc = STAGE_COLORS[stage];
          const stageDeals = deals.filter(d => d.stage === stage);
          const isOver = dragOverStage === stage;
          return (
            <div key={stage} onDragOver={e => handleDragOver(e, stage)} onDrop={e => handleDrop(e, stage)} onDragLeave={() => setDragOverStage(null)}
              style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: isOver ? "1.5px dashed #185FA5" : "0.5px solid var(--border)", transition: "border 0.15s", minHeight: 120 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot }} />
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-muted)" }}>{stage}</div>
                </div>
                <span style={{ fontSize: 11, color: sc.text, background: sc.bg, padding: "1px 7px", borderRadius: 20 }}>{stageDeals.length}</span>
              </div>
              {stageDeals.length > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>${stageTotal(stage).toLocaleString()} total</div>}
              {stageDeals.map(d => (
                <DealCard key={d.id} deal={d} onDelete={deleteDeal} onEdit={openEdit} onMoveStage={updateDealStage} onDragStart={handleDragStart} />
              ))}
              {stageDeals.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>{isOver ? "Drop here" : "No deals"}</div>}
            </div>
          );
        })}
      </div>

      <Modal isOpen={open} title="Add deal" onClose={() => setOpen(false)} onSave={saveAdd}>
        <FormGroup label="Deal name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. Q3 Renewal" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="Company name" /></FormGroup>
        <FormGroup label="Contact name"><Input value={form.contact_name} onChange={set("contact_name")} placeholder="e.g. Sarah Mitchell" /></FormGroup>
        <FormGroup label="Value ($)"><Input value={form.value} onChange={set("value")} placeholder="e.g. 15000" type="number" /></FormGroup>
        <FormGroup label="Expected close date"><Input value={form.close_date} onChange={set("close_date")} placeholder="e.g. Apr 30" /></FormGroup>
        <FormGroup label="Stage"><Select value={form.stage} onChange={set("stage")} options={STAGES} /></FormGroup>
      </Modal>

      <Modal isOpen={!!editTarget} title="Edit deal" onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Deal name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. Q3 Renewal" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="Company name" /></FormGroup>
        <FormGroup label="Contact name"><Input value={form.contact_name} onChange={set("contact_name")} placeholder="e.g. Sarah Mitchell" /></FormGroup>
        <FormGroup label="Value ($)"><Input value={form.value} onChange={set("value")} placeholder="e.g. 15000" type="number" /></FormGroup>
        <FormGroup label="Expected close date"><Input value={form.close_date} onChange={set("close_date")} placeholder="e.g. Apr 30" /></FormGroup>
        <FormGroup label="Stage"><Select value={form.stage} onChange={set("stage")} options={STAGES} /></FormGroup>
      </Modal>
    </div>
  );
}
