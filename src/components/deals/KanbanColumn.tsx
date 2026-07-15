import { useDroppable } from "@dnd-kit/core"
import { Plus } from "lucide-react"

import { DealCard } from "@/components/deals/DealCard"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import type { DealWithRelations } from "@/types/deal"
import type { PipelineStage } from "@/types/pipeline"

interface KanbanColumnProps {
  stage: PipelineStage
  deals: DealWithRelations[]
  onAddDeal: () => void
  onOpenDeal: (dealId: string) => void
  onMarkWon: (dealId: string) => void
  onMarkLost: (dealId: string) => void
}

export function KanbanColumn({
  stage,
  deals,
  onAddDeal,
  onOpenDeal,
  onMarkWon,
  onMarkLost,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0)

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-slate-100">
      <div
        className="rounded-t-lg border-t-4 bg-white px-3 py-2.5"
        style={{ borderTopColor: stage.color ?? "#94A3B8" }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-800">{stage.name}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onAddDeal}
            aria-label={`Add deal to ${stage.name}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span>
            {deals.length} deal{deals.length === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>{formatCurrency(totalValue)}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-apex-teal/10"
        )}
        style={{ minHeight: 140, maxHeight: "calc(100vh - 260px)" }}
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onOpen={() => onOpenDeal(deal.id)}
            onMarkWon={() => onMarkWon(deal.id)}
            onMarkLost={() => onMarkLost(deal.id)}
          />
        ))}
        {deals.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">No deals</p>
        )}
      </div>
    </div>
  )
}
