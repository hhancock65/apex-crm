import type { RetellCustomTool, RetellTransferCallTool } from "./types.ts"

/**
 * The custom-function tools every AI Employee's Retell LLM is configured
 * with, so it can create/update CRM records live during a call instead of
 * only after it ends. Both tools share the same retell-function-handler
 * endpoint — it routes on the `name` field of the incoming tool call.
 */
export function buildRetellFunctionTools(functionHandlerUrl: string): RetellCustomTool[] {
  return [
    {
      type: "custom",
      name: "create_or_update_contact",
      description:
        "Save or update the caller's contact information in the CRM. Call this as soon as you have learned the caller's first name, last name, and phone number.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "The caller's first name." },
          last_name: { type: "string", description: "The caller's last name." },
          phone: { type: "string", description: "The caller's phone number, including area code." },
          email: { type: "string", description: "The caller's email address, if they provided one." },
          address: { type: "string", description: "The caller's street address, if they provided one." },
        },
        required: ["first_name", "last_name", "phone"],
      },
    },
    {
      type: "custom",
      name: "check_existing_customer",
      description:
        "Check whether the caller is already an existing customer. Call this early in the conversation, once you have their phone number or email, before treating them as a brand-new lead.",
      url: functionHandlerUrl,
      speak_during_execution: true,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "The caller's phone number to search for." },
          email: {
            type: "string",
            description: "The caller's email address to search for, if phone isn't available.",
          },
        },
        required: [],
      },
    },
    {
      type: "custom",
      name: "check_availability",
      description:
        "Look up open appointment time slots for a given date. Call this when the caller wants to schedule an appointment, before offering them any specific times.",
      url: functionHandlerUrl,
      speak_during_execution: true,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date to check, in YYYY-MM-DD format." },
          service_type: {
            type: "string",
            description: "The kind of appointment being scheduled, if known (e.g. 'oil change', 'consultation').",
          },
        },
        required: ["date"],
      },
    },
    {
      type: "custom",
      name: "book_appointment",
      description:
        "Book an appointment for the caller at a specific date and time. Only call this after the caller has chosen one of the times you offered them from check_availability, and after their contact info has been saved with create_or_update_contact.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "The contact_id returned by create_or_update_contact for this caller.",
          },
          date: { type: "string", description: "The appointment date, in YYYY-MM-DD format." },
          time: { type: "string", description: "The chosen time, e.g. '9:00 AM' or '14:00'." },
          service_type: {
            type: "string",
            description: "The kind of appointment being booked, if known.",
          },
          notes: { type: "string", description: "Any additional notes about the appointment." },
        },
        required: ["contact_id", "date", "time"],
      },
    },
    {
      type: "custom",
      name: "reschedule_appointment",
      description:
        "Move an existing appointment to a new date and time. Identify the appointment with either appointment_id (if known) or the caller's contact_phone.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "The id of the appointment to reschedule, if known." },
          contact_phone: {
            type: "string",
            description: "The caller's phone number, used to find their upcoming appointment if appointment_id isn't known.",
          },
          new_date: { type: "string", description: "The new date, in YYYY-MM-DD format." },
          new_time: { type: "string", description: "The new time, e.g. '2:00 PM' or '14:00'." },
        },
        required: ["new_date", "new_time"],
      },
    },
    {
      type: "custom",
      name: "cancel_appointment",
      description:
        "Cancel an existing appointment. Identify the appointment with either appointment_id (if known) or the caller's contact_phone.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "The id of the appointment to cancel, if known." },
          contact_phone: {
            type: "string",
            description: "The caller's phone number, used to find their upcoming appointment if appointment_id isn't known.",
          },
        },
        required: [],
      },
    },
    {
      type: "custom",
      name: "create_lead",
      description:
        "Save a new sales lead captured during this call. Call this once you know who the caller is and what they're interested in, even before they're fully qualified.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "The lead's first name." },
          last_name: { type: "string", description: "The lead's last name." },
          phone: { type: "string", description: "The lead's phone number." },
          email: { type: "string", description: "The lead's email address, if provided." },
          company: { type: "string", description: "The lead's company name, if provided." },
          source: {
            type: "string",
            description: "Where this lead came from. Defaults to 'ai_employee' — only set this if the caller mentions a different origin (e.g. 'referral', 'website', 'campaign').",
          },
          notes: { type: "string", description: "A brief summary of what the caller is interested in." },
          score: {
            type: "number",
            description: "Your assessment of how qualified this lead is, from 1-100, based on the conversation so far.",
          },
        },
        required: ["first_name", "last_name", "phone"],
      },
    },
    {
      type: "custom",
      name: "qualify_lead",
      description:
        "Score and update an existing lead after asking qualification questions. Call this after you've asked about their budget, timeline, urgency, and whether they're the decision maker.",
      url: functionHandlerUrl,
      speak_during_execution: true,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          contact_phone: { type: "string", description: "The lead's phone number, used to find their lead record." },
          qualification_answers: {
            type: "object",
            description:
              "The caller's answers to the qualification questions — include whichever of these keys you learned: budget (their budget, if any), timeline (how soon they want this done), urgency (how urgent it is for them), decision_maker (whether they're the one who decides).",
          },
        },
        required: ["contact_phone", "qualification_answers"],
      },
    },
    {
      type: "custom",
      name: "create_opportunity",
      description:
        "Create a sales opportunity (deal) for a qualified lead. Call this after qualify_lead if the score is above 60, once the caller's contact info has already been saved with create_or_update_contact.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "The contact_id returned by create_or_update_contact for this caller.",
          },
          title: { type: "string", description: "A short title for this opportunity, e.g. 'Kitchen remodel consultation'." },
          estimated_value: { type: "number", description: "The estimated dollar value of this opportunity, if known." },
          description: { type: "string", description: "A brief description of what the caller needs." },
          urgency: { type: "string", description: "How urgent this opportunity is for the caller, if known." },
        },
        required: ["contact_id", "title"],
      },
    },
    {
      type: "custom",
      name: "send_sms",
      description:
        "Send a text message to the caller. Tell them you're sending it (e.g. \"I'll send you a text confirmation right now\") before calling this — don't call it silently.",
      url: functionHandlerUrl,
      speak_during_execution: true,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          to_phone: { type: "string", description: "The phone number to text." },
          message_text: {
            type: "string",
            description: "The message to send. Omit this if you're using template_name instead.",
          },
          template_name: {
            type: "string",
            description:
              "The name of a pre-built template to use instead of writing your own message: 'appointment_confirmation', 'follow_up_24h', 'thank_you', or 'missed_call_recovery'.",
          },
        },
        required: ["to_phone"],
      },
    },
    {
      type: "custom",
      name: "send_email",
      description:
        "Send an email to the caller. Use this for confirmations or follow-ups when you have their email address — mention you're sending it before calling this.",
      url: functionHandlerUrl,
      speak_during_execution: true,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          to_email: { type: "string", description: "The email address to send to." },
          subject: {
            type: "string",
            description: "The email subject. Omit this if you're using template_name instead.",
          },
          body_text: {
            type: "string",
            description: "The email body. Omit this if you're using template_name instead.",
          },
          template_name: {
            type: "string",
            description:
              "The name of a pre-built template to use instead of writing your own subject/body: 'appointment_confirmation', 'follow_up_24h', 'thank_you', or 'missed_call_recovery'.",
          },
        },
        required: ["to_email"],
      },
    },
    {
      type: "custom",
      name: "warm_transfer",
      description:
        "Prepare to transfer this call to a human based on your escalation rules — resolves who to transfer to, logs the transfer, and briefs them with a summary. Call this BEFORE saying anything about connecting the caller, then say \"Let me connect you with <target> — I'll brief them on everything we discussed\" using the target name this function returns, then call transfer_call with the target_phone value.",
      url: functionHandlerUrl,
      speak_during_execution: false,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "A short human-readable reason for the transfer, e.g. 'Caller asked for a manager about a billing dispute'.",
          },
          reason_category: {
            type: "string",
            description:
              "Which escalation condition this matches — required to pick the right target. One of: 'caller_requests_human', 'value_threshold', 'angry_caller', 'emergency', 'low_confidence'.",
          },
          estimated_value: {
            type: "number",
            description: "The estimated deal value in dollars, if reason_category is 'value_threshold'.",
          },
          contact_info_summary: {
            type: "string",
            description: "Who the caller is — name and phone/email if known.",
          },
          conversation_summary: {
            type: "string",
            description: "A concise summary of what's been discussed so far, for the human agent's context.",
          },
        },
        required: ["reason", "reason_category", "conversation_summary"],
      },
    },
  ]
}

/**
 * Retell's native transfer_call tool — see RetellTransferCallTool for why
 * this is a different shape from the custom-function tools above. Always
 * registered alongside them (in create-retell-agent/update-retell-agent) so
 * the AI Employee that just resolved a target via warm_transfer has a tool
 * to actually complete the handoff with.
 */
export function buildTransferCallTool(): RetellTransferCallTool {
  return {
    type: "transfer_call",
    name: "transfer_call",
    description:
      "Actually transfer the live call. Only call this immediately after warm_transfer and after telling the caller you're connecting them — pass the target_phone value warm_transfer returned as `number`.",
    transfer_destination: { type: "dynamic" },
    parameters: {
      type: "object",
      properties: {
        number: {
          type: "string",
          description: "The phone number to transfer to — the target_phone value returned by warm_transfer.",
        },
      },
      required: ["number"],
    },
  }
}

/** Deployed URL of retell-function-handler, derived from the same
 *  SUPABASE_URL every other function already reads its Supabase client
 *  config from — Edge Functions are always served at
 *  `${SUPABASE_URL}/functions/v1/<name>`. */
export function getFunctionHandlerUrl(): string {
  const base = Deno.env.get("SUPABASE_URL")
  if (!base) {
    throw new Error("Missing SUPABASE_URL")
  }
  return `${base}/functions/v1/retell-function-handler`
}
