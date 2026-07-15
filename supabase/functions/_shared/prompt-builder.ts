import type { AiEmployeeRow, EscalationRule, OrganizationRow, TransferRuleRow } from "./types.ts"

const ROLE_LABELS: Record<string, string> = {
  front_desk: "Front Desk Agent",
  sales: "Sales Agent",
  appointment: "Appointment Coordinator",
  follow_up: "Follow-Up Specialist",
  lead_recovery: "Lead Recovery Specialist",
  customer_service: "Customer Service Agent",
  custom: "AI Employee",
}

// Goal #4 in the template is role-specific — everything else in the prompt
// (greeting, ID'ing the caller, capturing contact info) is the same for
// every role.
const ROLE_SPECIFIC_GOALS: Record<string, string> = {
  front_desk:
    "route the caller to the right person or department, or take a detailed message if no one is available",
  sales:
    "qualify the caller's needs and budget, and either book a sales appointment or note them as a qualified lead",
  appointment:
    "find a time that works for the caller and confirm the appointment details back to them before ending the call",
  follow_up:
    "check in on their previous inquiry, answer any new questions, and confirm next steps",
  lead_recovery:
    "re-engage the caller, understand what's changed since they last inquired, and revive their interest",
  customer_service:
    "understand their issue or request and resolve it, or escalate if it's beyond what you can help with",
  custom: "help the caller with whatever they need, using your best judgment",
}

function formatResponsibilities(responsibilities: string[]): string {
  if (responsibilities.length === 0) return "general conversation and information sharing"
  return responsibilities.join(", ")
}

function formatEscalationRules(rules: EscalationRule[]): string {
  const valid = rules.filter((rule) => rule.condition.trim() && rule.action.trim())
  if (valid.length === 0) {
    return "use your best judgment, and offer to have a team member follow up if you're ever unsure how to help"
  }
  return valid.map((rule) => `if ${rule.condition.trim()}, then ${rule.action.trim()}`).join("; ")
}

function describeTransferCondition(rule: TransferRuleRow): string {
  switch (rule.condition_type) {
    case "caller_requests_human":
      return "the caller explicitly asks to speak with a human"
    case "value_threshold": {
      const amount = rule.condition_value?.trim()
      return amount ? `the deal is worth more than $${amount}` : "the deal value is high"
    }
    case "angry_caller":
      return "the caller seems angry or frustrated"
    case "emergency":
      return "the caller describes an emergency"
    case "low_confidence":
      return "you are not confident you can help them"
    default:
      return "your escalation rules are met"
  }
}

/** Distinct from formatEscalationRules above — this drives the actual
 *  warm_transfer tool-call instruction, sourced from the structured
 *  transfer_rules table (migration 0010), not the free-text
 *  escalation_rules jsonb column. */
function formatTransferRules(rules: TransferRuleRow[]): string {
  if (rules.length === 0) {
    return "the caller explicitly asks to speak with a human, seems angry or frustrated, or you're not confident you can help them"
  }
  return [...rules]
    .sort((a, b) => a.position - b.position)
    .map((rule) => describeTransferCondition(rule))
    .join("; ")
}

function getOrgSetting(org: OrganizationRow, key: string, fallback: string): string {
  const value = org.settings?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

export interface AgentPrompt {
  generalPrompt: string
  beginMessage: string
}

/**
 * Builds a Retell "general_prompt" + "begin_message" pair from an AI
 * Employee's Apex configuration and its organization's business context.
 * `hours`/`services` are read from organizations.settings (business_hours /
 * services keys) since there's no dedicated business-profile table yet —
 * both fall back to a neutral default if unset.
 */
export function buildAgentPrompt(
  employee: AiEmployeeRow,
  org: OrganizationRow,
  transferRules: TransferRuleRow[] = []
): AgentPrompt {
  const roleLabel = ROLE_LABELS[employee.role] ?? "AI Employee"
  const businessName = org.name
  const personality = employee.personality?.trim() || "friendly, clear, and professional"
  const responsibilities = formatResponsibilities(employee.responsibilities)
  const roleGoal = ROLE_SPECIFIC_GOALS[employee.role] ?? ROLE_SPECIFIC_GOALS.custom
  const escalation = formatEscalationRules(employee.escalation_rules)
  const hours = getOrgSetting(org, "business_hours", "not specified — ask the caller if this is urgent")
  const services = getOrgSetting(org, "services", "not specified")

  const generalPrompt = [
    `You are ${employee.name}, the ${roleLabel} at ${businessName}.`,
    `Your personality is ${personality}.`,
    `You are responsible for: ${responsibilities}.`,
    `When someone calls, your goals are to: 1) greet them warmly, 2) identify why they are calling, ` +
      `3) capture their name and contact information, 4) ${roleGoal}.`,
    `When you learn the caller's name and phone number, call create_or_update_contact to save their ` +
      `information. If you're unsure whether they're already a customer, call check_existing_customer ` +
      `once you have their phone number or email, before treating them as a brand-new lead.`,
    `When the caller wants to schedule an appointment, first call check_availability for their ` +
      `preferred date, then offer them the available times, then call book_appointment once they choose ` +
      `a time. To move or cancel an existing appointment, use reschedule_appointment or ` +
      `cancel_appointment.`,
    `After identifying why someone is calling, qualify them by asking about: 1) what specific service ` +
      `they need, 2) their timeline or urgency, 3) whether they've used a similar service before. Call ` +
      `create_lead as soon as you have their name and phone number, then call qualify_lead with what ` +
      `you learned. If the score is above 60, call create_opportunity.`,
    `When it's useful — after booking an appointment, or to follow up — offer to text or email the ` +
      `caller a confirmation, tell them you're sending it, then call send_sms or send_email with the ` +
      `matching template_name.`,
    `Escalate to a human when: ${escalation}.`,
    `If any of these conditions are met, call warm_transfer: ${formatTransferRules(transferRules)}. Before ` +
      `transferring, tell the caller you're connecting them and briefly summarize the conversation for the ` +
      `human agent. Once warm_transfer returns a target, say "Let me connect you with <target> — I'll brief ` +
      `them on everything we discussed," then call transfer_call with the phone number it returned.`,
    `Business hours: ${hours}.`,
    `Services offered: ${services}.`,
    `Keep responses concise and conversational — this is a phone call, not a chat window.`,
  ].join(" ")

  const beginMessage = `Thanks for calling ${businessName}, this is ${employee.name}. How can I help you today?`

  return { generalPrompt, beginMessage }
}
