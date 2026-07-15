// Supabase Edge Function: create-retell-agent
//
// Called by the app right after a new AI Employee row is inserted into
// Supabase. Provisions the matching Retell resources — a Retell LLM (holds
// the system prompt / first message) and a Retell Agent (holds voice/
// language, and references the LLM) — then writes their ids back onto the
// ai_employees row.
//
// Request body: { ai_employee_id: string }
// Response:     { success: true, agent_id: string, llm_id: string }
//            or { error: string, ... } with a non-2xx status
//
// NOTE ON VOICES: `employee.voice` is passed straight through as Retell's
// `voice_id`. The values currently offered in the CreateAIEmployeeDialog /
// AiEmployeeConfigTab voice dropdown (sarah/james/emma/michael/sofia) are
// placeholders — swap them for real Retell voice ids (GET /list-voices) before
// going live, or every create/update call here will fail with a 4xx from Retell.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { buildAgentPrompt } from "../_shared/prompt-builder.ts"
import { createRetellAgent, createRetellLlm, RetellApiError } from "../_shared/retell-client.ts"
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

    const { data: employee, error: employeeError } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("id", ai_employee_id)
      .single()

    if (employeeError || !employee) {
      return jsonResponse({ error: "AI Employee not found or not accessible" }, 404)
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, settings")
      .eq("id", employee.org_id)
      .single()

    if (orgError || !org) {
      return jsonResponse({ error: "Organization not found" }, 404)
    }

    const { data: transferRules, error: transferRulesError } = await supabase
      .from("transfer_rules")
      .select("id, condition_type, condition_value, target_user_id, target_phone, position")
      .eq("ai_employee_id", employee.id)

    if (transferRulesError) {
      return jsonResponse({ error: "Failed to load transfer rules" }, 500)
    }

    const { generalPrompt, beginMessage } = buildAgentPrompt(
      employee as AiEmployeeRow,
      org as OrganizationRow,
      (transferRules ?? []) as TransferRuleRow[]
    )

    const llm = await createRetellLlm({
      generalPrompt,
      beginMessage,
      generalTools: [...buildRetellFunctionTools(getFunctionHandlerUrl()), buildTransferCallTool()],
    })

    const agent = await createRetellAgent({
      llmId: llm.llm_id,
      voiceId: employee.voice || DEFAULT_VOICE_ID,
      agentName: employee.name,
      language: employee.language || "en-US",
    })

    const { error: updateError } = await supabase
      .from("ai_employees")
      .update({
        retell_agent_id: agent.agent_id,
        settings: { ...(employee.settings ?? {}), retell_llm_id: llm.llm_id },
      })
      .eq("id", employee.id)

    if (updateError) {
      // The Retell agent now exists but Apex doesn't know its id yet — return
      // both ids so the client can retry just the DB write instead of
      // provisioning a second, orphaned Retell agent.
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

    return jsonResponse({ success: true, agent_id: agent.agent_id, llm_id: llm.llm_id })
  } catch (error) {
    return handleError(error)
  }
})

function handleError(error: unknown): Response {
  if (error instanceof RetellApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502
    return jsonResponse({ error: `Retell API error: ${error.message}`, details: error.details }, status)
  }
  console.error("create-retell-agent failed:", error)
  return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
}
