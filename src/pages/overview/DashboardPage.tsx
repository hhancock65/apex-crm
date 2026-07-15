import { useState } from "react"

import { PaymentFailedBanner } from "@/components/billing/PaymentFailedBanner"
import { AppointmentDetailDialog } from "@/components/productivity/AppointmentDetailDialog"
import { LeadSourcesCard } from "@/components/overview/LeadSourcesCard"
import { LiveAIActivityWidget } from "@/components/overview/LiveAIActivityWidget"
import { MetricCard } from "@/components/overview/MetricCard"
import { PipelineSummaryCard } from "@/components/overview/PipelineSummaryCard"
import { QuickActionsBar } from "@/components/overview/QuickActionsBar"
import { RecentActivityCard } from "@/components/overview/RecentActivityCard"
import { UpcomingAppointmentsCard } from "@/components/overview/UpcomingAppointmentsCard"
import { useAppointments } from "@/hooks/useAppointments"
import {
  useDashboardMetrics,
  useDealValuesByStage,
  useLeadSourceBreakdown,
  useRecentActivities,
} from "@/hooks/useDashboard"
import { usePipelines, usePipelineStages } from "@/hooks/usePipelines"
import { formatCurrency, toDateInputValue } from "@/lib/utils"
import type { AppointmentWithRelations } from "@/types/appointment"

export default function DashboardPage() {
  const [activeAppointment, setActiveAppointment] = useState<AppointmentWithRelations | null>(
    null
  )

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics()

  const { data: pipelines } = usePipelines()
  const defaultPipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0]
  const { data: stages, isLoading: stagesLoading } = usePipelineStages(defaultPipeline?.id)
  const { data: dealValues, isLoading: dealValuesLoading } = useDealValuesByStage(
    defaultPipeline?.id
  )

  const { data: leadSources, isLoading: leadSourcesLoading } = useLeadSourceBreakdown()

  const { data: activities, isLoading: activitiesLoading } = useRecentActivities(20)

  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointments({
    type: "all",
    status: "all",
    dateFrom: toDateInputValue(new Date()),
    dateTo: "",
    page: 1,
    pageSize: 10,
    sortBy: "start_time",
    sortDir: "asc",
  })

  return (
    <div className="space-y-6">
      <PaymentFailedBanner />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Your CRM and AI workforce at a glance.</p>
      </div>

      {/* Top row — metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Leads"
          isLoading={metricsLoading}
          value={metrics?.totalActiveLeads ?? 0}
          delta={
            metrics
              ? { value: metrics.leadsDelta30d, label: "vs last 30 days" }
              : undefined
          }
        />
        <MetricCard
          label="Open Deals"
          isLoading={metricsLoading}
          value={metrics?.openDealsCount ?? 0}
          subtext={metrics ? formatCurrency(metrics.openDealsValue) : undefined}
        />
        <MetricCard
          label="Appointments Today"
          isLoading={metricsLoading}
          value={metrics?.appointmentsToday ?? 0}
        />
        <MetricCard
          label="Tasks Due"
          isLoading={metricsLoading}
          value={(metrics?.tasksOverdue ?? 0) + (metrics?.tasksDueToday ?? 0)}
          subtext={
            metrics ? (
              <span>
                <span className={metrics.tasksOverdue > 0 ? "font-semibold text-red-600" : ""}>
                  {metrics.tasksOverdue} overdue
                </span>
                {" · "}
                {metrics.tasksDueToday} due today
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Second row — pipeline summary + lead sources */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PipelineSummaryCard
          stages={stages ?? []}
          dealValues={dealValues ?? {}}
          isLoading={stagesLoading || dealValuesLoading}
        />
        <LeadSourcesCard breakdown={leadSources ?? []} isLoading={leadSourcesLoading} />
      </div>

      {/* Third row — recent activity + upcoming appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityCard activities={activities ?? []} isLoading={activitiesLoading} />
        <UpcomingAppointmentsCard
          appointments={appointmentsData?.appointments ?? []}
          isLoading={appointmentsLoading}
          onSelect={setActiveAppointment}
        />
      </div>

      {/* Fourth row — live AI activity */}
      <LiveAIActivityWidget />

      {/* Bottom row — quick actions */}
      <QuickActionsBar />

      <AppointmentDetailDialog
        appointment={activeAppointment}
        open={Boolean(activeAppointment)}
        onOpenChange={(open) => !open && setActiveAppointment(null)}
      />
    </div>
  )
}
