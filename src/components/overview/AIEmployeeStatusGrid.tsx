import { Calendar, Phone } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { AI_ROLE_LABELS } from "@/components/ai-workforce/ai-role-meta"
import { AiEmployeeAvatar } from "@/components/ai-workforce/AiEmployeeAvatar"
import { StatusDot } from "@/components/ai-workforce/StatusDot"
import { Skeleton } from "@/components/ui/skeleton"
import type { AiEmployeeWithTodayStats } from "@/hooks/useAiEmployees"

interface AIEmployeeStatusGridProps {
  employees: AiEmployeeWithTodayStats[]
  isLoading: boolean
}

export function AIEmployeeStatusGrid({ employees, isLoading }: AIEmployeeStatusGridProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">AI Employee Status</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))
        ) : employees.length === 0 ? (
          <p className="col-span-full py-6 text-center text-sm text-slate-400">
            No AI Employees yet.
          </p>
        ) : (
          employees.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => navigate(`/ai-employees/${employee.id}`)}
              className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-left hover:border-slate-300 hover:bg-slate-50"
            >
              <AiEmployeeAvatar role={employee.role} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {employee.name}
                  </span>
                  <StatusDot status={employee.status} showLabel={false} />
                </div>
                <p className="truncate text-xs text-slate-500">{AI_ROLE_LABELS[employee.role]}</p>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {employee.todayStats.calls}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {employee.todayStats.appointments}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
