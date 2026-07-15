import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { useOrgProfiles } from "@/hooks/useOrgProfiles"
import { useSmsTemplates } from "@/hooks/useSmsTemplates"
import { getUpdateRecordTarget, type BuilderStep } from "@/lib/workflow-builder"
import { profileDisplayName } from "@/types/profile"
import type { WorkflowTriggerType } from "@/types/workflow"

import { EMAIL_TEMPLATE_NAMES, STEP_TYPE_LABELS, UNIMPLEMENTED_STEP_TYPES } from "./step-meta"

interface ConfigFormProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}

function set(config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return { ...config, [key]: value }
}

function WaitConfig({ config, onChange }: ConfigFormProps) {
  const mode = (config.mode as string | undefined) ?? "duration"

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Wait type</Label>
        <Select
          value={mode}
          onValueChange={(value) =>
            onChange(value === "duration" ? { mode: "duration" } : { mode: "relative_to_trigger_field" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="duration">For a fixed amount of time</SelectItem>
            <SelectItem value="relative_to_trigger_field">Until a set time before/after an event</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "duration" ? (
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              className="w-24"
              value={(config.duration_value as number | string | undefined) ?? ""}
              onChange={(e) => onChange(set(config, "duration_value", Number(e.target.value) || undefined))}
            />
            <Select
              value={(config.duration_unit as string | undefined) ?? "minutes"}
              onValueChange={(value) => onChange(set(config, "duration_unit", value))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Timestamp field</Label>
            <Input
              placeholder="e.g. start_time"
              value={(config.field as string | undefined) ?? ""}
              onChange={(e) => onChange(set(config, "field", e.target.value))}
            />
            <p className="text-xs text-slate-400">
              A timestamp from this workflow's trigger data, e.g. an appointment's start_time.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Minutes before that time (negative for after)</Label>
            <Input
              type="number"
              value={(config.offset_minutes as number | string | undefined) ?? ""}
              onChange={(e) => onChange(set(config, "offset_minutes", Number(e.target.value) || undefined))}
            />
          </div>
        </>
      )}
    </div>
  )
}

function SendSmsConfig({ config, onChange }: ConfigFormProps) {
  const { data: templates } = useSmsTemplates()
  const useTemplate = Boolean(config.template_name)

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Sent to the contact from this workflow's trigger.</p>

      <div className="space-y-1.5">
        <Label>Message type</Label>
        <Select
          value={useTemplate ? "template" : "custom"}
          onValueChange={(value) =>
            onChange(
              value === "template"
                ? { template_name: templates?.[0]?.name ?? "" }
                : { message_text: "" }
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="template">Use a template</SelectItem>
            <SelectItem value="custom">Write custom message</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {useTemplate ? (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select
            value={(config.template_name as string | undefined) ?? ""}
            onValueChange={(value) => onChange(set(config, "template_name", value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((template) => (
                <SelectItem key={template.id} value={template.name}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea
            rows={4}
            value={(config.message_text as string | undefined) ?? ""}
            onChange={(e) => onChange(set(config, "message_text", e.target.value))}
          />
        </div>
      )}
    </div>
  )
}

function SendEmailConfig({ config, onChange }: ConfigFormProps) {
  const useTemplate = Boolean(config.template_name)

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Sent to the contact from this workflow's trigger.</p>

      <div className="space-y-1.5">
        <Label>Message type</Label>
        <Select
          value={useTemplate ? "template" : "custom"}
          onValueChange={(value) =>
            onChange(
              value === "template"
                ? { template_name: EMAIL_TEMPLATE_NAMES[0] }
                : { subject: "", body_text: "" }
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="template">Use a template</SelectItem>
            <SelectItem value="custom">Write custom email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {useTemplate ? (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select
            value={(config.template_name as string | undefined) ?? ""}
            onValueChange={(value) => onChange(set(config, "template_name", value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TEMPLATE_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={(config.subject as string | undefined) ?? ""}
              onChange={(e) => onChange(set(config, "subject", e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              rows={5}
              value={(config.body_text as string | undefined) ?? ""}
              onChange={(e) => onChange(set(config, "body_text", e.target.value))}
            />
          </div>
        </>
      )}
    </div>
  )
}

function AiCallConfig({ config, onChange }: ConfigFormProps) {
  const { data: employees } = useAiEmployees()

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>AI Employee</Label>
        <Select
          value={(config.ai_employee_id as string | undefined) ?? ""}
          onValueChange={(value) => onChange(set(config, "ai_employee_id", value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose an AI Employee" />
          </SelectTrigger>
          <SelectContent>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>What to say / do</Label>
        <Textarea
          rows={4}
          placeholder="e.g. Call the lead, confirm their interest, and offer to book a consultation."
          value={(config.instructions as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "instructions", e.target.value))}
        />
      </div>
    </div>
  )
}

function CreateTaskConfig({ config, onChange }: ConfigFormProps) {
  const { data: profiles } = useOrgProfiles()

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={(config.title as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "title", e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          rows={3}
          value={(config.description as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "description", e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Assign to</Label>
        <Select
          value={(config.assigned_to as string | undefined) ?? ""}
          onValueChange={(value) => onChange(set(config, "assigned_to", value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            {profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profileDisplayName(profile)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Due</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            className="w-24"
            value={(config.due_offset_value as number | string | undefined) ?? ""}
            onChange={(e) => {
              const offsetValue = Number(e.target.value) || 0
              const unit = (config.due_offset_unit as string | undefined) ?? "hours"
              onChange({
                ...config,
                due_offset_value: offsetValue,
                due_offset_unit: unit,
                due_in_hours: offsetValue * (unit === "days" ? 24 : 1),
              })
            }}
          />
          <Select
            value={(config.due_offset_unit as string | undefined) ?? "hours"}
            onValueChange={(unit) => {
              const offsetValue = (config.due_offset_value as number | undefined) ?? 0
              onChange({
                ...config,
                due_offset_unit: unit,
                due_in_hours: offsetValue * (unit === "days" ? 24 : 1),
              })
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours after this step runs</SelectItem>
              <SelectItem value="days">Days after this step runs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

function UpdateRecordConfig({
  config,
  onChange,
  triggerType,
}: ConfigFormProps & { triggerType: WorkflowTriggerType }) {
  const target = getUpdateRecordTarget(triggerType)

  if (!target) {
    return (
      <p className="text-sm text-amber-700">
        This trigger doesn't have a record to update — pick a lead, deal, contact, or appointment trigger
        to use this step.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Updating {target.label} from this workflow's trigger.</p>
      <div className="space-y-1.5">
        <Label>Field</Label>
        <Input
          placeholder="e.g. status"
          value={(config.field as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "field", e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>New Value</Label>
        <Input
          value={(config.value as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "value", e.target.value))}
        />
      </div>
    </div>
  )
}

const CONDITION_OPERATORS = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "contains", label: "Contains" },
  { value: "exists", label: "Exists" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
]

const VALUELESS_OPERATORS = new Set(["exists", "is_empty", "is_not_empty"])

function ConditionConfig({ config, onChange }: ConfigFormProps) {
  const operator = (config.operator as string | undefined) ?? "eq"

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Field</Label>
        <Input
          placeholder="e.g. status, contact.tags, deal.value"
          value={(config.field as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "field", e.target.value))}
        />
        <p className="text-xs text-slate-400">
          A field from this workflow's trigger data, or contact./deal./lead. plus a field name.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Operator</Label>
        <Select value={operator} onValueChange={(value) => onChange(set(config, "operator", value))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!VALUELESS_OPERATORS.has(operator) && (
        <div className="space-y-1.5">
          <Label>Value</Label>
          <Input
            value={(config.value as string | undefined) ?? ""}
            onChange={(e) => onChange(set(config, "value", e.target.value))}
          />
        </div>
      )}
    </div>
  )
}

const WEBHOOK_METHODS = ["POST", "GET", "PUT", "PATCH", "DELETE"]

function WebhookConfig({ config, onChange }: ConfigFormProps) {
  const [bodyText, setBodyText] = useState(() => (config.body ? JSON.stringify(config.body, null, 2) : ""))
  const [bodyError, setBodyError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>URL</Label>
        <Input
          placeholder="https://example.com/webhook"
          value={(config.url as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "url", e.target.value))}
        />
        <p className="text-xs text-slate-400">Must be https:// — private/internal addresses are blocked.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Method</Label>
        <Select
          value={(config.method as string | undefined) ?? "POST"}
          onValueChange={(value) => onChange(set(config, "method", value))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEBHOOK_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Body (JSON, optional)</Label>
        <Textarea
          rows={4}
          placeholder={"{\n  \"note\": \"defaults to { trigger_data } if left blank\"\n}"}
          value={bodyText}
          onChange={(e) => {
            const text = e.target.value
            setBodyText(text)
            if (!text.trim()) {
              setBodyError(null)
              onChange(set(config, "body", undefined))
              return
            }
            try {
              const parsed = JSON.parse(text)
              setBodyError(null)
              onChange(set(config, "body", parsed))
            } catch {
              setBodyError("Not valid JSON — keeping the last valid body.")
            }
          }}
        />
        {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
      </div>
    </div>
  )
}

function NotificationConfig({ config, onChange }: ConfigFormProps) {
  const { data: profiles } = useOrgProfiles()

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={(config.title as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "title", e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Message</Label>
        <Textarea
          rows={3}
          value={(config.message as string | undefined) ?? ""}
          onChange={(e) => onChange(set(config, "message", e.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Recipient</Label>
        <Select
          value={(config.user_id as string | undefined) ?? ""}
          onValueChange={(value) => onChange(set(config, "user_id", value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a team member" />
          </SelectTrigger>
          <SelectContent>
            {profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profileDisplayName(profile)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

interface StepConfigPanelProps {
  step: BuilderStep
  triggerType: WorkflowTriggerType
  onChange: (config: Record<string, unknown>) => void
}

export function StepConfigPanel({ step, triggerType, onChange }: StepConfigPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{STEP_TYPE_LABELS[step.type]}</h3>

      {UNIMPLEMENTED_STEP_TYPES.includes(step.type) && (
        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          This step type can be configured here, but isn't executed yet in the automation engine.
        </p>
      )}

      <div className="mt-3">
        {step.type === "wait" && <WaitConfig config={step.config} onChange={onChange} />}
        {step.type === "send_sms" && <SendSmsConfig config={step.config} onChange={onChange} />}
        {step.type === "send_email" && <SendEmailConfig config={step.config} onChange={onChange} />}
        {step.type === "ai_call" && <AiCallConfig config={step.config} onChange={onChange} />}
        {step.type === "create_task" && <CreateTaskConfig config={step.config} onChange={onChange} />}
        {step.type === "update_record" && (
          <UpdateRecordConfig config={step.config} onChange={onChange} triggerType={triggerType} />
        )}
        {step.type === "condition" && <ConditionConfig config={step.config} onChange={onChange} />}
        {step.type === "notification" && <NotificationConfig config={step.config} onChange={onChange} />}
        {step.type === "webhook" && <WebhookConfig config={step.config} onChange={onChange} />}
      </div>
    </div>
  )
}
