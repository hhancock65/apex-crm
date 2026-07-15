import {
  Calendar,
  CalendarClock,
  CalendarX,
  DollarSign,
  Mail,
  MessageSquare,
  PhoneCall,
  PhoneForwarded,
  RefreshCw,
  type LucideIcon,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react"

import type { AiActionType } from "@/types/ai-action"

// Category mapping per the AI Activity Center spec: phone for calls, calendar
// for appointments, user for contacts, dollar for opportunities, mail for
// follow-ups. Reused everywhere action types are rendered (AI Employee
// detail tabs, Contact Conversations tab, AI Activity feed) so the same
// action type always shows the same icon across the app.
export const AI_ACTION_ICONS: Record<AiActionType, LucideIcon> = {
  call_answered: PhoneCall,
  call_transferred: PhoneForwarded,
  lead_created: UserPlus,
  lead_qualified: UserCheck,
  lead_reactivated: RefreshCw,
  appointment_booked: Calendar,
  appointment_rescheduled: CalendarClock,
  appointment_cancelled: CalendarX,
  sms_sent: MessageSquare,
  email_sent: Mail,
  follow_up_sent: Mail,
  contact_created: User,
  contact_updated: User,
  opportunity_created: DollarSign,
}

export const AI_ACTION_LABELS: Record<AiActionType, string> = {
  call_answered: "Call answered",
  call_transferred: "Call transferred",
  lead_created: "Lead created",
  lead_qualified: "Lead qualified",
  lead_reactivated: "Lead reactivated",
  appointment_booked: "Appointment booked",
  appointment_rescheduled: "Appointment rescheduled",
  appointment_cancelled: "Appointment cancelled",
  sms_sent: "SMS sent",
  email_sent: "Email sent",
  follow_up_sent: "Follow-up sent",
  contact_created: "Contact created",
  contact_updated: "Contact updated",
  opportunity_created: "Opportunity created",
}
