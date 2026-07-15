import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AiActionResult } from "@/types/ai-action"

const RESULT_STYLES: Record<AiActionResult, string> = {
  success: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  failed: "bg-red-50 text-red-700 border-red-200",
}

const RESULT_LABELS: Record<AiActionResult, string> = {
  success: "Success",
  pending: "Pending",
  failed: "Failed",
}

export function AiActionResultBadge({ result }: { result: AiActionResult }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", RESULT_STYLES[result])}>
      {RESULT_LABELS[result]}
    </Badge>
  )
}
