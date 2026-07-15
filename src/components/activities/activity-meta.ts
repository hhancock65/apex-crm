import {
  Calendar,
  Check,
  CheckSquare,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  StickyNote,
  Trophy,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import type { ActivityType } from "@/types/activity"

export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  note: StickyNote,
  task_created: CheckSquare,
  task_completed: Check,
  deal_created: DollarSign,
  deal_won: Trophy,
  deal_lost: XCircle,
  appointment_booked: Calendar,
  lead_created: UserPlus,
  contact_created: UserPlus,
  ai_action: Sparkles,
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  sms: "SMS",
  note: "Note",
  task_created: "Task created",
  task_completed: "Task completed",
  deal_created: "Deal created",
  deal_won: "Deal won",
  deal_lost: "Deal lost",
  appointment_booked: "Appointment booked",
  lead_created: "Lead created",
  contact_created: "Contact created",
  ai_action: "AI action",
}
