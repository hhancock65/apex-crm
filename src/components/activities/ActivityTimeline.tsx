import { Bot } from "lucide-react"

import { ACTIVITY_ICONS, ACTIVITY_LABELS } from "@/components/activities/activity-meta"
import { formatDateTime } from "@/lib/utils"
import type { ActivityWithAuthor } from "@/types/activity"
import { profileDisplayName } from "@/types/profile"

export function ActivityTimeline({ activities }: { activities: ActivityWithAuthor[] }) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        No activity yet.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.type]
        const author = activity.performed_by_ai
          ? "AI Employee"
          : profileDisplayName(activity.author)

        return (
          <li key={activity.id} className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              {activity.performed_by_ai ? <Bot className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-medium text-slate-800">
                  {ACTIVITY_LABELS[activity.type]}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDateTime(activity.created_at)}
                </span>
              </div>
              {activity.description && (
                <p className="mt-0.5 text-sm text-slate-600">{activity.description}</p>
              )}
              <p className="mt-0.5 text-xs text-slate-400">{author}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
