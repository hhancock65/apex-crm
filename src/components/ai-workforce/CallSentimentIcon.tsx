import { Meh, Smile, Frown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { CallSentiment } from "@/types/call"

const SENTIMENT_ICON = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
} satisfies Record<CallSentiment, typeof Smile>

const SENTIMENT_COLOR: Record<CallSentiment, string> = {
  positive: "text-green-500",
  neutral: "text-slate-400",
  negative: "text-red-500",
}

export function CallSentimentIcon({ sentiment }: { sentiment: CallSentiment | null }) {
  if (!sentiment) return <span className="text-slate-300">—</span>

  const Icon = SENTIMENT_ICON[sentiment]
  return (
    <Icon
      className={cn("h-4 w-4", SENTIMENT_COLOR[sentiment])}
      aria-label={`${sentiment} sentiment`}
    />
  )
}
