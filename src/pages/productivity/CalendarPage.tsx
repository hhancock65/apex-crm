import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { AddAppointmentDialog } from "@/components/productivity/AddAppointmentDialog"
import { AppointmentDetailDialog } from "@/components/productivity/AppointmentDetailDialog"
import { TaskDetailDialog } from "@/components/productivity/TaskDetailDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDefaultAppointmentFilters, useAppointments } from "@/hooks/useAppointments"
import { DEFAULT_TASK_FILTERS, useTasks } from "@/hooks/useTasks"
import { cn, formatTimeOnly, toDateInputValue } from "@/lib/utils"
import type { AppointmentWithRelations } from "@/types/appointment"
import type { TaskPriority, TaskWithRelated } from "@/types/task"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const PRIORITY_DOT_COLOR: Record<TaskPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthGridDays(monthDate: Date): Date[] {
  const firstOfMonth = startOfMonth(monthDate)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

interface DayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  tasks: TaskWithRelated[]
  appointments: AppointmentWithRelations[]
  onSelectDay: (date: Date) => void
  onSelectTask: (task: TaskWithRelated) => void
  onSelectAppointment: (appointment: AppointmentWithRelations) => void
}

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  tasks,
  appointments,
  onSelectDay,
  onSelectTask,
  onSelectAppointment,
}: DayCellProps) {
  const items: { key: string; render: () => ReactNode }[] = [
    ...appointments.map((appointment) => ({
      key: `apt-${appointment.id}`,
      render: () => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelectAppointment(appointment)
          }}
          className="block w-full truncate rounded bg-apex-teal/10 px-1 py-0.5 text-left text-[10px] text-apex-teal hover:bg-apex-teal/20"
        >
          {formatTimeOnly(appointment.start_time)} {appointment.title}
        </button>
      ),
    })),
    ...tasks.map((task) => ({
      key: `task-${task.id}`,
      render: () => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelectTask(task)
          }}
          className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-slate-100"
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT_COLOR[task.priority])} />
          <span className="truncate text-slate-600">{task.title}</span>
        </button>
      ),
    })),
  ]

  const visible = items.slice(0, 3)
  const overflow = items.length - visible.length

  return (
    <div
      onClick={() => onSelectDay(date)}
      className={cn(
        "flex min-h-[110px] cursor-pointer flex-col gap-1 border-b border-r border-slate-100 p-1.5 hover:bg-slate-50",
        !isCurrentMonth && "bg-slate-50/60"
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
          isToday && "bg-apex-teal text-white",
          !isToday && isCurrentMonth && "text-slate-700",
          !isToday && !isCurrentMonth && "text-slate-300"
        )}
      >
        {date.getDate()}
      </span>
      <div className="flex-1 space-y-0.5 overflow-hidden">
        {visible.map((item) => (
          <div key={item.key}>{item.render()}</div>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelectDay(date)
            }}
            className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  )
}

interface DayDetailDialogProps {
  date: Date | null
  tasks: TaskWithRelated[]
  appointments: AppointmentWithRelations[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTask: (task: TaskWithRelated) => void
  onSelectAppointment: (appointment: AppointmentWithRelations) => void
  onAddAppointment: () => void
}

function DayDetailDialog({
  date,
  tasks,
  appointments,
  open,
  onOpenChange,
  onSelectTask,
  onSelectAppointment,
  onAddAppointment,
}: DayDetailDialogProps) {
  if (!date) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Appointments
              </h3>
              <Button variant="ghost" size="sm" onClick={onAddAppointment} className="h-7 px-2">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {appointments.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => onSelectAppointment(appointment)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="truncate text-slate-700">{appointment.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatTimeOnly(appointment.start_time)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No appointments.</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tasks</h3>
            {tasks.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT_COLOR[task.priority])}
                      />
                      <span className="truncate text-slate-700">{task.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No tasks.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [activeTask, setActiveTask] = useState<TaskWithRelated | null>(null)
  const [activeAppointment, setActiveAppointment] = useState<AppointmentWithRelations | null>(null)
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false)
  const [addAppointmentDate, setAddAppointmentDate] = useState<Date | undefined>(undefined)

  const gridDays = useMemo(() => getMonthGridDays(currentMonth), [currentMonth])
  const rangeStart = toDateInputValue(gridDays[0])
  const rangeEnd = toDateInputValue(gridDays[gridDays.length - 1])

  const { data: tasksData } = useTasks({
    ...DEFAULT_TASK_FILTERS,
    dueFrom: rangeStart,
    dueTo: rangeEnd,
    pageSize: 500,
  })

  const { data: appointmentsData } = useAppointments({
    ...getDefaultAppointmentFilters(),
    dateFrom: rangeStart,
    dateTo: rangeEnd,
    pageSize: 500,
  })

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelated[]>()
    for (const task of tasksData?.tasks ?? []) {
      if (!task.due_date) continue
      const key = toDateInputValue(new Date(task.due_date))
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    return map
  }, [tasksData])

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>()
    for (const appointment of appointmentsData?.appointments ?? []) {
      const key = toDateInputValue(new Date(appointment.start_time))
      const list = map.get(key) ?? []
      list.push(appointment)
      map.set(key, list)
    }
    return map
  }, [appointmentsData])

  const todayKey = toDateInputValue(new Date())

  function goToPreviousMonth() {
    setCurrentMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() - 1)
      return next
    })
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + 1)
      return next
    })
  }

  function goToToday() {
    setCurrentMonth(startOfMonth(new Date()))
  }

  const selectedDateKey = selectedDate ? toDateInputValue(selectedDate) : null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Tasks and appointments for the month.</p>
        </div>
        <Button
          onClick={() => {
            setAddAppointmentDate(undefined)
            setAddAppointmentOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Add Appointment
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-t-lg border border-b-0 border-slate-200 bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-800">
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-x border-t border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 rounded-b-lg border-l border-slate-200">
        {gridDays.map((date) => {
          const key = toDateInputValue(date)
          return (
            <DayCell
              key={key}
              date={date}
              isCurrentMonth={date.getMonth() === currentMonth.getMonth()}
              isToday={key === todayKey}
              tasks={tasksByDay.get(key) ?? []}
              appointments={appointmentsByDay.get(key) ?? []}
              onSelectDay={setSelectedDate}
              onSelectTask={setActiveTask}
              onSelectAppointment={setActiveAppointment}
            />
          )
        })}
      </div>

      <DayDetailDialog
        date={selectedDate}
        tasks={selectedDateKey ? tasksByDay.get(selectedDateKey) ?? [] : []}
        appointments={selectedDateKey ? appointmentsByDay.get(selectedDateKey) ?? [] : []}
        open={Boolean(selectedDate)}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        onSelectTask={(task) => {
          setSelectedDate(null)
          setActiveTask(task)
        }}
        onSelectAppointment={(appointment) => {
          setSelectedDate(null)
          setActiveAppointment(appointment)
        }}
        onAddAppointment={() => {
          setAddAppointmentDate(selectedDate ?? undefined)
          setSelectedDate(null)
          setAddAppointmentOpen(true)
        }}
      />

      <TaskDetailDialog
        task={activeTask}
        open={Boolean(activeTask)}
        onOpenChange={(open) => !open && setActiveTask(null)}
      />
      <AppointmentDetailDialog
        appointment={activeAppointment}
        open={Boolean(activeAppointment)}
        onOpenChange={(open) => !open && setActiveAppointment(null)}
      />
      <AddAppointmentDialog
        open={addAppointmentOpen}
        onOpenChange={setAddAppointmentOpen}
        defaultDate={addAppointmentDate}
      />
    </div>
  )
}
