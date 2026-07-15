import { Phone, Calendar, Plus, UserPlus } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { AI_ROLE_ICONS, AI_ROLE_LABELS } from "@/components/ai-workforce/ai-role-meta"
import { CreateAIEmployeeDialog } from "@/components/ai-workforce/CreateAIEmployeeDialog"
import { StatusDot } from "@/components/ai-workforce/StatusDot"
import { FeatureGate, UpgradeInlineButton } from "@/components/billing/FeatureGate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiEmployees } from "@/hooks/useAiEmployees"

export default function AIEmployeesPage() {
  const navigate = useNavigate()
  const { data: employees, isLoading } = useAiEmployees()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading
              ? "Loading…"
              : `${employees?.length ?? 0} AI employee${employees?.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <FeatureGate
          feature="ai_builder"
          fallback={<UpgradeInlineButton feature="ai_builder" label="Create AI Employee" />}
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create AI Employee
          </Button>
        </FeatureGate>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
              <Skeleton className="mt-4 h-10 w-full" />
              <Skeleton className="mt-4 h-9 w-full" />
            </div>
          ))
        ) : !employees || employees.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <UserPlus className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No AI Employees yet.</p>
            <FeatureGate
              feature="ai_builder"
              fallback={<UpgradeInlineButton feature="ai_builder" label="Create your first AI Employee" />}
            >
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create your first AI Employee
              </Button>
            </FeatureGate>
          </div>
        ) : (
          employees.map((employee) => {
            const RoleIcon = AI_ROLE_ICONS[employee.role]
            return (
              <div
                key={employee.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-apex-navy/5 text-apex-navy">
                      <RoleIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{employee.name}</p>
                      <p className="text-xs text-slate-500">{AI_ROLE_LABELS[employee.role]}</p>
                    </div>
                  </div>
                  <StatusDot status={employee.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2.5 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                      <Phone className="h-3 w-3" />
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {employee.todayStats.calls}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Calls</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                      <Calendar className="h-3 w-3" />
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {employee.todayStats.appointments}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Appts</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-slate-400">
                      <UserPlus className="h-3 w-3" />
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {employee.todayStats.leads}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Leads</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate(`/ai-employees/${employee.id}`)}
                >
                  View Employee
                </Button>
              </div>
            )
          })
        )}
      </div>

      <CreateAIEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
