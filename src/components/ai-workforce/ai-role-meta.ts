import {
  Headset,
  LifeBuoy,
  type LucideIcon,
  PhoneCall,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCog,
} from "lucide-react"

import type { AiEmployeeRole } from "@/types/ai-employee"

export const AI_ROLE_ICONS: Record<AiEmployeeRole, LucideIcon> = {
  front_desk: Headset,
  sales: TrendingUp,
  appointment: PhoneCall,
  follow_up: RefreshCw,
  lead_recovery: Sparkles,
  customer_service: LifeBuoy,
  custom: UserCog,
}

export const AI_ROLE_LABELS: Record<AiEmployeeRole, string> = {
  front_desk: "Front Desk",
  sales: "Sales",
  appointment: "Appointment",
  follow_up: "Follow-Up",
  lead_recovery: "Lead Recovery",
  customer_service: "Customer Service",
  custom: "Custom",
}

export const AI_ROLE_DESCRIPTIONS: Record<AiEmployeeRole, string> = {
  front_desk: "Answers inbound calls, greets callers, and routes them to the right place.",
  sales: "Qualifies leads and works deals through the pipeline.",
  appointment: "Books, confirms, and reschedules appointments.",
  follow_up: "Follows up with leads and contacts to keep conversations moving.",
  lead_recovery: "Re-engages cold or unqualified leads.",
  customer_service: "Handles support questions and existing-customer requests.",
  custom: "Define your own responsibilities and behavior from scratch.",
}
