import {
  Bell,
  CheckSquare,
  Clock,
  GitBranch,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Webhook,
  type LucideIcon,
} from "lucide-react"

import type { WorkflowStepType } from "@/types/workflow"

export const STEP_TYPE_ICONS: Record<WorkflowStepType, LucideIcon> = {
  wait: Clock,
  send_sms: MessageSquare,
  send_email: Mail,
  ai_call: Phone,
  create_task: CheckSquare,
  update_record: RefreshCw,
  condition: GitBranch,
  notification: Bell,
  webhook: Webhook,
}

export const STEP_TYPE_LABELS: Record<WorkflowStepType, string> = {
  wait: "Wait",
  send_sms: "Send SMS",
  send_email: "Send Email",
  ai_call: "AI Employee Call",
  create_task: "Create Task",
  update_record: "Update Record",
  condition: "Condition / If-Then",
  notification: "Send Notification",
  webhook: "Webhook",
}

/** All 9 step types — every one is now genuinely executed by
 *  workflow-executor (wait/ai_call/webhook were stubbed in the foundation
 *  pass; all three are real as of the execution-engine pass). */
export const BUILDER_STEP_TYPES: WorkflowStepType[] = [
  "wait",
  "send_sms",
  "send_email",
  "ai_call",
  "create_task",
  "update_record",
  "condition",
  "notification",
  "webhook",
]

/** Nothing left unimplemented — kept as an empty list (rather than deleting
 *  the concept) since StepConfigPanel's amber warning already keys off this
 *  and a future step type stub should reuse the same mechanism. */
export const UNIMPLEMENTED_STEP_TYPES: readonly WorkflowStepType[] = []

export const EMAIL_TEMPLATE_NAMES = [
  "appointment_confirmation",
  "follow_up_24h",
  "thank_you",
  "missed_call_recovery",
] as const
