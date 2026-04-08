import React, { useState } from "react";
import { Avatar, Badge, Card, SectionTitle, EmptyState, IconBtn } from "./UI";
import { ContactDetail } from "./ContactDetail";
import { Modal, FormGroup, Input, Select } from "./Modal";

const STATUSES = ["Lead", "Qualified", "Proposal", "Won", "Lost"];
function blank() { return { name: "", company: "", email: "", phone: "", status: "Lead" }; }

export function Contacts({ contacts, deals, tasks, notes, addContact, updateContact, deleteContact, search }) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(blank());

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  function set(k) { return v => setForm(f => ({ ...f, [k]: v })); }

  function openAdd() { setForm(blank()); setAddOpen(true); }
  function openEdit(c) { setForm({ name: c.name, company: c.company || "", email: c.email || "", phone: c.phone || "", status: c.status }); setEditTarget(c); }

  function saveAdd() {
    if (!form.name.trim()) return;
    addContact(form); setAddOpen(false); setForm(blank());
  }
  function saveEdit() {
    if (!form.name.trim()) return;
    updateContact(editTarget.id, form); setEditTarget(null);
  }

  // CSV export
  function exportCSV() {
    const rows = [["Name","Company","Email","Phone","Status"], ...contacts.map(c => [c.name, c.company, c.email, c.phone, c.status])];
    const csv = rows.map(r => r.map(v => `"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "contacts.csv"; a.click();
  }

  // CSV import
  function importCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split("\n").filter(Boolean);
      const header = lines[0].split(",").map(h => h.replace(/"/g,"").trim().toLowerCase());
      lines.slice(1).forEach(line => {
        const vals = line.split(",").map(v => v.replace(/"/g,"").trim());
        const row = Object.fromEntries(header.map((h,i) => [h, vals[i]||""]));
        if (row.name) addContact({ name: row.name, company: row.company||"", email: row.email||"", phone: row.phone||"", status: row.status||"Lead" });
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>All contacts ({filtered.length})</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
          <label className="btn" style={{ cursor: "pointer" }}>
            Import CSV <input type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
          </label>
          <button className="btn btn-primary" onClick={openAdd}>+ Add contact</button>
        </div>
      </div>

      <Card>
        {filtered.length === 0
          ? <EmptyState message={search ? "No contacts match your search." : "No contacts yet. Add your first one!"} />
          : filtered.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < filtered.length - 1 ? "0.5px solid var(--border)" : "none" }}>
              <Avatar name={c.name} index={i} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setSelectedContact({ contact: c, index: i })}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {c.company}{c.company && c.email ? " · " : ""}<span style={{ color: "var(--accent)" }}>{c.email}</span>
                </div>
                {c.phone && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.phone}</div>}
              </div>
              <Badge label={c.status} />
              <IconBtn onClick={() => openEdit(c)} title="Edit contact">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/>
                </svg>
              </IconBtn>
              <IconBtn onClick={() => deleteContact(c.id)} title="Delete contact">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4l-.8 7.5a.5.5 0 01-.5-.5H4.3a.5.5 0 01-.5-.5L3 4"/>
                </svg>
              </IconBtn>
            </div>
          ))
        }
      </Card>

      {/* Add modal */}
      <Modal isOpen={addOpen} title="Add contact" onClose={() => setAddOpen(false)} onSave={saveAdd}>
        <FormGroup label="Full name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. John Smith" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="e.g. Acme Corp" /></FormGroup>
        <FormGroup label="Email"><Input value={form.email} onChange={set("email")} placeholder="john@acme.com" type="email" /></FormGroup>
        <FormGroup label="Phone"><Input value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" /></FormGroup>
        <FormGroup label="Status"><Select value={form.status} onChange={set("status")} options={STATUSES} /></FormGroup>
      </Modal>

      {/* Contact detail panel */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact.contact}
          index={selectedContact.index}
          deals={deals || []}
          tasks={tasks || []}
          notes={notes || []}
          onClose={() => setSelectedContact(null)}
          onEdit={() => { openEdit(selectedContact.contact); setSelectedContact(null); }}
        />
      )}

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} title="Edit contact" onClose={() => setEditTarget(null)} onSave={saveEdit}>
        <FormGroup label="Full name *"><Input value={form.name} onChange={set("name")} placeholder="e.g. John Smith" /></FormGroup>
        <FormGroup label="Company"><Input value={form.company} onChange={set("company")} placeholder="e.g. Acme Corp" /></FormGroup>
        <FormGroup label="Email"><Input value={form.email} onChange={set("email")} placeholder="john@acme.com" type="email" /></FormGroup>
        <FormGroup label="Phone"><Input value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" /></FormGroup>
        <FormGroup label="Status"><Select value={form.status} onChange={set("status")} options={STATUSES} /></FormGroup>
      </Modal>
    </div>
  );
}
