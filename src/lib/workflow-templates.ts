import {
  CalendarCheck,
  PhoneMissed,
  RefreshCw,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { WorkflowStep, WorkflowTriggerType } from "@/types/workflow"

// Pre-built, curated, identical for every org — same reasoning as
// CAMPAIGN_SCRIPT_PRESETS / EMAIL_TEMPLATES (hardcoded, not a DB table):
// there's no per-org customization of the TEMPLATE itself, only of the
// workflow it produces once "Use Template" copies it in. A `workflow_templates`
// table would only earn its keep once templates need admin editing or
// per-org variants, neither of which is asked for here.
//
// Honesty note, read before assuming these "just work" end to end: wait,
// send_sms, send_email, create_task, update_record, notification, condition,
// ai_call, and webhook are all genuinely executed by workflow-executor now
// (see supabase/functions/workflow-executor) — but several steps below still
// use fields that nothing populates: 'call_answered', 'sms_replied', and
// 'interested' aren't written into any workflow_run's condition data by
// anything in this codebase, because there's no mechanism for a LATER
// step's condition to see an EARLIER step's runtime outcome within the same
// run (a call's answer status, an inbound SMS reply) — condition steps can
// only see the workflow's original trigger_data plus live contact/deal/lead
// fields, never what happened partway through the run. Building that
// feedback loop is a real architecture change (a step-output data pipe),
// not something to fake here. These templates encode the exact business
// logic requested, in the real schema, ready to execute the moment that
// capability lands — they are not quietly faked to look more finished than
// the engine currently is. ai_call steps also need config.ai_employee_id
// selected in the builder before they'll do anything (templates can't know
// which AI Employee an org wants to use).

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: LucideIcon
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  steps: WorkflowStep[]
  /** Concrete, per-template caveats — shown in the picker UI, not buried in a comment. */
  notes: string[]
}

const SPEED_TO_LEAD_STEPS: WorkflowStep[] = [
  { id: "s1", type: "wait", config: { mode: "duration", duration_value: 2, duration_unit: "minutes" }, next_step_id: "s2" },
  {
    id: "s2",
    type: "ai_call",
    config: { instructions: "Call the lead who just came in. Introduce yourself, find out what they need, and qualify their interest." },
    next_step_id: "s3",
  },
  {
    id: "s3",
    type: "condition",
    config: { field: "call_answered", operator: "eq", value: true },
    next_step_id: null,
    yes_next_step_id: "s4",
    no_next_step_id: "s6",
  },
  // YES — answered: mark qualified, leave a safety-net task since the AI
  // Employee's own live-call tools handle the actual booking.
  { id: "s4", type: "update_record", config: { field: "status", value: "qualified" }, next_step_id: "s5" },
  {
    id: "s5",
    type: "create_task",
    config: {
      title: "Confirm appointment was booked",
      description: "The AI Employee reached this lead and qualified them — confirm an appointment landed on the calendar.",
      due_offset_value: 1,
      due_offset_unit: "hours",
      due_in_hours: 1,
    },
    next_step_id: null,
  },
  // NO — didn't answer: text, wait, and escalate to email if still silent.
  { id: "s6", type: "send_sms", config: { message_text: "Hi {contact_name}, we just missed you. Reply to schedule." }, next_step_id: "s7" },
  { id: "s7", type: "wait", config: { mode: "duration", duration_value: 1, duration_unit: "hours" }, next_step_id: "s8" },
  {
    id: "s8",
    type: "condition",
    config: { field: "sms_replied", operator: "eq", value: true },
    next_step_id: null,
    yes_next_step_id: "s9",
    no_next_step_id: null,
  },
  {
    id: "s9",
    type: "send_email",
    config: { subject: "Still there?", body_text: "We'd still love to help — reply to this email or call us back whenever works for you." },
    next_step_id: null,
  },
]

const MISSED_CALL_RECOVERY_STEPS: WorkflowStep[] = [
  { id: "s1", type: "wait", config: { mode: "duration", duration_value: 1, duration_unit: "minutes" }, next_step_id: "s2" },
  {
    id: "s2",
    type: "send_sms",
    config: { message_text: "Sorry we missed your call! Our AI assistant can help you right now. Reply YES to get a callback." },
    next_step_id: "s3",
  },
  { id: "s3", type: "wait", config: { mode: "duration", duration_value: 30, duration_unit: "minutes" }, next_step_id: "s4" },
  {
    id: "s4",
    type: "condition",
    config: { field: "sms_replied", operator: "eq", value: true },
    next_step_id: null,
    yes_next_step_id: "s5",
    no_next_step_id: "s6",
  },
  { id: "s5", type: "ai_call", config: { instructions: "Call this contact back — they replied YES to our missed-call text." }, next_step_id: null },
  // NO — approximated as a 12-hour wait (roughly "next morning") rather than
  // a literal "9AM tomorrow" clock time, which this schema has no mode for
  // yet — see WorkflowWaitConfig in src/types/workflow.ts. Since 'wait'
  // isn't executed at all today, precision here doesn't yet matter in
  // practice; worth tightening once it is.
  { id: "s6", type: "wait", config: { mode: "duration", duration_value: 12, duration_unit: "hours" }, next_step_id: "s7" },
  {
    id: "s7",
    type: "send_sms",
    config: { message_text: "Just checking in — still interested in a callback? Reply YES anytime." },
    next_step_id: null,
  },
]

const APPOINTMENT_CONFIRMATION_STEPS: WorkflowStep[] = [
  // "appointment_confirmation" is already a seeded sms_template (migration
  // 0009) — reused as-is rather than duplicating its copy here.
  { id: "s1", type: "send_sms", config: { template_name: "appointment_confirmation" }, next_step_id: "s2" },
  { id: "s2", type: "wait", config: { mode: "relative_to_trigger_field", field: "start_time", offset_minutes: 1440 }, next_step_id: "s3" },
  {
    id: "s3",
    type: "send_sms",
    config: { message_text: "Reminder: your appointment is tomorrow. Reply if you need to reschedule." },
    next_step_id: "s4",
  },
  { id: "s4", type: "wait", config: { mode: "relative_to_trigger_field", field: "start_time", offset_minutes: 60 }, next_step_id: "s5" },
  {
    id: "s5",
    type: "send_sms",
    config: { message_text: "Final reminder: your appointment is in 1 hour. See you soon!" },
    next_step_id: null,
  },
]

const POST_SERVICE_FOLLOW_UP_STEPS: WorkflowStep[] = [
  { id: "s1", type: "wait", config: { mode: "duration", duration_value: 2, duration_unit: "hours" }, next_step_id: "s2" },
  {
    id: "s2",
    type: "send_sms",
    config: { message_text: "Thank you for choosing us today! We hope everything went well." },
    next_step_id: "s3",
  },
  { id: "s3", type: "wait", config: { mode: "duration", duration_value: 3, duration_unit: "days" }, next_step_id: "s4" },
  {
    id: "s4",
    type: "send_sms",
    config: { message_text: "We'd love your feedback! Please leave us a review: {review_link}" },
    next_step_id: "s5",
  },
  { id: "s5", type: "wait", config: { mode: "duration", duration_value: 7, duration_unit: "days" }, next_step_id: "s6" },
  {
    id: "s6",
    type: "send_sms",
    config: { message_text: "Know someone who could use our services? Refer a friend and you'll both get a reward!" },
    next_step_id: null,
  },
]

const LEAD_REACTIVATION_STEPS: WorkflowStep[] = [
  {
    id: "s1",
    type: "ai_call",
    config: { instructions: "This contact hasn't engaged in 90+ days. Reconnect warmly, ask if their needs have changed, and gauge interest." },
    next_step_id: "s2",
  },
  {
    id: "s2",
    type: "condition",
    config: { field: "interested", operator: "eq", value: true },
    next_step_id: null,
    yes_next_step_id: "s3",
    no_next_step_id: "s4",
  },
  {
    id: "s3",
    type: "create_task",
    config: {
      title: "Book appointment for reactivated lead",
      description: "The AI Employee reconnected and the contact is interested — confirm a booking or follow up personally.",
    },
    next_step_id: null,
  },
  // "Remove from future campaigns" isn't a real mechanism anywhere in this
  // app (campaign audience filters only include by tag, they don't exclude
  // by one) — tagging is the honest, executable half of this branch; the
  // exclusion behavior is a follow-up feature, not faked here.
  {
    id: "s4",
    type: "update_record",
    config: { field: "tags", value: ["reactivation_declined"] },
    next_step_id: null,
  },
]

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "speed-to-lead",
    name: "Speed-to-Lead",
    description: "Call new leads within minutes, then text and email if they don't pick up.",
    icon: Zap,
    triggerType: "new_lead",
    triggerConfig: {},
    steps: SPEED_TO_LEAD_STEPS,
    notes: [
      "Select an AI Employee in the \"AI Employee Call\" step before activating — templates can't know which one an org wants to use.",
      "The \"Did they answer?\" and \"Still no response?\" conditions check fields (call_answered, sms_replied) that nothing writes yet — there's no inbound-SMS webhook, and a call's outcome doesn't feed back into this run's condition data.",
    ],
  },
  {
    id: "missed-call-recovery",
    name: "Missed Call Recovery",
    description: "Text back instantly when a call is missed, then offer a callback if they reply.",
    icon: PhoneMissed,
    triggerType: "missed_call",
    triggerConfig: {},
    steps: MISSED_CALL_RECOVERY_STEPS,
    notes: [
      "Select an AI Employee in the \"AI Employee Call\" step before activating — templates can't know which one an org wants to use.",
      "\"Did they reply?\" checks a field (sms_replied) nothing writes yet — there's no inbound-SMS webhook in this app.",
      "The overnight follow-up waits a flat 12 hours rather than resuming at a literal 9AM local time — there's no wait-until-clock-time mode yet, so depending on when the missed call happened, this can land at an odd hour.",
    ],
  },
  {
    id: "appointment-confirmation",
    name: "Appointment Confirmation",
    description: "Confirm immediately, then remind 24 hours and 1 hour before the appointment.",
    icon: CalendarCheck,
    triggerType: "appointment_booked",
    triggerConfig: {},
    steps: APPOINTMENT_CONFIRMATION_STEPS,
    notes: [],
  },
  {
    id: "post-service-follow-up",
    name: "Post-Service Follow-Up",
    description: "Thank the customer, ask for a review, then request a referral over the following week.",
    icon: Star,
    triggerType: "appointment_completed",
    triggerConfig: {},
    steps: POST_SERVICE_FOLLOW_UP_STEPS,
    notes: [],
  },
  {
    id: "lead-reactivation",
    name: "Lead Reactivation",
    description: "Have an AI Employee call stale contacts and either book them or tag them as declined.",
    icon: RefreshCw,
    triggerType: "manual",
    triggerConfig: {},
    steps: LEAD_REACTIVATION_STEPS,
    notes: [
      "Select an AI Employee in the \"AI Employee Call\" step before activating — templates can't know which one an org wants to use.",
      "Manual triggers have no \"Run now\" action yet, and workflows process one entity per run — there's no batch/audience iteration built in. For actually reaching many stale contacts at once (\"no activity in 90+ days\"), use a Campaign instead — Campaigns already have full audience-filter and batch-calling support.",
      "\"Interested?\" checks a field (interested) nothing writes yet, for the same reason as the other templates' call-outcome conditions.",
    ],
  },
]

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id)
}
