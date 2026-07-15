// Supabase Edge Function: retell-inbound-webhook
//
// Configure this as the `inbound_webhook_url` on every Retell phone number
// you provision (PATCH https://api.retellai.com/update-phone-number/{number}).
// Retell calls it right before connecting an inbound call — no Apex user
// session exists at this point, so this function authenticates callers via a
// shared secret instead of a Supabase JWT (see RETELL_WEBHOOK_SECRET below),
// and reads with the service-role client since there's no org/user JWT to
// scope an RLS query to.
//
// Retell's actual request shape (POST):
//   { event: "call_inbound", event_timestamp, call_inbound: { agent_id?, agent_version?, from_number, to_number, custom_sip_headers? } }
// Required response shape (2xx):
//   { call_inbound: { override_agent_id?, dynamic_variables?, metadata? } }
// Omitting override_agent_id tells Retell to decline the call. Retell retries
// up to 3 times on non-2xx within a 10s timeout — reserve non-2xx for
// genuinely transient failures (DB errors), not "no employee assigned to this
// number", which retrying can't fix.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"

interface RetellInboundPayload {
  event?: string
  event_timestamp?: number
  call_inbound?: {
    agent_id?: string
    agent_version?: number
    from_number?: string
    to_number?: string
    custom_sip_headers?: Record<string, string>
  }
}

function declineCall(): Response {
  return jsonResponse({ call_inbound: {} })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  // Retell's inbound webhook isn't HMAC-signed the way its post-call webhooks
  // are, so gate it with a shared secret instead of leaving it open — set
  // RETELL_WEBHOOK_SECRET and append `?secret=...` to the inbound_webhook_url
  // you register with Retell.
  const expectedSecret = Deno.env.get("RETELL_WEBHOOK_SECRET")
  if (expectedSecret) {
    const providedSecret = new URL(req.url).searchParams.get("secret")
    if (providedSecret !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }
  }

  let payload: RetellInboundPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const toNumber = payload.call_inbound?.to_number
  const fromNumber = payload.call_inbound?.from_number

  if (!toNumber) {
    return declineCall()
  }

  const supabase = createServiceRoleClient()

  const { data: employee, error: employeeError } = await supabase
    .from("ai_employees")
    .select("id, org_id, name, retell_agent_id, status")
    .eq("phone_number", toNumber)
    .maybeSingle()

  if (employeeError) {
    // Transient DB error — let Retell's built-in retry have another go
    // rather than permanently declining a call that might otherwise succeed.
    console.error("retell-inbound-webhook: employee lookup failed", employeeError)
    return jsonResponse({ error: "Lookup failed" }, 500)
  }

  if (!employee || !employee.retell_agent_id || employee.status === "offline") {
    // No employee assigned to this number, never synced to Retell, or
    // deliberately taken offline — a definitive "decline", not transient.
    return declineCall()
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name, settings")
    .eq("id", employee.org_id)
    .maybeSingle()

  if (orgError) {
    console.error("retell-inbound-webhook: org lookup failed", orgError)
    return jsonResponse({ error: "Lookup failed" }, 500)
  }

  const settings = (org?.settings ?? {}) as Record<string, unknown>

  let callerName: string | undefined
  if (fromNumber) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("phone", fromNumber)
      .eq("org_id", employee.org_id)
      .maybeSingle()
    if (contact) {
      callerName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || undefined
    }
  }

  return jsonResponse({
    call_inbound: {
      override_agent_id: employee.retell_agent_id,
      dynamic_variables: {
        business_name: org?.name ?? "",
        business_hours: typeof settings.business_hours === "string" ? settings.business_hours : "",
        services: typeof settings.services === "string" ? settings.services : "",
        ai_employee_name: employee.name,
        ...(callerName ? { caller_name: callerName } : {}),
      },
      metadata: {
        ai_employee_id: employee.id,
        org_id: employee.org_id,
      },
    },
  })
})
