import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import type { TransferRuleInput, TransferRuleWithTarget } from "@/types/transfer-rule"

const TRANSFER_RULE_SELECT = `
  *,
  target_user:profiles!transfer_rules_target_user_id_fkey(id, first_name, last_name, email)
`

export const transferRuleKeys = {
  all: ["transfer-rules"] as const,
  list: (aiEmployeeId: string) => [...transferRuleKeys.all, aiEmployeeId] as const,
}

export function useTransferRules(aiEmployeeId: string | undefined) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: transferRuleKeys.list(aiEmployeeId ?? ""),
    enabled: Boolean(aiEmployeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_rules")
        .select(TRANSFER_RULE_SELECT)
        .eq("ai_employee_id", aiEmployeeId!)
        .order("position", { ascending: true })
      if (error) throw error
      return data as TransferRuleWithTarget[]
    },
  })
}

/**
 * The rule builder edits the whole list at once, so saving replaces the
 * full set for this AI Employee — delete-then-insert, the same "whole array
 * overwrite" semantics the old escalation_rules jsonb column had, just
 * across two statements now that this is a real table. `position` is
 * assigned from array order, overriding whatever the caller passed.
 */
export function useSetTransferRules() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      aiEmployeeId,
      rules,
    }: {
      aiEmployeeId: string
      rules: Omit<TransferRuleInput, "position">[]
    }) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { error: deleteError } = await supabase
        .from("transfer_rules")
        .delete()
        .eq("ai_employee_id", aiEmployeeId)
      if (deleteError) throw deleteError

      if (rules.length === 0) return

      const { error: insertError } = await supabase.from("transfer_rules").insert(
        rules.map((rule, index) => ({
          ...rule,
          org_id: orgId,
          ai_employee_id: aiEmployeeId,
          position: index,
        }))
      )
      if (insertError) throw insertError
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: transferRuleKeys.list(variables.aiEmployeeId) })
    },
  })
}
