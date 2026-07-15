import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { tagColorClasses } from "@/lib/tag-colors"
import { cn } from "@/lib/utils"

export function TagBadge({
  tag,
  className,
  children,
}: {
  tag: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Badge variant="outline" className={cn("border font-medium", tagColorClasses(tag), className)}>
      {tag}
      {children}
    </Badge>
  )
}
