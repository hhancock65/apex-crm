import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateWorkflow } from "@/hooks/useWorkflows"
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@/lib/workflow-templates"
import { WORKFLOW_TRIGGER_LABELS } from "@/types/workflow"

interface TemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplatesDialog({ open, onOpenChange }: TemplatesDialogProps) {
  const navigate = useNavigate()
  const createWorkflow = useCreateWorkflow()
  const [installingId, setInstallingId] = useState<string | null>(null)

  async function installTemplate(template: WorkflowTemplate) {
    setInstallingId(template.id)
    try {
      const workflow = await createWorkflow.mutateAsync({
        name: template.name,
        description: template.description,
        trigger_type: template.triggerType,
        trigger_config: structuredClone(template.triggerConfig),
        steps: structuredClone(template.steps),
      })
      toast.success(`"${template.name}" added — customize it before activating`)
      onOpenChange(false)
      navigate(`/workflows/${workflow.id}`)
    } catch (error) {
      toast.error("Failed to install template", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Workflow Templates</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((template) => {
            const Icon = template.icon
            const isInstalling = installingId === template.id

            return (
              <div key={template.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-apex-teal/10 text-apex-teal">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{template.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
                    {WORKFLOW_TRIGGER_LABELS[template.triggerType]}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
                    {template.steps.length} steps
                  </Badge>
                </div>

                {template.notes.length > 0 && (
                  <div className="mt-3 space-y-1 rounded-md bg-amber-50 p-2">
                    {template.notes.map((note, i) => (
                      <p key={i} className="flex gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => installTemplate(template)}
                    disabled={isInstalling}
                  >
                    {isInstalling ? "Adding…" : "Use Template"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
