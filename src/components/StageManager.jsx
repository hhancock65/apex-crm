import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle, IconBtn } from "./UI";

const COLOR_PRESETS = ["#EF9F27", "#378ADD", "#8B5CF6", "#22C55E", "#94A3B8", "#E24B4A", "#F472B6", "#14B8A6"];

export function StageManager({ stages, ownerOrgId, isAdmin, onStagesChanged }) {
  const [localStages, setLocalStages] = useState(stages);
  const [adding, setAdding]           = useState(false);
  const [newName, setNewName]         = useState("");
  const [error, setError]             = useState("");
  const [savingId, setSavingId]       = useState(null);
  const [draggedId, setDraggedId]     = useState(null);

  React.useEffect(() => { setLocalStages(stages); }, [stages]);

  if (!isAdmin) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Only Admins can manage pipeline stages.
      </div>
    );
  }

  async function addStage() {
    setError("");
    if (!newName.trim()) { setError("Please enter a stage name."); return; }
    if (localStages.some(s => s.name.toLowerCase() === newName.trim().toLowerCase())) {
      setError("A stage with that name already exists.");
      return;
    }
    const position = localStages.length;
    const color = COLOR_PRESETS[position % COLOR_PRESETS.length];
    const { data, error: insertErr } = await supabase
      .from("pipeline_stages")
      .insert([{ org_id: ownerOrgId, name: newName.trim(), color, position }])
      .select()
      .single();
    if (insertErr) { setError(insertErr.message); return; }
    setLocalStages(prev => [...prev, data]);
    setNewName("");
    setAdding(false);
    onStagesChanged?.();
  }

  async function renameStage(id, name) {
    setLocalStages(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }

  async function commitRename(id, name) {
    if (!name.trim()) return;
    setSavingId(id);
    await supabase.from("pipeline_stages").update({ name: name.trim() }).eq("id", id);
    setSavingId(null);
    onStagesChanged?.();
  }

  async function setColor(id, color) {
    setLocalStages(prev => prev.map(s => s.id === id ? { ...s, color } : s));
    await supabase.from("pipeline_stages").update({ color }).eq("id", id);
    onStagesChanged?.();
  }

  async function toggleWonLost(id, field) {
    const stage = localStages.find(s => s.id === id);
    const updates = field === "is_won"
      ? { is_won: !stage.is_won, is_lost: false }
      : { is_lost: !stage.is_lost, is_won: false };
    setLocalStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    await supabase.from("pipeline_stages").update(updates).eq("id", id);
    onStagesChanged?.();
  }

  async function deleteStage(id) {
    if (localStages.length <= 1) {
      setError("You need at least one stage.");
      return;
    }
    if (!window.confirm("Delete this stage? Deals currently in it will need to be moved manually.")) return;
    await supabase.from("pipeline_stages").delete().eq("id", id);
    setLocalStages(prev => prev.filter(s => s.id !== id));
    onStagesChanged?.();
  }

  function handleDragStart(id) { setDraggedId(id); }
  function handleDragOver(e, overId) {
    e.preventDefault();
    if (draggedId === null || draggedId === overId) return;
    setLocalStages(prev => {
      const fromIdx = prev.findIndex(s => s.id === draggedId);
      const toIdx   = prev.findIndex(s => s.id === overId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }
  async function handleDragEnd() {
    if (draggedId === null) return;
    setDraggedId(null);
    const orderedIds = localStages.map(s => s.id);
    await supabase.rpc("reorder_pipeline_stages", { p_stage_ids: orderedIds });
    onStagesChanged?.();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>Pipeline stages</SectionTitle>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add stage</button>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
        Drag to reorder. These stages apply across your whole organization, including any sub-accounts.
      </div>

      <Card>
        {localStages.map((s, i) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => handleDragStart(s.id)}
            onDragOver={e => handleDragOver(e, s.id)}
            onDragEnd={handleDragEnd}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
              borderBottom: i < localStages.length - 1 ? "0.5px solid var(--border)" : "none",
              opacity: draggedId === s.id ? 0.4 : 1, cursor: "grab",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.3" style={{ flexShrink: 0 }}>
              <circle cx="3" cy="3" r="0.8" fill="currentColor"/><circle cx="3" cy="9" r="0.8" fill="currentColor"/>
              <circle cx="9" cy="3" r="0.8" fill="currentColor"/><circle cx="9" cy="9" r="0.8" fill="currentColor"/>
            </svg>

            {/* Color swatch + picker */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <details style={{ display: "inline-block" }}>
                <summary style={{ width: 18, height: 18, borderRadius: 5, background: s.color, cursor: "pointer", listStyle: "none", border: "1px solid rgba(0,0,0,0.1)" }} />
                <div style={{ position: "absolute", top: 24, left: 0, zIndex: 50, background: "var(--card-bg)", border: "0.5px solid var(--border-strong)", borderRadius: 8, padding: 8, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
                  {COLOR_PRESETS.map(c => (
                    <button key={c} onClick={() => setColor(s.id, c)} style={{ width: 20, height: 20, borderRadius: 5, background: c, border: c === s.color ? "2px solid var(--text)" : "1px solid rgba(0,0,0,0.1)", cursor: "pointer", padding: 0 }} />
                  ))}
                </div>
              </details>
            </div>

            <input
              value={s.name}
              onChange={e => renameStage(s.id, e.target.value)}
              onBlur={e => commitRename(s.id, e.target.value)}
              style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)", background: "transparent", border: "none", outline: "none", fontFamily: "inherit", padding: "4px 6px", borderRadius: 6 }}
              onFocus={e => e.target.style.background = "var(--surface)"}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={s.is_won} onChange={() => toggleWonLost(s.id, "is_won")} style={{ margin: 0 }} />
              Won
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={s.is_lost} onChange={() => toggleWonLost(s.id, "is_lost")} style={{ margin: 0 }} />
              Lost
            </label>

            <IconBtn onClick={() => deleteStage(s.id)} title="Delete stage">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/></svg>
            </IconBtn>
          </div>
        ))}
      </Card>

      {adding && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStage()}
            placeholder="e.g. Contract Sent"
            autoFocus
            style={{ flex: 1, padding: "7px 10px", fontSize: 13, border: "0.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text)", fontFamily: "inherit", outline: "none" }}
          />
          <button onClick={addStage} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          <button onClick={() => { setAdding(false); setNewName(""); setError(""); }} style={{ padding: "7px 16px", fontSize: 13, background: "transparent", color: "var(--text-muted)", border: "0.5px solid var(--border-strong)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: 7, padding: "8px 12px", marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
