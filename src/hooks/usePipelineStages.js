import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// Fetches the stage list that applies to the ACTIVE org. If the active org
// is a sub-account, stages are inherited from its parent automatically —
// the RLS policy + stage_owner_org_id() handle this server-side, but we
// also resolve the owner org_id client-side so writes (add/rename/reorder)
// target the correct row.

export function usePipelineStages(activeOrgId, isSubAccount, parentOrgId) {
  const [stages, setStages]   = useState([]);
  const [loading, setLoading] = useState(true);

  const ownerOrgId = isSubAccount ? parentOrgId : activeOrgId;

  const fetchStages = useCallback(async () => {
    if (!ownerOrgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("org_id", ownerOrgId)
      .order("position", { ascending: true });

    if (error) {
      console.error("usePipelineStages: failed to load stages", error);
      setStages([]);
    } else {
      setStages(data || []);
    }
    setLoading(false);
  }, [ownerOrgId]);

  useEffect(() => { fetchStages(); }, [fetchStages]);

  return { stages, loading, ownerOrgId, refreshStages: fetchStages };
}
