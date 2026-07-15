import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSupabaseClient } from "@/lib/clerk-supabase"
import { invokeWithRetry } from "@/lib/edge-functions"
import type { OrgRole } from "@/types/profile"

export const teamKeys = {
  list: ["team-management", "list"] as const,
}

export interface TeamMember {
  clerkUserId: string
  profileId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  role: OrgRole | null
  status: "active" | "invited"
  lastActiveAt: number | null
}

export interface PendingInvitation {
  id: string
  email: string
  role: OrgRole
  createdAt: number
}

interface TeamListResponse {
  members: TeamMember[]
  pendingInvitations: PendingInvitation[]
}

/** Team roster + pending invitations, sourced live from Clerk's Backend API
 *  (org membership is the real source of "who's on this team") merged with
 *  Supabase profiles (Apex's own role). Owner/admin only — the Edge
 *  Function itself enforces this regardless of what calls it. */
export function useTeamManagement() {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: teamKeys.list,
    queryFn: () => invokeWithRetry<TeamListResponse>(supabase, "team-management", { action: "list" }),
    staleTime: 30_000,
  })
}

export function useInviteTeamMember() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { email: string; role: OrgRole }) =>
      invokeWithRetry<{ success: true; invitationId: string }>(supabase, "team-management", {
        action: "invite",
        ...input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.list }),
  })
}

export function useUpdateTeamMemberRole() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { profileId: string; role: OrgRole }) =>
      invokeWithRetry<{ success: true }>(supabase, "team-management", {
        action: "update_role",
        ...input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.list }),
  })
}

export function useRemoveTeamMember() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { profileId: string }) =>
      invokeWithRetry<{ success: true }>(supabase, "team-management", {
        action: "remove",
        ...input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.list }),
  })
}

export function useRevokeInvitation() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { invitationId: string }) =>
      invokeWithRetry<{ success: true }>(supabase, "team-management", {
        action: "revoke_invitation",
        ...input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.list }),
  })
}
