import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useOrgSwitcher(homeUser, homeOrg) {
  const [accessibleOrgs, setAccessibleOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId]       = useState(null);
  const [loadingOrgs, setLoadingOrgs]       = useState(true);

  const fetchAccessibleOrgs = useCallback(async () => {
    // Guard: don't query Supabase until we actually have a home org id.
    // Previously this could fire with homeOrg?.id === undefined, sending
    // a malformed `parent_org_id=eq.` filter that Supabase rejects with 400.
    if (!homeUser?.id || !homeOrg?.id) {
      setLoadingOrgs(false);
      return;
    }
    setLoadingOrgs(true);

    const list = [{ id: homeOrg.id, name: homeOrg.name, is_sub_account: false, role: "Home" }];

    const { data: subs, error } = await supabase
      .from("organizations")
      .select("id, name, is_sub_account")
      .eq("parent_org_id", homeOrg.id);

    if (error) {
      console.error("useOrgSwitcher: failed to load sub-accounts", error);
    }

    (subs || []).forEach(s => list.push({ id: s.id, name: s.name, is_sub_account: true, role: "Sub-account" }));

    setAccessibleOrgs(list);
    setLoadingOrgs(false);

    const saved = localStorage.getItem("crm_active_org_id");
    const stillValid = saved && list.some(o => o.id === saved);
    setActiveOrgId(stillValid ? saved : homeOrg.id);
  }, [homeUser?.id, homeOrg?.id, homeOrg?.name]);

  useEffect(() => { fetchAccessibleOrgs(); }, [fetchAccessibleOrgs]);

  function switchOrg(orgId) {
    setActiveOrgId(orgId);
    localStorage.setItem("crm_active_org_id", orgId);
  }

  function switchToHome() {
    if (homeOrg?.id) switchOrg(homeOrg.id);
  }

  const activeOrgMeta  = accessibleOrgs.find(o => o.id === activeOrgId) || null;
  const isOnSubAccount = !!activeOrgMeta?.is_sub_account;

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
