import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Manages: list of orgs the user can switch into (home org + sub-accounts
// they have org_access to), the currently "active" org, and switching.
// The active org is stored in localStorage so a refresh keeps you on the
// sub-account you were viewing.

export function useOrgSwitcher(homeUser, homeOrg) {
  const [accessibleOrgs, setAccessibleOrgs] = useState([]); // [{id, name, is_sub_account, role}]
  const [activeOrgId, setActiveOrgId]       = useState(null);
  const [loadingOrgs, setLoadingOrgs]       = useState(true);

  const fetchAccessibleOrgs = useCallback(async () => {
    if (!homeUser?.id) { setLoadingOrgs(false); return; }
    setLoadingOrgs(true);

    const list = [];

    // Home org always first
    if (homeOrg) {
      list.push({ id: homeOrg.id, name: homeOrg.name, is_sub_account: false, role: "Home" });
    }

    // Sub-accounts under the home org (if this user is an Admin, they see all;
    // org_access RLS + accessible_org_ids() limits this server-side regardless)
    const { data: subs } = await supabase
      .from("organizations")
      .select("id, name, is_sub_account")
      .eq("parent_org_id", homeOrg?.id || "");

    (subs || []).forEach(s => list.push({ id: s.id, name: s.name, is_sub_account: true, role: "Sub-account" }));

    setAccessibleOrgs(list);
    setLoadingOrgs(false);

    // Restore previously active org if still valid, else default to home
    const saved = localStorage.getItem("crm_active_org_id");
    const stillValid = saved && list.some(o => o.id === saved);
    setActiveOrgId(stillValid ? saved : (homeOrg?.id || null));
  }, [homeUser?.id, homeOrg?.id, homeOrg?.name]);

  useEffect(() => { fetchAccessibleOrgs(); }, [fetchAccessibleOrgs]);

  function switchOrg(orgId) {
    setActiveOrgId(orgId);
    localStorage.setItem("crm_active_org_id", orgId);
  }

  function switchToHome() {
    if (homeOrg?.id) switchOrg(homeOrg.id);
  }

  const activeOrgMeta   = accessibleOrgs.find(o => o.id === activeOrgId) || null;
  const isOnSubAccount  = !!activeOrgMeta?.is_sub_account;

  return {
    accessibleOrgs,
    activeOrgId,
    activeOrgMeta,
    isOnSubAccount,
    loadingOrgs,
    switchOrg,
    switchToHome,
    refreshOrgs: fetchAccessibleOrgs,
  };
}
