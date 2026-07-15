import { Bot, User } from "lucide-react"

import { cn, formatDateTime } from "@/lib/utils"
import type { ConversationMessage } from "@/types/conversation"

export function ConversationMessageList({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No messages yet.</p>
  }

  let previousStamp: string | null = null

  return (
    <ul className="space-y-3">
      {messages.map((message, index) => {
        const stamp = formatDateTime(message.timestamp)
        const showStamp = stamp !== previousStamp
        previousStamp = stamp

        if (message.role === "system") {
          return (
            <li key={index}>
              {showStamp && (
                <p className="mb-1 text-center text-[11px] text-slate-400">{stamp}</p>
              )}
              <p className="text-center text-xs text-slate-500">{message.content}</p>
            </li>
          )
        }

        const isAiEmployee = message.role === "ai_employee"

        return (
          <li key={index}>
            {showStamp && <p className="mb-1 text-center text-[11px] text-slate-400">{stamp}</p>}
            <div className={cn("flex gap-2", !isAiEmployee && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  isAiEmployee ? "bg-apex-teal/15 text-apex-teal" : "bg-slate-100 text-slate-500"
                )}
              >
                {isAiEmployee ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  isAiEmployee ? "bg-apex-teal/10 text-slate-800" : "bg-slate-100 text-slate-700"
                )}
              >
                {message.subject && (
                  <p className="mb-1 text-xs font-semibold text-slate-500">{message.subject}</p>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
