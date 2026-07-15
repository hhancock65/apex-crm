import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { MoreVertical } from "lucide-react"

import { DealStatusBadge } from "@/components/deals/DealStatusBadge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { dealContactName, type DealWithRelations } from "@/types/deal"
import { profileDisplayName } from "@/types/profile"

interface DealCardProps {
  deal: DealWithRelations
  onOpen: () => void
  onMarkWon: () => void
  onMarkLost: () => void
  dragDisabled?: boolean
}

export function DealCard({ deal, onOpen, onMarkWon, onMarkLost, dragDisabled }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: dragDisabled,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div className={cn("relative rounded-lg border border-slate-200 bg-white shadow-sm", isDragging && "opacity-40")}>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={onOpen}
        className="cursor-grab p-3 pr-8 active:cursor-grabbing"
      >
        <p className="line-clamp-2 text-sm font-medium text-slate-800">{deal.title}</p>
        <p className="mt-1 text-xs text-slate-500">{dealContactName(deal.contact)}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">{formatCurrency(deal.value)}</span>
          {deal.expected_close_date && (
            <span className="text-slate-400">{formatDate(deal.expected_close_date)}</span>
          )}
        </div>
        {deal.assigned_profile && (
          <p className="mt-1.5 truncate text-xs text-slate-400">
            {profileDisplayName(deal.assigned_profile)}
          </p>
        )}
        {deal.status !== "open" && (
          <div className="mt-2">
            <DealStatusBadge status={deal.status} />
          </div>
        )}
      </div>

      {deal.status === "open" && (
        <div className="absolute right-1.5 top-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Deal actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMarkWon}>Mark Won</DropdownMenuItem>
              <DropdownMenuItem onClick={onMarkLost}>Mark Lost</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
