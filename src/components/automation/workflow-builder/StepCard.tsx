import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { useSmsTemplates } from "@/hooks/useSmsTemplates"
import type { BuilderStep } from "@/lib/workflow-builder"
import { cn } from "@/lib/utils"
import { profileDisplayName } from "@/types/profile"

import { STEP_TYPE_ICONS, STEP_TYPE_LABELS } from "./step-meta"

function useStepSummary(step: BuilderStep): string {
  const { data: employees } = useAiEmployees()
  const { data: profiles } = useOrgProfiles()
  const { data: templates } = useSmsTemplates()
  const config = step.config

  switch (step.type) {
    case "wait": {
      if (config.mode === "relative_to_trigger_field") {
        const field = config.field as string | undefined
        const offset = config.offset_minutes as number | undefined
        if (!field || offset === undefined) return "Not configured"
        return offset >= 0 ? `Wait until ${offset} min before ${field}` : `Wait until ${-offset} min after ${field}`
      }
      const value = config.duration_value
      const unit = (config.duration_unit as string | undefined) ?? "minutes"
      return value ? `Wait ${value} ${unit}` : "Not configured"
    }
    case "send_sms": {
      const templateName = config.template_name as string | undefined
      if (templateName) {
        const template = templates?.find((t) => t.name === templateName)
        return `Template: ${template?.name ?? templateName}`
      }
      return config.message_text ? "Custom message" : "Not configured"
    }
    case "send_email": {
      const templateName = config.template_name as string | undefined
      if (templateName) return `Template: ${templateName}`
      return config.subject ? `Subject: ${config.subject}` : "Not configured"
    }
    case "ai_call": {
      const employee = employees?.find((e) => e.id === config.ai_employee_id)
      return employee ? `Via ${employee.name}` : "Not configured"
    }
    case "create_task":
      return config.title ? `"${config.title}"` : "Not configured"
    case "update_record":
      return config.field ? `Set ${config.field} = ${config.value ?? ""}` : "Not configured"
    case "condition": {
      const field = config.field as string | undefined
      return field ? `If ${field} ${config.operator ?? "eq"} ${config.value ?? ""}` : "Not configured"
    }
    case "notification": {
      const profile = profiles?.find((p) => p.id === config.user_id)
      return profile ? `Notify ${profileDisplayName(profile)}` : "Not configured"
    }
    default:
      return ""
  }
}

interface StepCardProps {
  step: BuilderStep
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function StepCard({ step, selected, onSelect, onDelete }: StepCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const Icon = STEP_TYPE_ICONS[step.type]
  const summary = useStepSummary(step)

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onSelect}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3 shadow-sm",
          selected ? "border-apex-teal ring-1 ring-apex-teal" : "border-slate-200 hover:border-slate-300",
          isDragging && "opacity-40"
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{STEP_TYPE_LABELS[step.type]}</p>
          <p className="truncate text-xs text-slate-500">{summary}</p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setConfirmOpen(true)
          }}
          className="shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-destructive"
          aria-label="Delete step"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this step?</AlertDialogTitle>
            <AlertDialogDescription>
              {step.type === "condition"
                ? "This will also delete every step in its Yes and No branches. This can't be undone."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
