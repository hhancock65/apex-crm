import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WorkflowStepType } from "@/types/workflow"

import { BUILDER_STEP_TYPES, STEP_TYPE_ICONS, STEP_TYPE_LABELS } from "./step-meta"

interface AddStepButtonProps {
  onAdd: (type: WorkflowStepType) => void
  label?: string
}

export function AddStepButton({ onAdd, label = "Add Step" }: AddStepButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed">
          <Plus className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        {BUILDER_STEP_TYPES.map((type) => {
          const Icon = STEP_TYPE_ICONS[type]
          return (
            <DropdownMenuItem key={type} onClick={() => onAdd(type)}>
              <Icon className="h-4 w-4" />
              {STEP_TYPE_LABELS[type]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
