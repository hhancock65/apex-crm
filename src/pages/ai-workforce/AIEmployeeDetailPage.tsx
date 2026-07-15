import { ArrowLeft } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { AI_ROLE_LABELS } from "@/components/ai-workforce/ai-role-meta"
import { AiEmployeeActionsTab } from "@/components/ai-workforce/AiEmployeeActionsTab"
import { AiEmployeeCallsTab } from "@/components/ai-workforce/AiEmployeeCallsTab"
import { AiEmployeeConfigTab } from "@/components/ai-workforce/AiEmployeeConfigTab"
import { AiEmployeeOverviewTab } from "@/components/ai-workforce/AiEmployeeOverviewTab"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAiEmployee, useAiEmployeeTodayStats, useUpdateAiEmployee } from "@/hooks/useAiEmployees"
import { AI_EMPLOYEE_STATUSES, type AiEmployeeStatus } from "@/types/ai-employee"

const STATUS_LABELS: Record<AiEmployeeStatus, string> = {
  online: "Online",
  offline: "Offline",
  paused: "Paused",
}

function StatTile({
  label,
  total,
  today,
  isLoading,
}: {
  label: string
  total: number
  today: number | undefined
  isLoading: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{total}</div>
      {isLoading ? (
        <Skeleton className="mt-1 h-3 w-16" />
      ) : (
        <div className="mt-1 text-xs text-slate-500">{today ?? 0} today</div>
      )}
    </div>
  )
}

export default function AIEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: employee, isLoading, error } = useAiEmployee(id)
  const { data: todayStats, isLoading: todayStatsLoading } = useAiEmployeeTodayStats(id)
  const updateEmployee = useUpdateAiEmployee()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading AI Employee…
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>AI Employee not found.</p>
        <Button variant="outline" onClick={() => navigate("/ai-employees")}>
          Back to AI Employees
        </Button>
      </div>
    )
  }

  async function handleStatusChange(status: AiEmployeeStatus) {
    try {
      await updateEmployee.mutateAsync({ id: employee!.id, updates: { status } })
      toast.success(`${employee!.name} is now ${STATUS_LABELS[status].toLowerCase()}`)
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <Link
        to="/ai-employees"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AI Employees
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{AI_ROLE_LABELS[employee.role]}</p>
        </div>

        <Select value={employee.status} onValueChange={(v) => handleStatusChange(v as AiEmployeeStatus)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_EMPLOYEE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Calls"
          total={employee.total_calls}
          today={todayStats?.calls}
          isLoading={todayStatsLoading}
        />
        <StatTile
          label="Leads Captured"
          total={employee.total_leads}
          today={todayStats?.leads}
          isLoading={todayStatsLoading}
        />
        <StatTile
          label="Appointments Booked"
          total={employee.total_appointments}
          today={todayStats?.appointments}
          isLoading={todayStatsLoading}
        />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <AiEmployeeOverviewTab employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="calls">
            <AiEmployeeCallsTab employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="actions">
            <AiEmployeeActionsTab employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="configuration">
            <AiEmployeeConfigTab employee={employee} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
