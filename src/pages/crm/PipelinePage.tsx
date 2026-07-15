import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AddDealDialog } from "@/components/deals/AddDealDialog"
import { DealCard } from "@/components/deals/DealCard"
import { KanbanColumn } from "@/components/deals/KanbanColumn"
import { MarkDealLostDialog } from "@/components/deals/MarkDealLostDialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDealsBoard, useMarkDealWon, useMoveDeal } from "@/hooks/useDeals"
import { usePipelines, usePipelineStages } from "@/hooks/usePipelines"
import type { DealWithRelations } from "@/types/deal"

export default function PipelinePage() {
  const navigate = useNavigate()

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines()
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("")

  useEffect(() => {
    if (!selectedPipelineId && pipelines && pipelines.length > 0) {
      const defaultPipeline = pipelines.find((p) => p.is_default) ?? pipelines[0]
      setSelectedPipelineId(defaultPipeline.id)
    }
  }, [pipelines, selectedPipelineId])

  const { data: stages } = usePipelineStages(selectedPipelineId || undefined)
  const { data: deals, isLoading: dealsLoading } = useDealsBoard(selectedPipelineId || undefined)
  const moveDeal = useMoveDeal()
  const markWon = useMarkDealWon()

  const [addDealState, setAddDealState] = useState<{ open: boolean; stageId?: string }>({
    open: false,
  })
  const [lostDialogDealId, setLostDialogDealId] = useState<string | null>(null)
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealWithRelations[]>()
    for (const deal of deals ?? []) {
      const list = map.get(deal.stage_id) ?? []
      list.push(deal)
      map.set(deal.stage_id, list)
    }
    return map
  }, [deals])

  function handleDragStart(event: DragStartEvent) {
    const deal = (deals ?? []).find((d) => d.id === event.active.id)
    setActiveDeal(deal ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return

    const deal = (deals ?? []).find((d) => d.id === active.id)
    if (!deal || deal.stage_id === over.id) return

    moveDeal.mutate(
      { dealId: deal.id, newStageId: String(over.id) },
      {
        onError: (err) => {
          toast.error("Failed to move deal", {
            description: err instanceof Error ? err.message : undefined,
          })
        },
      }
    )
  }

  async function handleMarkWon(dealId: string) {
    try {
      await markWon.mutateAsync(dealId)
      toast.success("Deal marked won")
    } catch (err) {
      toast.error("Failed to mark deal won", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (pipelinesLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading pipeline…
      </div>
    )
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-slate-400">
        <p>No pipelines yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Drag deals between stages to update them.</p>
        </div>

        {pipelines.length > 1 && (
          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {!stages || dealsLoading ? (
            <p className="py-10 text-sm text-slate-400">Loading board…</p>
          ) : (
            stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                onAddDeal={() => setAddDealState({ open: true, stageId: stage.id })}
                onOpenDeal={(dealId) => navigate(`/deals/${dealId}`)}
                onMarkWon={handleMarkWon}
                onMarkLost={(dealId) => setLostDialogDealId(dealId)}
              />
            ))
          )}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <DealCard
              deal={activeDeal}
              onOpen={() => {}}
              onMarkWon={() => {}}
              onMarkLost={() => {}}
              dragDisabled
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedPipelineId && (
        <AddDealDialog
          open={addDealState.open}
          onOpenChange={(open) => setAddDealState((s) => ({ ...s, open }))}
          pipelineId={selectedPipelineId}
          stages={stages ?? []}
          defaultStageId={addDealState.stageId}
        />
      )}

      {lostDialogDealId && (
        <MarkDealLostDialog
          dealId={lostDialogDealId}
          open={Boolean(lostDialogDealId)}
          onOpenChange={(open) => !open && setLostDialogDealId(null)}
        />
      )}
    </div>
  )
}
