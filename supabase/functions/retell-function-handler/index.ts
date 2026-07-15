// Supabase Edge Function: retell-function-handler
//
// Single endpoint Retell calls for every "custom function" tool invocation
// during a live call (create_or_update_contact, check_existing_customer —
// see _shared/retell-tools.ts for the tool definitions registered on each
// AI Employee's Retell LLM by create-retell-agent/update-retell-agent).
// Retell POSTs { call, name, args } and expects a JSON result back within
// its tool timeout; whatever this returns becomes the function's result
// inside the LLM's context, so keep responses small and fast.
//
// No Supabase session exists — Retell calls this directly mid-call — so
// it's authorized the same way as retell-call-webhook: the HMAC
// X-Retell-Signature header, keyed with RETELL_API_KEY (see
// _shared/retell-webhook-verify.ts). All DB access uses the service-role
// client, manually scoped to the calling AI Employee's org_id on every query
// since there's no RLS session to lean on.

import {
  buildIsoDateTime,
  formatDateLabel,
  formatTimeLabel,
  getAppointmentSettings,
  isValidDateString,
  minutesSinceUtcMidnight,
  minutesToTimeLabel,
  parseTimeToMinutes,
  rangesOverlap,
} from "../_shared/appointment-scheduling.ts"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"
import {
  clampScore,
  computeQualificationScore,
  deriveLeadStatus,
  recommendedActionForScore,
} from "../_shared/lead-scoring.ts"
import { sendEmailAndLog, sendSmsAndLog, type AppointmentVars } from "../_shared/messaging.ts"
import { asNumber, asString } from "../_shared/parse-args.ts"
import { verifyRetellSignature } from "../_shared/retell-webhook-verify.ts"
import { createServiceRoleClient } from "../_shared/supabase-admin.ts"
import type {
  AiEmployeeRow,
  RetellCall,
  RetellFunctionCallPayload,
  TransferConditionType,
  TransferRuleRow,
} from "../_shared/types.ts"

type ServiceClient = ReturnType<typeof createServiceRoleClient>

interface ContactRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

const CONTACT_SELECT = "id, first_name, last_name, email, phone, address, notes"

function contactFullName(contact: { first_name: string | null; last_name: string | null }): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown"
}

/** LLM-supplied args are untyped JSON — coerce defensively rather than
 *  trusting the model sent exactly what the tool schema asked for. */
/** qualification_answers arrives as an arbitrary JSON object — pull out only
 *  the string-valued keys computeQualificationScore knows about. */
function asQualificationAnswers(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {}
  const answers: Record<string, string> = {}
  for (const key of ["budget", "timeline", "urgency", "decision_maker"]) {
    const raw = (value as Record<string, unknown>)[key]
    const str = asString(raw)
    if (str) answers[key] = str
  }
  return answers
}

async function findCallRowId(supabase: ServiceClient, retellCallId: string): Promise<string | null> {
  const { data } = await supabase
    .from("calls")
    .select("id")
    .eq("retell_call_id", retellCallId)
    .maybeSingle()
  return data?.id ?? null
}

// --- create_or_update_contact ---

async function handleCreateOrUpdateContact(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  args: Record<string, unknown>
): Promise<Response> {
  const firstName = asString(args.first_name)
  const lastName = asString(args.last_name)
  const phone = asString(args.phone)

  if (!firstName || !lastName || !phone) {
    return jsonResponse(
      { success: false, message: "first_name, last_name, and phone are all required." },
      400
    )
  }

  const email = asString(args.email)
  const address = asString(args.address)

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select(CONTACT_SELECT)
    .eq("org_id", employee.org_id)
    .eq("phone", phone)
    .maybeSingle()

  if (findError) {
    console.error("retell-function-handler: contact lookup failed", findError)
    return jsonResponse({ success: false, message: "Lookup failed, please try again." }, 500)
  }

  let contact: ContactRow
  let created: boolean

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("contacts")
      .update({
        first_name: firstName,
        last_name: lastName,
        ...(email ? { email } : {}),
        ...(address ? { address } : {}),
      })
      .eq("id", existing.id)
      .select(CONTACT_SELECT)
      .single()

    if (updateError || !updated) {
      console.error("retell-function-handler: contact update failed", updateError)
      return jsonResponse({ success: false, message: "Failed to update contact." }, 500)
    }
    contact = updated
    created = false
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("contacts")
      .insert({
        org_id: employee.org_id,
        first_name: firstName,
        last_name: lastName,
        phone,
        email: email ?? null,
        address: address ?? null,
      })
      .select(CONTACT_SELECT)
      .single()

    if (insertError || !inserted) {
      console.error("retell-function-handler: contact insert failed", insertError)
      return jsonResponse({ success: false, message: "Failed to create contact." }, 500)
    }
    contact = inserted
    created = true
  }

  const callRowId = await findCallRowId(supabase, call.call_id)

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: created ? "contact_created" : "contact_updated",
    description: `${created ? "Created" : "Updated"} contact ${contactFullName(contact)} during a live call`,
    related_to_type: callRowId ? "call" : "contact",
    related_to_id: callRowId ?? contact.id,
    contact_id: contact.id,
  })
  if (actionError) {
    console.error("retell-function-handler: failed to insert ai_employee_action", actionError)
  }

  // Link the in-progress call to the contact so the rest of the app (Call
  // Detail, Recent Calls) can identify the caller before the call even ends,
  // instead of waiting on the placeholder-contact logic in call_ended.
  if (callRowId) {
    const { error: linkError } = await supabase
      .from("calls")
      .update({ contact_id: contact.id })
      .eq("id", callRowId)
    if (linkError) {
      console.error("retell-function-handler: failed to link call to contact", linkError)
    }
  }

  return jsonResponse({
    success: true,
    contact_id: contact.id,
    message: `Contact ${contactFullName(contact)} ${created ? "created" : "updated"}`,
  })
}

// --- check_existing_customer ---

async function findContactByPhoneOrEmail(
  supabase: ServiceClient,
  orgId: string,
  phone: string | undefined,
  email: string | undefined
): Promise<ContactRow | null> {
  if (phone) {
    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("org_id", orgId)
      .eq("phone", phone)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  if (email) {
    const { data, error } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  return null
}

async function handleCheckExistingCustomer(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const phone = asString(args.phone)
  const email = asString(args.email)

  if (!phone && !email) {
    return jsonResponse({ found: false, message: "A phone number or email is required to search." }, 400)
  }

  let contact: ContactRow | null
  try {
    contact = await findContactByPhoneOrEmail(supabase, employee.org_id, phone, email)
  } catch (error) {
    console.error("retell-function-handler: customer lookup failed", error)
    return jsonResponse({ found: false, message: "Lookup failed, please try again." }, 500)
  }

  if (!contact) {
    return jsonResponse({ found: false })
  }

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("title, start_time, status")
    .eq("org_id", employee.org_id)
    .eq("contact_id", contact.id)
    .order("start_time", { ascending: false })
    .limit(5)

  if (appointmentsError) {
    console.error("retell-function-handler: appointments lookup failed", appointmentsError)
  }

  return jsonResponse({
    found: true,
    contact: {
      name: contactFullName(contact),
      past_appointments: (appointments ?? []).map((appointment) => ({
        title: appointment.title,
        date: appointment.start_time,
        status: appointment.status,
      })),
      notes: contact.notes ?? null,
    },
  })
}

// --- shared appointment-scheduling helpers ---

interface AppointmentRow {
  id: string
  contact_id: string | null
  start_time: string
  end_time: string
  notes: string | null
  status: string
  title: string
}

const APPOINTMENT_SELECT = "id, contact_id, start_time, end_time, notes, status, title"

async function getOrgSettings(supabase: ServiceClient, orgId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle()
  if (error) throw error
  return (data?.settings ?? {}) as Record<string, unknown>
}

/** Non-cancelled appointments for the org on the given calendar date, as
 *  minute-of-day [start, end) ranges — used both to compute open slots for
 *  check_availability and to guard against double-booking in
 *  book_appointment/reschedule_appointment. `excludeAppointmentId` lets a
 *  reschedule ignore the very appointment it's about to move. */
async function findOccupiedRanges(
  supabase: ServiceClient,
  orgId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<{ start: number; end: number }[]> {
  let query = supabase
    .from("appointments")
    .select("id, start_time, end_time")
    .eq("org_id", orgId)
    .neq("status", "cancelled")
    .gte("start_time", `${date}T00:00:00.000Z`)
    .lte("start_time", `${date}T23:59:59.999Z`)

  if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    start: minutesSinceUtcMidnight(row.start_time),
    end: minutesSinceUtcMidnight(row.end_time),
  }))
}

async function resolveAppointment(
  supabase: ServiceClient,
  orgId: string,
  appointmentId: string | undefined,
  contactPhone: string | undefined
): Promise<AppointmentRow | null> {
  if (appointmentId) {
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("id", appointmentId)
      .eq("org_id", orgId)
      .maybeSingle()
    if (error) throw error
    return data
  }

  if (contactPhone) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("org_id", orgId)
      .eq("phone", contactPhone)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return null

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("org_id", orgId)
      .eq("contact_id", contact.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (appointmentError) throw appointmentError
    return appointment
  }

  return null
}

// --- check_availability ---

async function handleCheckAvailability(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const date = asString(args.date)
  if (!date || !isValidDateString(date)) {
    return jsonResponse({ error: "date is required, in YYYY-MM-DD format." }, 400)
  }

  let occupied: { start: number; end: number }[]
  let settings: ReturnType<typeof getAppointmentSettings>
  try {
    const orgSettings = await getOrgSettings(supabase, employee.org_id)
    settings = getAppointmentSettings(orgSettings)
    occupied = await findOccupiedRanges(supabase, employee.org_id, date)
  } catch (error) {
    console.error("retell-function-handler: check_availability lookup failed", error)
    return jsonResponse({ error: "Availability lookup failed, please try again." }, 500)
  }

  const isToday = date === new Date().toISOString().slice(0, 10)
  const nowMinutes = isToday ? minutesSinceUtcMidnight(new Date().toISOString()) : -1

  const availableSlots: string[] = []
  for (
    let slotStart = settings.startMinutes;
    slotStart + settings.slotMinutes <= settings.endMinutes;
    slotStart += settings.slotMinutes
  ) {
    if (slotStart < nowMinutes) continue
    const slotEnd = slotStart + settings.slotMinutes
    const isTaken = occupied.some((range) => rangesOverlap(slotStart, slotEnd, range.start, range.end))
    if (!isTaken) availableSlots.push(minutesToTimeLabel(slotStart))
  }

  return jsonResponse({
    available_slots: availableSlots,
    date: formatDateLabel(date),
  })
}

// --- book_appointment ---

async function handleBookAppointment(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const contactId = asString(args.contact_id)
  const date = asString(args.date)
  const time = asString(args.time)

  if (!contactId || !date || !time) {
    return jsonResponse({ success: false, message: "contact_id, date, and time are all required." }, 400)
  }
  if (!isValidDateString(date)) {
    return jsonResponse({ success: false, message: "date must be in YYYY-MM-DD format." }, 400)
  }
  const startMinutes = parseTimeToMinutes(time)
  if (startMinutes === null) {
    return jsonResponse({ success: false, message: "time is not a recognized time format." }, 400)
  }

  const serviceType = asString(args.service_type)
  const notes = asString(args.notes)

  let orgSettings: Record<string, unknown>
  let contactExists: boolean
  try {
    orgSettings = await getOrgSettings(supabase, employee.org_id)
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("org_id", employee.org_id)
      .maybeSingle()
    if (contactError) throw contactError
    contactExists = Boolean(contact)
  } catch (error) {
    console.error("retell-function-handler: book_appointment pre-checks failed", error)
    return jsonResponse({ success: false, message: "Booking failed, please try again." }, 500)
  }

  if (!contactExists) {
    return jsonResponse({ success: false, message: "That contact could not be found." }, 404)
  }

  const settings = getAppointmentSettings(orgSettings)
  const endMinutes = startMinutes + settings.slotMinutes

  if (startMinutes < settings.startMinutes || endMinutes > settings.endMinutes) {
    return jsonResponse({ success: false, message: "That time is outside business hours." }, 400)
  }

  try {
    const occupied = await findOccupiedRanges(supabase, employee.org_id, date)
    const isTaken = occupied.some((range) => rangesOverlap(startMinutes, endMinutes, range.start, range.end))
    if (isTaken) {
      return jsonResponse(
        { success: false, message: "That time is no longer available. Please choose another time." },
        200
      )
    }
  } catch (error) {
    console.error("retell-function-handler: book_appointment availability check failed", error)
    return jsonResponse({ success: false, message: "Booking failed, please try again." }, 500)
  }

  const startIso = buildIsoDateTime(date, startMinutes)
  const endIso = buildIsoDateTime(date, endMinutes)
  const title = serviceType ? `${serviceType} appointment` : "Appointment"

  const { data: appointment, error: insertError } = await supabase
    .from("appointments")
    .insert({
      org_id: employee.org_id,
      title,
      contact_id: contactId,
      start_time: startIso,
      end_time: endIso,
      type: serviceType ? "service" : "meeting",
      status: "scheduled",
      notes: notes ?? null,
      created_by_ai: true,
      ai_employee_id: employee.id,
    })
    .select(APPOINTMENT_SELECT)
    .single()

  if (insertError || !appointment) {
    console.error("retell-function-handler: appointment insert failed", insertError)
    return jsonResponse({ success: false, message: "Failed to book appointment." }, 500)
  }

  const description = `Appointment booked: ${title}`

  const { error: activityError } = await supabase.from("activities").insert({
    org_id: employee.org_id,
    type: "appointment_booked",
    description,
    performed_by_ai: true,
    ai_employee_id: employee.id,
    related_to_type: "contact",
    related_to_id: contactId,
  })
  if (activityError) console.error("retell-function-handler: failed to insert activity", activityError)

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "appointment_booked",
    description,
    related_to_type: "appointment",
    related_to_id: appointment.id,
    contact_id: contactId,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  const { error: incrementError } = await supabase.rpc("increment_ai_employee_appointments", {
    p_ai_employee_id: employee.id,
  })
  if (incrementError) {
    console.error("retell-function-handler: failed to increment total_appointments", incrementError)
  }

  return jsonResponse({
    success: true,
    appointment_id: appointment.id,
    message: `Appointment booked for ${formatDateLabel(startIso)} at ${formatTimeLabel(startIso)}`,
  })
}

// --- reschedule_appointment ---

async function handleRescheduleAppointment(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const appointmentId = asString(args.appointment_id)
  const contactPhone = asString(args.contact_phone)
  const newDate = asString(args.new_date)
  const newTime = asString(args.new_time)

  if (!appointmentId && !contactPhone) {
    return jsonResponse(
      { success: false, message: "Either appointment_id or contact_phone is required." },
      400
    )
  }
  if (!newDate || !newTime) {
    return jsonResponse({ success: false, message: "new_date and new_time are both required." }, 400)
  }
  if (!isValidDateString(newDate)) {
    return jsonResponse({ success: false, message: "new_date must be in YYYY-MM-DD format." }, 400)
  }
  const newStartMinutes = parseTimeToMinutes(newTime)
  if (newStartMinutes === null) {
    return jsonResponse({ success: false, message: "new_time is not a recognized time format." }, 400)
  }

  let appointment: AppointmentRow | null
  let orgSettings: Record<string, unknown>
  try {
    appointment = await resolveAppointment(supabase, employee.org_id, appointmentId, contactPhone)
    orgSettings = await getOrgSettings(supabase, employee.org_id)
  } catch (error) {
    console.error("retell-function-handler: reschedule_appointment lookup failed", error)
    return jsonResponse({ success: false, message: "Reschedule failed, please try again." }, 500)
  }

  if (!appointment) {
    return jsonResponse({ success: false, message: "No upcoming appointment was found to reschedule." })
  }

  const settings = getAppointmentSettings(orgSettings)
  const newEndMinutes = newStartMinutes + settings.slotMinutes

  if (newStartMinutes < settings.startMinutes || newEndMinutes > settings.endMinutes) {
    return jsonResponse({ success: false, message: "That time is outside business hours." }, 400)
  }

  try {
    const occupied = await findOccupiedRanges(supabase, employee.org_id, newDate, appointment.id)
    const isTaken = occupied.some((range) =>
      rangesOverlap(newStartMinutes, newEndMinutes, range.start, range.end)
    )
    if (isTaken) {
      return jsonResponse({
        success: false,
        message: "That time is no longer available. Please choose another time.",
      })
    }
  } catch (error) {
    console.error("retell-function-handler: reschedule_appointment availability check failed", error)
    return jsonResponse({ success: false, message: "Reschedule failed, please try again." }, 500)
  }

  const oldDateLabel = formatDateLabel(appointment.start_time)
  const oldTimeLabel = formatTimeLabel(appointment.start_time)
  const newStartIso = buildIsoDateTime(newDate, newStartMinutes)
  const newEndIso = buildIsoDateTime(newDate, newEndMinutes)
  const newDateLabel = formatDateLabel(newStartIso)
  const newTimeLabel = formatTimeLabel(newStartIso)

  const previousNote = `Rescheduled from ${oldDateLabel} at ${oldTimeLabel}`
  const updatedNotes = appointment.notes ? `${appointment.notes}\n${previousNote}` : previousNote

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ start_time: newStartIso, end_time: newEndIso, notes: updatedNotes })
    .eq("id", appointment.id)

  if (updateError) {
    console.error("retell-function-handler: appointment reschedule update failed", updateError)
    return jsonResponse({ success: false, message: "Failed to reschedule appointment." }, 500)
  }

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "appointment_rescheduled",
    description: `Rescheduled appointment "${appointment.title}" from ${oldDateLabel} at ${oldTimeLabel} to ${newDateLabel} at ${newTimeLabel}`,
    related_to_type: "appointment",
    related_to_id: appointment.id,
    contact_id: appointment.contact_id,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  return jsonResponse({
    success: true,
    message: `Rescheduled from ${oldDateLabel} to ${newDateLabel} at ${newTimeLabel}`,
  })
}

// --- cancel_appointment ---

async function handleCancelAppointment(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const appointmentId = asString(args.appointment_id)
  const contactPhone = asString(args.contact_phone)

  if (!appointmentId && !contactPhone) {
    return jsonResponse(
      { success: false, message: "Either appointment_id or contact_phone is required." },
      400
    )
  }

  let appointment: AppointmentRow | null
  try {
    appointment = await resolveAppointment(supabase, employee.org_id, appointmentId, contactPhone)
  } catch (error) {
    console.error("retell-function-handler: cancel_appointment lookup failed", error)
    return jsonResponse({ success: false, message: "Cancellation failed, please try again." }, 500)
  }

  if (!appointment) {
    return jsonResponse({ success: false, message: "No upcoming appointment was found to cancel." })
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id)

  if (updateError) {
    console.error("retell-function-handler: appointment cancel update failed", updateError)
    return jsonResponse({ success: false, message: "Failed to cancel appointment." }, 500)
  }

  const dateLabel = formatDateLabel(appointment.start_time)
  const timeLabel = formatTimeLabel(appointment.start_time)

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "appointment_cancelled",
    description: `Cancelled appointment "${appointment.title}" on ${dateLabel} at ${timeLabel}`,
    related_to_type: "appointment",
    related_to_id: appointment.id,
    contact_id: appointment.contact_id,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  return jsonResponse({
    success: true,
    message: `Appointment on ${dateLabel} at ${timeLabel} has been cancelled.`,
  })
}

// --- create_lead ---

async function handleCreateLead(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  args: Record<string, unknown>
): Promise<Response> {
  const firstName = asString(args.first_name)
  const lastName = asString(args.last_name)
  const phone = asString(args.phone)

  if (!firstName || !lastName || !phone) {
    return jsonResponse(
      { success: false, message: "first_name, last_name, and phone are all required." },
      400
    )
  }

  const email = asString(args.email)
  const company = asString(args.company)
  const notes = asString(args.notes)
  const source = asString(args.source) || "ai_employee"
  const rawScore = asNumber(args.score)
  const score = rawScore !== undefined ? clampScore(rawScore) : null
  const status = score !== null ? deriveLeadStatus(score) : "new"

  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      org_id: employee.org_id,
      first_name: firstName,
      last_name: lastName,
      phone,
      email: email ?? null,
      company: company ?? null,
      source,
      status,
      score,
      notes: notes ?? null,
    })
    .select("id, first_name, last_name, status")
    .single()

  if (insertError || !lead) {
    console.error("retell-function-handler: lead insert failed", insertError)
    return jsonResponse({ success: false, message: "Failed to create lead." }, 500)
  }

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"
  const description = `Lead created: ${leadName}${company ? ` from ${company}` : ""}`

  const { error: activityError } = await supabase.from("activities").insert({
    org_id: employee.org_id,
    type: "lead_created",
    description,
    performed_by_ai: true,
    ai_employee_id: employee.id,
    related_to_type: "lead",
    related_to_id: lead.id,
  })
  if (activityError) console.error("retell-function-handler: failed to insert activity", activityError)

  const callRowId = await findCallRowId(supabase, call.call_id)

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "lead_created",
    description,
    related_to_type: callRowId ? "call" : "lead",
    related_to_id: callRowId ?? lead.id,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  const { error: incrementError } = await supabase.rpc("increment_ai_employee_leads", {
    p_ai_employee_id: employee.id,
  })
  if (incrementError) {
    console.error("retell-function-handler: failed to increment total_leads", incrementError)
  }

  return jsonResponse({ success: true, lead_id: lead.id, status: lead.status })
}

// --- qualify_lead ---

async function handleQualifyLead(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const contactPhone = asString(args.contact_phone)
  if (!contactPhone) {
    return jsonResponse({ qualified: false, message: "contact_phone is required." }, 400)
  }

  const answers = asQualificationAnswers(args.qualification_answers)

  const { data: lead, error: findError } = await supabase
    .from("leads")
    .select("id, first_name, last_name")
    .eq("org_id", employee.org_id)
    .eq("phone", contactPhone)
    .neq("status", "converted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error("retell-function-handler: lead lookup failed", findError)
    return jsonResponse({ qualified: false, message: "Lookup failed, please try again." }, 500)
  }

  if (!lead) {
    return jsonResponse({
      qualified: false,
      message: "No lead was found for that phone number. Call create_lead first.",
    })
  }

  const score = computeQualificationScore(answers)
  const status = deriveLeadStatus(score)
  const recommendedAction = recommendedActionForScore(score)

  const { error: updateError } = await supabase.from("leads").update({ score, status }).eq("id", lead.id)

  if (updateError) {
    console.error("retell-function-handler: lead qualification update failed", updateError)
    return jsonResponse({ qualified: false, message: "Failed to update lead." }, 500)
  }

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "lead_qualified",
    description: `Qualified lead ${leadName} with a score of ${score} (${status})`,
    related_to_type: "lead",
    related_to_id: lead.id,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  return jsonResponse({
    qualified: score > 70,
    score,
    recommended_action: recommendedAction,
  })
}

// --- create_opportunity ---

async function handleCreateOpportunity(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  args: Record<string, unknown>
): Promise<Response> {
  const contactId = asString(args.contact_id)
  const title = asString(args.title)

  if (!contactId || !title) {
    return jsonResponse({ success: false, message: "contact_id and title are both required." }, 400)
  }

  const estimatedValue = asNumber(args.estimated_value)
  const description = asString(args.description)
  const urgency = asString(args.urgency)

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("org_id", employee.org_id)
    .maybeSingle()

  if (contactError) {
    console.error("retell-function-handler: create_opportunity contact lookup failed", contactError)
    return jsonResponse({ success: false, message: "Failed to create opportunity, please try again." }, 500)
  }
  if (!contact) {
    return jsonResponse({ success: false, message: "That contact could not be found." }, 404)
  }

  const { data: defaultPipeline, error: defaultPipelineError } = await supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", employee.org_id)
    .eq("is_default", true)
    .maybeSingle()
  if (defaultPipelineError) {
    console.error("retell-function-handler: default pipeline lookup failed", defaultPipelineError)
    return jsonResponse({ success: false, message: "Failed to create opportunity, please try again." }, 500)
  }

  let pipelineId = defaultPipeline?.id as string | undefined
  if (!pipelineId) {
    // No pipeline flagged is_default — fall back to the org's oldest
    // pipeline (almost certainly the one created when the org was set up)
    // rather than failing outright.
    const { data: fallbackPipeline, error: fallbackError } = await supabase
      .from("pipelines")
      .select("id")
      .eq("org_id", employee.org_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (fallbackError) {
      console.error("retell-function-handler: fallback pipeline lookup failed", fallbackError)
      return jsonResponse({ success: false, message: "Failed to create opportunity, please try again." }, 500)
    }
    pipelineId = fallbackPipeline?.id
  }

  if (!pipelineId) {
    return jsonResponse({ success: false, message: "No sales pipeline is configured for this business yet." }, 500)
  }

  const { data: firstStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (stageError) {
    console.error("retell-function-handler: pipeline stage lookup failed", stageError)
    return jsonResponse({ success: false, message: "Failed to create opportunity, please try again." }, 500)
  }
  if (!firstStage) {
    return jsonResponse({ success: false, message: "The sales pipeline has no stages configured." }, 500)
  }

  const notes = [description, urgency ? `Urgency: ${urgency}` : null].filter(Boolean).join("\n") || null

  const { data: deal, error: insertError } = await supabase
    .from("deals")
    .insert({
      org_id: employee.org_id,
      pipeline_id: pipelineId,
      stage_id: firstStage.id,
      contact_id: contactId,
      title,
      value: estimatedValue ?? 0,
      status: "open",
      notes,
    })
    .select("id")
    .single()

  if (insertError || !deal) {
    console.error("retell-function-handler: deal insert failed", insertError)
    return jsonResponse({ success: false, message: "Failed to create opportunity." }, 500)
  }

  const activityDescription = `Deal created: ${title}`

  const { error: activityError } = await supabase.from("activities").insert({
    org_id: employee.org_id,
    type: "deal_created",
    description: activityDescription,
    performed_by_ai: true,
    ai_employee_id: employee.id,
    related_to_type: "deal",
    related_to_id: deal.id,
  })
  if (activityError) console.error("retell-function-handler: failed to insert activity", activityError)

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "opportunity_created",
    description: activityDescription,
    related_to_type: "deal",
    related_to_id: deal.id,
    contact_id: contactId,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  return jsonResponse({ success: true, deal_id: deal.id, pipeline_stage: firstStage.name })
}

// --- send_sms / send_email shared context resolution ---

interface MessageContext {
  businessName: string
  contactId: string | null
  callRowId: string | null
  appointmentVars: AppointmentVars
}

/** Gathers everything sendSmsAndLog/sendEmailAndLog need beyond the message
 *  content itself: the org's display name, the contact this message should
 *  be attributed to (preferring the contact already linked to this call,
 *  falling back to a phone/email lookup), and — only when the requested
 *  template needs it — the caller's most recent appointment. Best-effort:
 *  any failure here just means those fields fall back to sensible defaults,
 *  it never blocks the send itself. */
async function resolveMessageContext(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  identifier: { phone?: string; email?: string },
  templateName: string | undefined
): Promise<MessageContext> {
  let businessName = "our business"
  let contactId: string | null = null
  let callRowId: string | null = null
  let appointmentVars: AppointmentVars = {}

  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", employee.org_id)
      .maybeSingle()
    if (org?.name) businessName = org.name

    callRowId = await findCallRowId(supabase, call.call_id)
    if (callRowId) {
      const { data: callRow } = await supabase
        .from("calls")
        .select("contact_id")
        .eq("id", callRowId)
        .maybeSingle()
      contactId = callRow?.contact_id ?? null
    }

    if (!contactId && identifier.phone) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("org_id", employee.org_id)
        .eq("phone", identifier.phone)
        .maybeSingle()
      contactId = contact?.id ?? null
    }
    if (!contactId && identifier.email) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("org_id", employee.org_id)
        .eq("email", identifier.email)
        .maybeSingle()
      contactId = contact?.id ?? null
    }

    if (templateName === "appointment_confirmation" && contactId) {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("start_time")
        .eq("org_id", employee.org_id)
        .eq("contact_id", contactId)
        .in("status", ["scheduled", "confirmed"])
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (appointment) {
        appointmentVars = {
          appointment_date: formatDateLabel(appointment.start_time),
          appointment_time: formatTimeLabel(appointment.start_time),
        }
      }
    }
  } catch (error) {
    console.error("retell-function-handler: message context lookup failed", error)
  }

  return { businessName, contactId, callRowId, appointmentVars }
}

// --- send_sms ---

async function handleSendSms(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  args: Record<string, unknown>
): Promise<Response> {
  const toPhone = asString(args.to_phone)
  const messageText = asString(args.message_text)
  const templateName = asString(args.template_name)

  if (!toPhone) {
    return jsonResponse({ sent: false, message: "to_phone is required." }, 400)
  }
  if (!messageText && !templateName) {
    return jsonResponse({ sent: false, message: "Either message_text or template_name is required." }, 400)
  }

  const context = await resolveMessageContext(supabase, employee, call, { phone: toPhone }, templateName)

  const result = await sendSmsAndLog({
    supabase,
    employee,
    businessName: context.businessName,
    toPhone,
    messageText,
    templateName,
    contactId: context.contactId,
    callRowId: context.callRowId,
    appointmentVars: context.appointmentVars,
  })

  if (!result.sent) {
    return jsonResponse({ sent: false, message: result.error ?? "Failed to send SMS." })
  }
  return jsonResponse({ sent: true, message_id: result.messageId })
}

// --- send_email ---

async function handleSendEmail(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  args: Record<string, unknown>
): Promise<Response> {
  const toEmail = asString(args.to_email)
  const subject = asString(args.subject)
  const bodyText = asString(args.body_text)
  const templateName = asString(args.template_name)

  if (!toEmail) {
    return jsonResponse({ sent: false, message: "to_email is required." }, 400)
  }
  if (!templateName && !(subject && bodyText)) {
    return jsonResponse(
      { sent: false, message: "Either template_name or both subject and body_text are required." },
      400
    )
  }

  const context = await resolveMessageContext(supabase, employee, call, { email: toEmail }, templateName)

  const result = await sendEmailAndLog({
    supabase,
    employee,
    businessName: context.businessName,
    toEmail,
    subject,
    bodyText,
    templateName,
    contactId: context.contactId,
    callRowId: context.callRowId,
    appointmentVars: context.appointmentVars,
  })

  if (!result.sent) {
    return jsonResponse({ sent: false, message: result.error ?? "Failed to send email." })
  }
  return jsonResponse({ sent: true, message_id: result.messageId })
}

// --- warm_transfer ---
//
// warm_transfer itself never touches the phone call — it's business logic
// only: resolve who should get this call based on transfer_rules, log the
// transfer, brief them with a task + notification, and hand the target's
// phone number back to the LLM. The actual SIP transfer happens when the AI
// Employee separately calls Retell's native transfer_call tool (see
// _shared/retell-tools.ts buildTransferCallTool) with that number — a
// custom-function webhook has no ability to bridge a live call itself.

const VALID_CONDITION_TYPES: TransferConditionType[] = [
  "caller_requests_human",
  "value_threshold",
  "angry_caller",
  "emergency",
  "low_confidence",
]

function isTransferConditionType(value: string): value is TransferConditionType {
  return (VALID_CONDITION_TYPES as string[]).includes(value)
}

function priorityForReasonCategory(category: TransferConditionType): "urgent" | "high" | "medium" {
  if (category === "emergency" || category === "angry_caller") return "urgent"
  if (category === "caller_requests_human" || category === "value_threshold") return "high"
  return "medium"
}

/** First rule matching this reason_category, with 'low_confidence' rules
 *  (if configured) doubling as the "default handler" when nothing else
 *  matches — mirrors how the wizard's condition list frames it. */
function resolveTransferRule(
  rules: TransferRuleRow[],
  reasonCategory: TransferConditionType,
  estimatedValue: number | undefined
): TransferRuleRow | null {
  const sorted = [...rules].sort((a, b) => a.position - b.position)

  if (reasonCategory === "value_threshold") {
    const candidates = sorted.filter((rule) => rule.condition_type === "value_threshold")
    for (const rule of candidates) {
      const threshold = rule.condition_value ? Number(rule.condition_value) : undefined
      if (threshold === undefined || Number.isNaN(threshold)) continue
      if (estimatedValue !== undefined && estimatedValue > threshold) return rule
    }
  } else {
    const direct = sorted.find((rule) => rule.condition_type === reasonCategory)
    if (direct) return direct
  }

  if (reasonCategory !== "low_confidence") {
    const fallback = sorted.find((rule) => rule.condition_type === "low_confidence")
    if (fallback) return fallback
  }

  return null
}

async function handleWarmTransfer(
  supabase: ServiceClient,
  employee: AiEmployeeRow,
  call: RetellCall,
  args: Record<string, unknown>
): Promise<Response> {
  const reason = asString(args.reason)
  const reasonCategoryRaw = asString(args.reason_category)
  const conversationSummary = asString(args.conversation_summary)
  const contactInfoSummary = asString(args.contact_info_summary)
  const estimatedValue = asNumber(args.estimated_value)

  if (!reason || !reasonCategoryRaw || !conversationSummary) {
    return jsonResponse(
      { transferring: false, message: "reason, reason_category, and conversation_summary are all required." },
      400
    )
  }
  if (!isTransferConditionType(reasonCategoryRaw)) {
    return jsonResponse(
      {
        transferring: false,
        message: `reason_category must be one of: ${VALID_CONDITION_TYPES.join(", ")}.`,
      },
      400
    )
  }
  const reasonCategory = reasonCategoryRaw

  const { data: rules, error: rulesError } = await supabase
    .from("transfer_rules")
    .select("id, condition_type, condition_value, target_user_id, target_phone, position")
    .eq("org_id", employee.org_id)
    .eq("ai_employee_id", employee.id)

  if (rulesError) {
    console.error("retell-function-handler: transfer_rules lookup failed", rulesError)
    return jsonResponse({ transferring: false, message: "Failed to look up transfer rules." }, 500)
  }

  const rule = resolveTransferRule((rules ?? []) as TransferRuleRow[], reasonCategory, estimatedValue)

  const callRowId = await findCallRowId(supabase, call.call_id)
  let contactId: string | null = null
  if (callRowId) {
    const { data: callRow } = await supabase
      .from("calls")
      .select("contact_id")
      .eq("id", callRowId)
      .maybeSingle()
    contactId = callRow?.contact_id ?? null
  }

  if (!rule) {
    return jsonResponse({
      transferring: false,
      message: "No transfer target is configured for this situation.",
    })
  }

  let targetName = "a team member"
  let targetPhone: string | null = rule.target_phone

  if (rule.target_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", rule.target_user_id)
      .maybeSingle()
    if (profile) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
      if (name) targetName = name
      if (!targetPhone) targetPhone = profile.phone ?? null
    }
  } else if (rule.target_phone) {
    targetName = "our team"
  }

  let callerName = contactInfoSummary ?? "the caller"
  if (contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", contactId)
      .maybeSingle()
    if (contact) {
      const name = contactFullName(contact)
      if (name && name !== "Unknown") callerName = name
    }
  }

  const { data: transfer, error: transferError } = await supabase
    .from("transfers")
    .insert({
      org_id: employee.org_id,
      call_id: callRowId,
      ai_employee_id: employee.id,
      from_ai_employee: employee.name,
      to_user_id: rule.target_user_id,
      to_phone: targetPhone,
      reason,
      context_summary: conversationSummary,
      status: targetPhone ? "pending" : "failed",
    })
    .select("id")
    .single()

  if (transferError || !transfer) {
    console.error("retell-function-handler: transfer insert failed", transferError)
    return jsonResponse({ transferring: false, message: "Failed to log the transfer." }, 500)
  }

  const description = `Transferred to ${targetName} — ${reason}`

  const { error: actionError } = await supabase.from("ai_employee_actions").insert({
    org_id: employee.org_id,
    ai_employee_id: employee.id,
    action_type: "call_transferred",
    description,
    related_to_type: callRowId ? "call" : "contact",
    related_to_id: callRowId ?? contactId,
    contact_id: contactId,
  })
  if (actionError) console.error("retell-function-handler: failed to insert ai_employee_action", actionError)

  const { error: taskError } = await supabase.from("tasks").insert({
    org_id: employee.org_id,
    title: `Follow up with ${callerName} — transferred from ${employee.name} because: ${reason}`,
    description: conversationSummary,
    assigned_to: rule.target_user_id,
    related_to_type: contactId ? "contact" : null,
    related_to_id: contactId,
    priority: priorityForReasonCategory(reasonCategory),
  })
  if (taskError) console.error("retell-function-handler: failed to create follow-up task", taskError)

  if (rule.target_user_id) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      org_id: employee.org_id,
      user_id: rule.target_user_id,
      type: "transfer",
      title: `Incoming transfer from ${employee.name}`,
      message: `${reason}\n\n${conversationSummary}`,
      related_to_type: "transfer",
      related_to_id: transfer.id,
    })
    if (notificationError) {
      console.error("retell-function-handler: failed to create notification", notificationError)
    }
  }

  return jsonResponse({
    transferring: Boolean(targetPhone),
    target: targetName,
    target_phone: targetPhone ?? undefined,
    reason,
  })
}

// --- entrypoint ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const retellApiKey = Deno.env.get("RETELL_API_KEY")
  if (!retellApiKey) {
    console.error("retell-function-handler: RETELL_API_KEY is not configured")
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const rawBody = await req.text()

  const signatureValid = await verifyRetellSignature(
    rawBody,
    req.headers.get("X-Retell-Signature"),
    retellApiKey
  )
  if (!signatureValid) {
    return jsonResponse({ error: "Invalid signature" }, 401)
  }

  let payload: RetellFunctionCallPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400)
  }

  const { call, name, args } = payload
  if (!call?.call_id || !call?.agent_id || !name) {
    return jsonResponse({ error: "Missing call.call_id, call.agent_id, or name" }, 400)
  }

  const supabase = createServiceRoleClient()

  const { data: employee, error: employeeError } = await supabase
    .from("ai_employees")
    .select("*")
    .eq("retell_agent_id", call.agent_id)
    .maybeSingle()

  if (employeeError) {
    console.error("retell-function-handler: employee lookup failed", employeeError)
    return jsonResponse({ error: "Lookup failed" }, 500)
  }

  if (!employee) {
    // Should be unreachable in practice — Retell only calls tools for agents
    // it's actively running, and every agent it runs was provisioned from an
    // ai_employees row. Acknowledge with a clear error rather than retrying
    // something that can never resolve.
    console.warn(`retell-function-handler: no AI Employee for agent_id ${call.agent_id}`)
    return jsonResponse({ error: "Unrecognized agent" }, 404)
  }

  try {
    switch (name) {
      case "create_or_update_contact":
        return await handleCreateOrUpdateContact(
          supabase,
          employee as AiEmployeeRow,
          call,
          args ?? {}
        )
      case "check_existing_customer":
        return await handleCheckExistingCustomer(supabase, employee as AiEmployeeRow, args ?? {})
      case "check_availability":
        return await handleCheckAvailability(supabase, employee as AiEmployeeRow, args ?? {})
      case "book_appointment":
        return await handleBookAppointment(supabase, employee as AiEmployeeRow, args ?? {})
      case "reschedule_appointment":
        return await handleRescheduleAppointment(supabase, employee as AiEmployeeRow, args ?? {})
      case "cancel_appointment":
        return await handleCancelAppointment(supabase, employee as AiEmployeeRow, args ?? {})
      case "create_lead":
        return await handleCreateLead(supabase, employee as AiEmployeeRow, call, args ?? {})
      case "qualify_lead":
        return await handleQualifyLead(supabase, employee as AiEmployeeRow, args ?? {})
      case "create_opportunity":
        return await handleCreateOpportunity(supabase, employee as AiEmployeeRow, args ?? {})
      case "send_sms":
        return await handleSendSms(supabase, employee as AiEmployeeRow, call, args ?? {})
      case "send_email":
        return await handleSendEmail(supabase, employee as AiEmployeeRow, call, args ?? {})
      case "warm_transfer":
        return await handleWarmTransfer(supabase, employee as AiEmployeeRow, call, args ?? {})
      default:
        return jsonResponse({ error: `Unknown function: ${name}` }, 400)
    }
  } catch (error) {
    console.error("retell-function-handler: unhandled error", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500)
  }
})
