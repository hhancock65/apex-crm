import { Activity, Phone, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { CreateAIEmployeeDialog } from "@/components/ai-workforce/CreateAIEmployeeDialog"
import { AIEmployeeStatusGrid } from "@/components/overview/AIEmployeeStatusGrid"
import { AIPerformanceThisMonthCard } from "@/components/overview/AIPerformanceThisMonthCard"
import { LiveAIActivityWidget } from "@/components/overview/LiveAIActivityWidget"
import { MetricCard } from "@/components/overview/MetricCard"
import { RecentCallsCard } from "@/components/overview/RecentCallsCard"
import { Button } from "@/components/ui/button"
import { useAICommandCenterMetrics, useAIPerformanceThisMonth } from "@/hooks/useAICommandCenter"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { DEFAULT_CALL_FILTERS, useCalls } from "@/hooks/useCalls"

const RECENT_CALLS_FILTERS = { ...DEFAULT_CALL_FILTERS, pageSize: 10 }

export default function AICommandCenterPage() {
  const navigate = useNavigate()
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false)

  const { data: employees, isLoading: employeesLoading } = useAiEmployees({
    refetchInterval: 30_000,
  })
  const { data: metrics, isLoading: metricsLoading } = useAICommandCenterMetrics()
  const { data: performance, isLoading: performanceLoading } = useAIPerformanceThisMonth()
  const { data: callsData, isLoading: callsLoading } = useCalls(RECENT_CALLS_FILTERS, {
    refetchInterval: 30_000,
  })

  const employeesOnline = useMemo(
    () => (employees ?? []).filter((employee) => employee.status === "online").length,
    [employees]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Command Center</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your entire AI Workforce's performance, in one place.
        </p>
      </div>

      {/* Top row — summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="AI Employees Online"
          isLoading={employeesLoading}
          value={
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              {employeesOnline}
            </span>
          }
          subtext={employees ? `of ${employees.length} total` : undefined}
        />
        <MetricCard
          label="Calls Answered Today"
          isLoading={metricsLoading}
          value={metrics?.callsToday ?? 0}
          delta={
            metrics
              ? { value: metrics.callsToday - metrics.callsYesterday, label: "vs yesterday" }
              : undefined
          }
        />
        <MetricCard
          label="Appointments Booked Today"
          isLoading={metricsLoading}
          value={metrics?.appointmentsToday ?? 0}
          delta={
            metrics
              ? {
                  value: metrics.appointmentsToday - metrics.appointmentsYesterday,
                  label: "vs yesterday",
                }
              : undefined
          }
        />
        <MetricCard
          label="Leads Captured Today"
          isLoading={metricsLoading}
          value={metrics?.leadsToday ?? 0}
          delta={
            metrics
              ? { value: metrics.leadsToday - metrics.leadsYesterday, label: "vs yesterday" }
              : undefined
          }
        />
      </div>

      {/* Second row — employee status + live activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AIEmployeeStatusGrid employees={employees ?? []} isLoading={employeesLoading} />
        <LiveAIActivityWidget limit={10} />
      </div>

      {/* Third row — performance this month + recent calls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AIPerformanceThisMonthCard performance={performance} isLoading={performanceLoading} />
        <RecentCallsCard calls={callsData?.calls ?? []} isLoading={callsLoading} />
      </div>

      {/* Bottom — quick actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setCreateEmployeeOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Create AI Employee
          </Button>
          <Button variant="outline" onClick={() => navigate("/calls")}>
            <Phone className="h-4 w-4" />
            View All Calls
          </Button>
          <Button variant="outline" onClick={() => navigate("/ai-activity")}>
            <Activity className="h-4 w-4" />
            View Full Activity
          </Button>
        </div>
      </div>

      <CreateAIEmployeeDialog open={createEmployeeOpen} onOpenChange={setCreateEmployeeOpen} />
    </div>
  )
}
