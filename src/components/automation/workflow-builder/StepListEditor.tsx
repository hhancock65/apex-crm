import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { ArrowDown } from "lucide-react"
import { Fragment } from "react"

import { createStep, type BuilderStep } from "@/lib/workflow-builder"
import type { WorkflowStepType } from "@/types/workflow"

import { AddStepButton } from "./AddStepButton"
import { StepCard } from "./StepCard"

interface StepListEditorProps {
  steps: BuilderStep[]
  onChange: (steps: BuilderStep[]) => void
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel?: string
}

/**
 * Recursive by design: a condition step's Yes/No branches are each their
 * own StepListEditor, nested inside this one. Each level owns a DndContext
 * scoped to just its own items, so dragging never crosses between a branch
 * and its parent list — a deliberate simplification, not a limitation to
 * work around.
 */
export function StepListEditor({ steps, onChange, selectedId, onSelect, emptyLabel }: StepListEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function insertAt(index: number, type: WorkflowStepType) {
    const step = createStep(type)
    const next = [...steps]
    next.splice(index, 0, step)
    onChange(next)
    onSelect(step.id)
  }

  function updateAt(index: number, patch: Partial<BuilderStep>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }

  function removeAt(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = steps.findIndex((step) => step.id === active.id)
    const toIndex = steps.findIndex((step) => step.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    onChange(arrayMove(steps, fromIndex, toIndex))
  }

  return (
    <div className="space-y-2">
      <AddStepButton onAdd={(type) => insertAt(0, type)} />

      {steps.length === 0 && emptyLabel && (
        <p className="py-2 text-center text-xs text-slate-400">{emptyLabel}</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, index) => (
            <Fragment key={step.id}>
              <StepCard
                step={step}
                selected={selectedId === step.id}
                onSelect={() => onSelect(step.id)}
                onDelete={() => removeAt(index)}
              />

              {step.type === "condition" ? (
                <div className="ml-2 grid grid-cols-1 gap-3 border-l-2 border-slate-200 pl-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">Yes</p>
                    <StepListEditor
                      steps={step.yesSteps ?? []}
                      onChange={(yesSteps) => updateAt(index, { yesSteps })}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      emptyLabel="Nothing happens on Yes."
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">No</p>
                    <StepListEditor
                      steps={step.noSteps ?? []}
                      onChange={(noSteps) => updateAt(index, { noSteps })}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      emptyLabel="Nothing happens on No."
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <ArrowDown className="h-4 w-4 text-slate-300" />
                  </div>
                  <AddStepButton label="Add Step Here" onAdd={(type) => insertAt(index + 1, type)} />
                </>
              )}
            </Fragment>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
