import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ActivityTimeline } from "@/components/activities/ActivityTimeline"
import { ContactAppointmentsTab } from "@/components/contacts/ContactAppointmentsTab"
import { ContactConversationsTab } from "@/components/contacts/ContactConversationsTab"
import { ContactDealsTab } from "@/components/contacts/ContactDealsTab"
import { ContactNotesTab } from "@/components/contacts/ContactNotesTab"
import { ContactTasksTab } from "@/components/contacts/ContactTasksTab"
import { TagBadge } from "@/components/contacts/TagBadge"
import { TagInput } from "@/components/contacts/TagInput"
import { PermissionGate } from "@/components/permissions/PermissionGate"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useCompanies } from "@/hooks/useCompanies"
import {
  useContact,
  useContactDeals,
  useContactTags,
  useDeleteContact,
  useUpdateContact,
} from "@/hooks/useContacts"
import { contactFormSchema } from "@/lib/validation/contact"
import { cn, daysSince, formatCurrency, formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"

interface EditForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  company_id: string | null
  address: string
  city: string
  state: string
  zip: string
  tags: string[]
  notes: string
  lifetime_value: string
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

function formatAddress(contact: {
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
}): string {
  const line2 = [contact.city, contact.state].filter(Boolean).join(", ")
  return [contact.address, [line2, contact.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || "—"
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useContact(id)
  const { data: deals } = useContactDeals(id)
  const { data: companies } = useCompanies()
  const { data: existingTags } = useContactTags()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading contact…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
        <p>Contact not found.</p>
        <Button variant="outline" onClick={() => navigate("/contacts")}>
          Back to Contacts
        </Button>
      </div>
    )
  }

  const { contact, activities } = data
  const totalDeals = deals?.length ?? 0
  const wonDeals = deals?.filter((d) => d.status === "won").length ?? 0
  const conversionRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : null
  const lastContactDays = activities.length > 0 ? daysSince(activities[0].created_at) : null

  function startEditing() {
    setForm({
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company_id: contact.company_id,
      address: contact.address ?? "",
      city: contact.city ?? "",
      state: contact.state ?? "",
      zip: contact.zip ?? "",
      tags: contact.tags,
      notes: contact.notes ?? "",
      lifetime_value: contact.lifetime_value.toString(),
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setForm(null)
  }

  async function saveEditing() {
    if (!form) return

    const parsed = contactFormSchema.safeParse({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      company_id: form.company_id ?? "",
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      notes: form.notes,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form")
      return
    }

    let lifetimeValue = 0
    if (form.lifetime_value.trim()) {
      const parsedValue = Number(form.lifetime_value)
      if (Number.isNaN(parsedValue)) {
        toast.error("Lifetime value must be a number")
        return
      }
      lifetimeValue = parsedValue
    }

    try {
      await updateContact.mutateAsync({
        id: contact.id,
        updates: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          company_id: parsed.data.company_id || null,
          address: parsed.data.address || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          zip: parsed.data.zip || null,
          notes: parsed.data.notes || null,
          tags: form.tags,
          lifetime_value: lifetimeValue,
        },
      })
      toast.success("Contact updated")
      setIsEditing(false)
    } catch (err) {
      toast.error("Failed to update contact", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function handleDelete() {
    try {
      await deleteContact.mutateAsync(contact.id)
      toast.success("Contact deleted")
      navigate("/contacts")
    } catch (err) {
      toast.error("Failed to delete contact", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div>
      <Link
        to="/contacts"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contacts
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {contactFullName(contact)}
        </h1>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing} disabled={updateContact.isPending}>
                Cancel
              </Button>
              <Button onClick={saveEditing} disabled={updateContact.isPending}>
                {updateContact.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <PermissionGate requiredPermission={{ feature: "crm", level: "edit" }} fallback={null}>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </PermissionGate>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Info card */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            {isEditing && form ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First name</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm((f) => f && { ...f, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last name</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => f && { ...f, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((f) => f && { ...f, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((f) => f && { ...f, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Select
                      value={form.company_id ?? "none"}
                      onValueChange={(value) =>
                        setForm((f) => f && { ...f, company_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No company</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lifetime Value</Label>
                    <Input
                      type="number"
                      value={form.lifetime_value}
                      onChange={(e) =>
                        setForm((f) => f && { ...f, lifetime_value: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => f && { ...f, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm((f) => f && { ...f, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm((f) => f && { ...f, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zip</Label>
                    <Input
                      value={form.zip}
                      onChange={(e) => setForm((f) => f && { ...f, zip: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tags</Label>
                  <TagInput
                    value={form.tags}
                    onChange={(tags) => setForm((f) => f && { ...f, tags })}
                    suggestions={existingTags}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <InfoField label="Email">{contact.email ?? "—"}</InfoField>
                  <InfoField label="Phone">{contact.phone ?? "—"}</InfoField>
                  <InfoField label="Company">{contact.company?.name ?? "—"}</InfoField>
                  <InfoField label="Address">{formatAddress(contact)}</InfoField>
                  <InfoField label="Lifetime Value">
                    {formatCurrency(contact.lifetime_value)}
                  </InfoField>
                  <InfoField label="Created">{formatDateTime(contact.created_at)}</InfoField>
                </div>
                <div className="mt-4">
                  <InfoField label="Tags">
                    {contact.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map((tag) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </InfoField>
                </div>
                {contact.notes && (
                  <div className="mt-4">
                    <InfoField label="Notes">{contact.notes}</InfoField>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Tabs */}
          <section className={cn("rounded-lg border border-slate-200 bg-white p-5")}>
            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="communications">Conversations</TabsTrigger>
              </TabsList>
              <TabsContent value="activity">
                <ActivityTimeline activities={activities} />
              </TabsContent>
              <TabsContent value="deals">
                <ContactDealsTab contactId={contact.id} />
              </TabsContent>
              <TabsContent value="tasks">
                <ContactTasksTab contactId={contact.id} />
              </TabsContent>
              <TabsContent value="appointments">
                <ContactAppointmentsTab contactId={contact.id} />
              </TabsContent>
              <TabsContent value="notes">
                <ContactNotesTab contactId={contact.id} />
              </TabsContent>
              <TabsContent value="communications">
                <ContactConversationsTab contactId={contact.id} />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <StatTile label="Lifetime Value" value={formatCurrency(contact.lifetime_value)} />
          <StatTile
            label="Days Since Last Contact"
            value={lastContactDays === null ? "—" : lastContactDays}
          />
          <StatTile label="Total Deals" value={totalDeals} />
          <StatTile
            label="Conversion Rate"
            value={conversionRate === null ? "—" : `${conversionRate}%`}
          />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {contactFullName(contact)}. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
