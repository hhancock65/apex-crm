import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsRealtime,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Notification } from "@/types/notification"

export function NotificationBell() {
  const navigate = useNavigate()
  const { data: notifications, isLoading } = useNotifications(10)
  const { data: unreadCount } = useUnreadNotificationCount()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  useNotificationsRealtime()

  const count = unreadCount ?? 0

  function handleSelect(notification: Notification) {
    if (!notification.read) {
      markRead.mutate(notification.id)
    }
    if (notification.related_to_type === "transfer") {
      navigate("/ai-activity")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5 text-slate-500" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {count > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-apex-teal hover:underline"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <p className="px-2 py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : !notifications || notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => handleSelect(notification)}
                className={cn(
                  "flex flex-col items-start gap-0.5 whitespace-normal py-2",
                  !notification.read && "bg-apex-teal/5"
                )}
              >
                <div className="flex w-full items-center gap-2">
                  {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-apex-teal" />}
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">
                    {notification.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </div>
                {notification.message && (
                  <p className="line-clamp-2 text-xs text-slate-500">{notification.message}</p>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
