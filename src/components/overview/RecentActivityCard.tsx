import { Bot } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { ACTIVITY_ICONS, ACTIVITY_LABELS } from "@/components/activities/activity-meta"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { ActivityWithAuthor, RelatedEntityType } from "@/types/activity"
import { profileDisplayName } from "@/types/profile"

const RELATED_PATHS: Partial<Record<RelatedEntityType, string>> = {
  lead: "/leads",
  contact: "/contacts",
  deal: "/deals",
}

interface RecentActivityCardProps {
  activities: ActivityWithAuthor[]
  isLoading: boolean
}

export function RecentActivityCard({ activities, isLoading }: RecentActivityCardProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-1">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type]
              const author = activity.performed_by_ai
                ? "AI Employee"
                : profileDisplayName(activity.author)
              const basePath = activity.related_to_type
                ? RELATED_PATHS[activity.related_to_type]
                : undefined
              const clickable = Boolean(basePath && activity.related_to_id)

              return (
                <li key={activity.id}>
                  <div
                    onClick={
                      clickable
                        ? () => navigate(`${basePath}/${activity.related_to_id}`)
                        : undefined
                    }
                    className={cn(
                      "flex gap-3 rounded-md p-1.5",
                      clickable && "cursor-pointer hover:bg-slate-50"
                    )}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      {activity.performed_by_ai ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-sm font-medium text-slate-800">
                          {ACTIVITY_LABELS[activity.type]}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatRelativeTime(activity.created_at)}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="mt-0.5 truncate text-sm text-slate-600">
                          {activity.description}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-400">{author}</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
