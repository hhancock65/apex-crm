import { AI_ROLE_ICONS } from "@/components/ai-workforce/ai-role-meta"
import { cn } from "@/lib/utils"
import type { AiEmployeeRole } from "@/types/ai-employee"

// No avatar_url exists for AI Employees (unlike human profiles) — the role
// icon in a colored circle is the "avatar" everywhere an employee is shown.
export function AiEmployeeAvatar({
  role,
  size = "sm",
}: {
  role: AiEmployeeRole
  size?: "sm" | "md"
}) {
  const Icon = AI_ROLE_ICONS[role]
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-apex-navy/5 text-apex-navy",
        size === "sm" ? "h-7 w-7" : "h-9 w-9"
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </div>
  )
}
