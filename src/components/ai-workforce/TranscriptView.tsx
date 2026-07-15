import { Bot, User, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import type { TranscriptTurn } from "@/types/call-transcript"

function formatOffset(seconds: number | undefined): string | null {
  if (seconds === undefined) return null
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

export function TranscriptView({ turns }: { turns: TranscriptTurn[] }) {
  if (turns.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No transcript available.</p>
  }

  return (
    <ul className="space-y-3">
      {turns.map((turn, index) => {
        const isAgent = turn.role === "agent"
        const isTransfer = turn.role === "transfer_target"
        const offset = formatOffset(turn.words?.[0]?.start)

        if (isTransfer) {
          return (
            <li key={index} className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <span>{turn.content}</span>
            </li>
          )
        }

        return (
          <li key={index} className={cn("flex gap-2", !isAgent && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isAgent ? "bg-apex-teal/10 text-apex-teal" : "bg-slate-100 text-slate-500"
              )}
            >
              {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div className={cn("max-w-[75%] rounded-lg px-3 py-2 text-sm", isAgent ? "bg-slate-50 text-slate-700" : "bg-apex-teal/10 text-slate-800")}>
              <p>{turn.content}</p>
              {offset && (
                <p className={cn("mt-1 text-[10px] text-slate-400", !isAgent && "text-right")}>{offset}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
