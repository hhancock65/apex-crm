// Supabase Edge Function: update-retell-agent
//
// Called by the app after an AI Employee's configuration is saved
// (Configuration tab). Rebuilds the prompt from the current row and pushes
// it to the existing Retell LLM + Agent. If this employee was never synced
// to Retell (retell_agent_id / settings.retell_llm_id missing — e.g. a
// previous create-retell-agent call partially failed), it falls back to a
// full create instead of erroring, so "Save" is always a safe self-healing
// action rather than something the user has to diagnose.
//
// Request body: { ai_employee_id: string }
// Response:     { success: true, agent_id: string, llm_id: string, created?: true }
//            or { error: string, ... } with a non-2xx status

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { buildAgentPrompt } from "../_shared/prompt-builder.ts"
import {
  createRetellAgent,
  createRetellLlm,
  RetellApiError,
  updateRetellAgent,
  updateRetellLlm,
} from "../_shared/retell-client.ts"
import { buildRetellFunctionTools, buildTransferCallTool, getFunctionHandlerUrl } from "../_shared/retell-tools.ts"
import { createUserScopedClient } from "../_shared/supabase-admin.ts"
import type { AiEmployeeRow, OrganizationRow, TransferRuleRow } from "../_shared/types.ts"

const DEFAULT_VOICE_ID = "11labs-Adrian"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401)
    }

    let ai_employee_id: string | undefined
    try {
      ;({ ai_employee_id } = await req.json())
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }
    if (!ai_employee_id) {
      return jsonResponse({ error: "ai_employee_id is required" }, 400)
    }

    const supabase = createUserScopedClient(authHeader)

    const { data: employeeData, error: employeeError } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("id", ai_employee_id)
      .single()

    if (employeeError || !employeeData) {
      return jsonResponse({ error: "AI Employee not found or not accessible" }, 404)
    }
    const employee = employeeData as AiEmployeeRow

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, settings")
      .eq("id", employee.org_id)
      .single()

    if (orgError || !orgData) {
      return jsonResponse({ error: "Organization not found" }, 404)
    }
    const org = orgData as OrganizationRow

    const { data: transferRules, error: transferRulesError } = await supabase
      .from("transfer_rules")
      .select("id, condition_type, condition_value, target_user_id, target_phone, position")
      .eq("ai_employee_id", employee.id)

    if (transferRulesError) {
      return jsonResponse({ error: "Failed to load transfer rules" }, 500)
    }

    const { generalPrompt, beginMessage } = buildAgentPrompt(
      employee,
      org,
      (transferRules ?? []) as TransferRuleRow[]
    )
    const voiceId = employee.voice || DEFAULT_VOICE_ID
    const language = employee.language || "en-US"
    const existingLlmId = employee.settings?.retell_llm_id as string | undefined
    const generalTools = [...buildRetellFunctionTools(getFunctionHandlerUrl()), buildTransferCallTool()]

    if (!employee.retell_agent_id || !existingLlmId) {
      const llm = await createRetellLlm({ generalPrompt, beginMessage, generalTools })
      const agent = await createRetellAgent({
        llmId: llm.llm_id,
        voiceId,
        agentName: employee.name,
        language,
      })

      const { error: updateError } = await supabase
        .from("ai_employees")
        .update({
          retell_agent_id: agent.agent_id,
          settings: { ...(employee.settings ?? {}), retell_llm_id: llm.llm_id },
        })
        .eq("id", employee.id)

      if (updateError) {
        return jsonResponse(
          {
            error: "Created Retell agent but failed to save it to the AI Employee record",
            retell_agent_id: agent.agent_id,
            retell_llm_id: llm.llm_id,
            details: updateError.message,
          },
          500
        )
      }

      return jsonResponse({ success: true, agent_id: agent.agent_id, llm_id: llm.llm_id, created: true })
    }

    await updateRetellLlm(existingLlmId, { generalPrompt, beginMessage, generalTools })
    await updateRetellAgent(employee.retell_agent_id, {
      voiceId,
      agentName: employee.name,
      language,
    })

    return jsonResponse({ success: true, agent_id: employee.retell_agent_id, llm_id: existingLlmId })
  } catch (error) {
    return handleError(error)
  }
})

function handleError(error: unknown): Response {
  if (error instanceof RetellApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502
    return jsonResponse({ error: `Retell API error: ${error.message}`, details: error.details }, status)
  }
  console.error("update-retell-agent failed:", error)
  return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
}
