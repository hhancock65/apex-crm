import { CalendarPlus, Plus, UserPlus } from "lucide-react"
import { useState } from "react"

import { AddAppointmentDialog } from "@/components/productivity/AddAppointmentDialog"
import { AddTaskDialog } from "@/components/productivity/AddTaskDialog"
import { AddDealDialog } from "@/components/deals/AddDealDialog"
import { AddLeadDialog } from "@/components/leads/AddLeadDialog"
import { Button } from "@/components/ui/button"
import { usePipelines, usePipelineStages } from "@/hooks/usePipelines"

export function QuickActionsBar() {
  const { data: pipelines } = usePipelines()
  const defaultPipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0]
  const { data: stages } = usePipelineStages(defaultPipeline?.id)

  const [leadOpen, setLeadOpen] = useState(false)
  const [dealOpen, setDealOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setLeadOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Lead
        </Button>
        <Button onClick={() => setDealOpen(true)} disabled={!defaultPipeline}>
          <Plus className="h-4 w-4" />
          Add Deal
        </Button>
        <Button onClick={() => setTaskOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
        <Button onClick={() => setAppointmentOpen(true)}>
          <CalendarPlus className="h-4 w-4" />
          Schedule Appointment
        </Button>
      </div>

      <AddLeadDialog open={leadOpen} onOpenChange={setLeadOpen} />
      {defaultPipeline && (
        <AddDealDialog
          open={dealOpen}
          onOpenChange={setDealOpen}
          pipelineId={defaultPipeline.id}
          stages={stages ?? []}
        />
      )}
      <AddTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <AddAppointmentDialog open={appointmentOpen} onOpenChange={setAppointmentOpen} />
    </div>
  )
}
