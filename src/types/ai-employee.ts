export const AI_EMPLOYEE_ROLES = [
  "front_desk",
  "sales",
  "appointment",
  "follow_up",
  "lead_recovery",
  "customer_service",
  "custom",
] as const
export type AiEmployeeRole = (typeof AI_EMPLOYEE_ROLES)[number]

export const AI_EMPLOYEE_STATUSES = ["online", "offline", "paused"] as const
export type AiEmployeeStatus = (typeof AI_EMPLOYEE_STATUSES)[number]

export interface EscalationRule {
  condition: string
  action: string
}

/** Minimal shape for pickers/joins elsewhere (calls, conversations) — avoids pulling the full row just to show a name. */
export interface AiEmployeeSummary {
  id: string
  name: string
  role: AiEmployeeRole
}

export interface AiEmployee {
  id: string
  org_id: string
  name: string
  role: AiEmployeeRole
  description: string | null
  voice: string | null
  language: string
  personality: string | null
  status: AiEmployeeStatus
  retell_agent_id: string | null
  phone_number: string | null
  responsibilities: string[]
  knowledge_config: Record<string, unknown>
  escalation_rules: EscalationRule[]
  settings: Record<string, unknown>
  total_calls: number
  total_leads: number
  total_appointments: number
  created_at: string
  updated_at: string
}

export type CreateAiEmployeeInput = Pick<
  AiEmployee,
  "name" | "role" | "voice" | "language" | "personality" | "responsibilities" | "escalation_rules"
>

export type UpdateAiEmployeeInput = Partial<CreateAiEmployeeInput> &
  Partial<Pick<AiEmployee, "status" | "description" | "knowledge_config" | "settings">>

export interface AiEmployeeTodayStats {
  calls: number
  leads: number
  appointments: number
}
