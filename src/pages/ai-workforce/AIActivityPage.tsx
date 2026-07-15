import { Volume2, VolumeX } from "lucide-react"
import { useState } from "react"

import { AiActionResultBadge } from "@/components/ai-workforce/AiActionResultBadge"
import { AI_ACTION_ICONS, AI_ACTION_LABELS } from "@/components/ai-workforce/ai-action-meta"
import { AiEmployeeAvatar } from "@/components/ai-workforce/AiEmployeeAvatar"
import { MetricCard } from "@/components/overview/MetricCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import {
  getDefaultAiActivityFilters,
  useAIActivityFeed,
  useAIActivityRealtime,
  useAIActivityStats,
} from "@/hooks/useAIActivity"
import { cn, formatDateTime, toDateInputValue } from "@/lib/utils"
import { AI_ACTION_TYPES, type AiActionType } from "@/types/ai-action"

const ACTION_TYPE_LABELS: Record<AiActionType, string> = AI_ACTION_LABELS

const SOUND_STORAGE_KEY = "apex-ai-activity-sound-enabled"

export default function AIActivityPage() {
  const [timeScope, setTimeScope] = useState<"today" | "all">("today")
  const [filters, setFilters] = useState(getDefaultAiActivityFilters)
  const [soundEnabled, setSoundEnabled] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SOUND_STORAGE_KEY) === "true"
  )
  const [justArrivedIds, setJustArrivedIds] = useState<Set<string>>(new Set())

  const { data, isLoading, isFetching, error } = useAIActivityFeed(filters)
  const { data: stats, isLoading: statsLoading } = useAIActivityStats(timeScope)
  const { data: employees } = useAiEmployees()

  useAIActivityRealtime({
    soundEnabled,
    onInsert: (row) => {
      setJustArrivedIds((prev) => new Set(prev).add(row.id))
      setTimeout(() => {
        setJustArrivedIds((prev) => {
          const next = new Set(prev)
          next.delete(row.id)
          return next
        })
      }, 4000)
    },
  })

  const actions = data?.actions ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize))

  function updateFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  function handleScopeChange(scope: "today" | "all") {
    setTimeScope(scope)
    setFilters((prev) => ({
      ...prev,
      dateFrom: scope === "today" ? toDateInputValue(new Date()) : "",
      dateTo: "",
      page: 1,
    }))
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem(SOUND_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live feed of everything your AI Workforce is doing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
            title={soundEnabled ? "Sound on for new appointments" : "Sound off"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-apex-teal" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
          </Button>

          <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => handleScopeChange("today")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                timeScope === "today" ? "bg-apex-teal text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("all")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                timeScope === "all" ? "bg-apex-teal text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={timeScope === "today" ? "Total Actions Today" : "Total Actions"}
          isLoading={statsLoading}
          value={stats?.totalActions ?? 0}
        />
        <MetricCard
          label="Calls Answered"
          isLoading={statsLoading}
          value={stats?.callsAnswered ?? 0}
        />
        <MetricCard
          label="Appointments Booked"
          isLoading={statsLoading}
          value={stats?.appointmentsBooked ?? 0}
        />
        <MetricCard
          label="Leads Captured"
          isLoading={statsLoading}
          value={stats?.leadsCaptured ?? 0}
        />
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Select value={filters.aiEmployeeId} onValueChange={(v) => updateFilter("aiEmployeeId", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="AI Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.actionType}
          onValueChange={(v) => updateFilter("actionType", v as AiActionType | "all")}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Action Types</SelectItem>
            {AI_ACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ACTION_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Feed */}
      <div className={cn("mt-4 space-y-2", isFetching && "opacity-60")}>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading activity…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">
            Failed to load activity: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : actions.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No AI activity yet.</p>
        ) : (
          actions.map((action) => {
            const Icon = AI_ACTION_ICONS[action.action_type]
            const isNew = justArrivedIds.has(action.id)

            return (
              <div
                key={action.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3",
                  isNew && "animate-highlight-flash"
                )}
              >
                {action.ai_employee ? (
                  <AiEmployeeAvatar role={action.ai_employee.role} />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {action.ai_employee?.name ?? "Unknown employee"}
                    </span>
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-600">{AI_ACTION_LABELS[action.action_type]}</span>
                  </div>
                  {action.description && (
                    <p className="mt-0.5 truncate text-sm text-slate-500">{action.description}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <AiActionResultBadge result={action.result} />
                  <span className="w-[130px] shrink-0 text-right text-xs text-slate-400">
                    {formatDateTime(action.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={filters.page}
            pageCount={pageCount}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </div>
      )}
    </div>
  )
}
