import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useStore(userId, orgId) {
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals]       = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [notes, setNotes]       = useState([]);
  const [users, setUsers]       = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId || !orgId) return;
    setLoadingData(true);
    const [c, d, t, n, u] = await Promise.all([
      supabase.from("contacts").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("deals").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("notes").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, username, name, role, real_email").eq("org_id", orgId),
    ]);
    setContacts(c.data || []);
    setDeals(d.data || []);
    setTasks(t.data || []);
    setNotes(n.data || []);
    setUsers(u.data || []);
    setLoadingData(false);
  }, [userId, orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Contacts ──────────────────────────────────────────
  async function addContact(c) {
    const { data } = await supabase.from("contacts").insert([{ ...c, user_id: userId, org_id: orgId }]).select().single();
    if (data) setContacts(prev => [data, ...prev]);
  }
  async function updateContact(id, updates) {
    const { data } = await supabase.from("contacts").update(updates).eq("id", id).select().single();
    if (data) setContacts(prev => prev.map(c => c.id === id ? data : c));
  }
  async function deleteContact(id) {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }

  // ── Deals ─────────────────────────────────────────────
  async function addDeal(d) {
    const { data } = await supabase.from("deals").insert([{ ...d, user_id: userId, org_id: orgId }]).select().single();
    if (data) setDeals(prev => [data, ...prev]);
  }
  async function updateDeal(id, updates) {
    const { data } = await supabase.from("deals").update(updates).eq("id", id).select().single();
    if (data) setDeals(prev => prev.map(d => d.id === id ? data : d));
  }
  async function updateDealStage(id, stage) { return updateDeal(id, { stage }); }
  async function deleteDeal(id) {
    await supabase.from("deals").delete().eq("id", id);
    setDeals(prev => prev.filter(d => d.id !== id));
  }

  // ── Tasks ─────────────────────────────────────────────
  async function addTask(t) {
    const { data } = await supabase.from("tasks").insert([{ ...t, done: false, user_id: userId, org_id: orgId }]).select().single();
    if (data) setTasks(prev => [data, ...prev]);
  }
  async function updateTask(id, updates) {
    const { data } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t));
  }
  async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    return updateTask(id, { done: !task.done });
  }
  async function deleteTask(id) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  // ── Notes ─────────────────────────────────────────────
  async function addNote(n) {
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const { data } = await supabase.from("notes").insert([{ ...n, date, user_id: userId, org_id: orgId }]).select().single();
    if (data) setNotes(prev => [data, ...prev]);
  }
  async function updateNote(id, updates) {
    const { data } = await supabase.from("notes").update(updates).eq("id", id).select().single();
    if (data) setNotes(prev => prev.map(n => n.id === id ? data : n));
  }
  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("id", id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  // ── Users ─────────────────────────────────────────────
  async function updateUserProfile(id, updates) {
    const { data } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
    if (data) setUsers(prev => prev.map(u => u.id === id ? data : u));
  }

  const stats = {
    totalContacts:  contacts.length,
    openDeals:      deals.filter(d => d.stage !== "Won" && d.stage !== "Lost").length,
    pipelineValue:  deals.reduce((a, d) => a + (Number(d.value) || 0), 0),
    pendingTasks:   tasks.filter(t => !t.done).length,
    wonDeals:       deals.filter(d => d.stage === "Won").length,
    winRate:        deals.length > 0 ? Math.round((deals.filter(d => d.stage === "Won").length / deals.length) * 100) : 0,
  };

  return {
    contacts, deals, tasks, notes, users, stats, loadingData,
    addContact, updateContact, deleteContact,
    addDeal, updateDeal, updateDealStage, deleteDeal,
    addTask, updateTask, toggleTask, deleteTask,
    addNote, updateNote, deleteNote,
    updateUserProfile, refetch: fetchAll,
  };
}
