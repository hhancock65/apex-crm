import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getCurrentOrgId } from "@/hooks/useCurrentOrgId"
import { useSupabaseClient } from "@/lib/clerk-supabase"
import { toDateInputValue } from "@/lib/utils"
import type {
  AppointmentStatus,
  AppointmentType,
  AppointmentWithRelations,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/types/appointment"

const APPOINTMENT_RELATIONS_SELECT = `
  *,
  contact:contacts!appointments_contact_id_fkey(id, first_name, last_name, email, phone),
  assigned_profile:profiles!appointments_assigned_to_fkey(id, first_name, last_name, email)
`

export type AppointmentSortColumn = "start_time" | "created_at"

export interface AppointmentFilters {
  type: AppointmentType | "all"
  status: AppointmentStatus | "all"
  dateFrom: string
  dateTo: string
  page: number
  pageSize: number
  sortBy: AppointmentSortColumn
  sortDir: "asc" | "desc"
}

/** Defaults to "from today" so the page reads as an upcoming-appointments list on load. */
export function getDefaultAppointmentFilters(): AppointmentFilters {
  return {
    type: "all",
    status: "all",
    dateFrom: toDateInputValue(new Date()),
    dateTo: "",
    page: 1,
    pageSize: 25,
    sortBy: "start_time",
    sortDir: "asc",
  }
}

export const appointmentKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentKeys.all, "list"] as const,
  list: (filters: AppointmentFilters) => [...appointmentKeys.lists(), filters] as const,
}

export function useAppointments(filters: AppointmentFilters) {
  const supabase = useSupabaseClient()

  return useQuery({
    queryKey: appointmentKeys.list(filters),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(APPOINTMENT_RELATIONS_SELECT, { count: "exact" })

      if (filters.type !== "all") query = query.eq("type", filters.type)
      if (filters.status !== "all") query = query.eq("status", filters.status)
      if (filters.dateFrom) query = query.gte("start_time", filters.dateFrom)
      if (filters.dateTo) query = query.lte("start_time", `${filters.dateTo}T23:59:59.999`)

      query = query.order(filters.sortBy, { ascending: filters.sortDir === "asc" })

      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        appointments: (data ?? []) as AppointmentWithRelations[],
        total: count ?? 0,
      }
    },
  })
}

export function useCreateAppointment() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const orgId = await getCurrentOrgId(supabase, queryClient)

      const { data, error } = await supabase
        .from("appointments")
        .insert({ ...input, org_id: orgId })
        .select(APPOINTMENT_RELATIONS_SELECT)
        .single()
      if (error) throw error

      const appointment = data as AppointmentWithRelations

      if (appointment.contact_id) {
        await supabase.from("activities").insert({
          org_id: orgId,
          type: "appointment_booked",
          description: `Appointment booked: ${appointment.title}`,
          related_to_type: "contact",
          related_to_id: appointment.contact_id,
        })
      }

      return appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
    },
  })
}

export function useUpdateAppointment() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateAppointmentInput }) => {
      const { data, error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id)
        .select(APPOINTMENT_RELATIONS_SELECT)
        .single()
      if (error) throw error
      return data as AppointmentWithRelations
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
    },
  })
}

export function useDeleteAppointment() {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() })
    },
  })
}
