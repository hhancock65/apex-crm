import { Mail, MessageSquare, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { ConversationChannel } from "@/types/conversation"

const CHANNEL_ICONS: Record<ConversationChannel, typeof Phone> = {
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
}

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  phone: "Phone",
  sms: "SMS",
  email: "Email",
}

export function ConversationChannelBadge({ channel }: { channel: ConversationChannel }) {
  const Icon = CHANNEL_ICONS[channel]
  return (
    <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 font-normal text-slate-600">
      <Icon className="h-3 w-3" />
      {CHANNEL_LABELS[channel]}
    </Badge>
  )
}
