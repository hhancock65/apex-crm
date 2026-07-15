import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useEffect } from "react"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { playNotificationChime } from "@/lib/notification-sound"
import type { Notification } from "@/types/notification"

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
}

/** RLS on `notifications` already restricts every query here to the
 *  signed-in user's own rows (see get_current_profile_id() in migration
 *  0010) — no user_id filter needed client-side, same as `organizations`. */
export function useNotifications(limit = 10) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: [...notificationKeys.lists(), limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as Notification[]
    },
  })
}

export function useUnreadNotificationCount() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useMarkNotificationRead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() })
    },
  })
}

/** Same realtime idiom as useAIActivityRealtime — INSERT-only subscription,
 *  RLS filters broadcasts down to the signed-in user's own rows. */
export function useNotificationsRealtime({ soundEnabled = true }: { soundEnabled?: boolean } = {}) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel("notifications_inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
          queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() })
          if (soundEnabled) playNotificationChime()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, soundEnabled])
}
