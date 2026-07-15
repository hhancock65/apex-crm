import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PermissionGate } from "@/components/permissions/PermissionGate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePermissions } from "@/hooks/usePermissions"
import { useAiEmployees } from "@/hooks/useAiEmployees"
import { useSubscription } from "@/hooks/useSubscription"
import {
  DEFAULT_BUSINESS_HOURS,
  NOTIFICATION_TYPES,
  useDeleteOrganization,
  useOrgSettings,
  useUpdateOrgSettings,
  useUploadOrgLogo,
  type AiEmployeeDefaults,
  type BusinessHoursDay,
} from "@/hooks/useOrgSettings"

const DAY_LABELS: Record<BusinessHoursDay["day"], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

function OrganizationTab() {
  const { data: org, isLoading } = useOrgSettings()
  const updateSettings = useUpdateOrgSettings()
  const uploadLogo = useUploadOrgLogo()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")
  const [businessHours, setBusinessHours] = useState<BusinessHoursDay[]>(DEFAULT_BUSINESS_HOURS)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setPhone(org.settings.phone ?? "")
    setAddress(org.settings.address ?? "")
    setTimezone(org.settings.timezone ?? "America/New_York")
    setBusinessHours(org.settings.business_hours ?? DEFAULT_BUSINESS_HOURS)
    setLogoUrl(org.settings.logo_url ?? null)
  }, [org])

  function updateDay(index: number, patch: Partial<BusinessHoursDay>) {
    setBusinessHours((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadLogo.mutateAsync(file)
      setLogoUrl(url)
      toast.success("Logo uploaded")
    } catch (error) {
      toast.error("Failed to upload logo", { description: error instanceof Error ? error.message : undefined })
    }
  }

  function handleSave() {
    updateSettings.mutate(
      { name, settings: { phone, address, timezone, business_hours: businessHours, logo_url: logoUrl } },
      {
        onSuccess: () => toast.success("Organization settings saved"),
        onError: (error) => toast.error("Failed to save settings", { description: error.message }),
      }
    )
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Business Info</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Business name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-phone">Phone</Label>
            <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-address">Address</Label>
            <Input id="org-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-timezone">Timezone</Label>
            <Input
              id="org-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-logo">Logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="Organization logo" className="h-10 w-10 rounded object-contain" />}
              <Input id="org-logo" type="file" accept="image/*" onChange={handleLogoChange} disabled={uploadLogo.isPending} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Business Hours</h2>
        <div className="mt-4 space-y-2">
          {businessHours.map((day, index) => (
            <div key={day.day} className="flex items-center gap-3">
              <span className="w-24 text-sm text-slate-600">{DAY_LABELS[day.day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <Checkbox checked={!day.closed} onCheckedChange={(checked) => updateDay(index, { closed: !checked })} />
                Open
              </label>
              <Input
                type="time"
                className="h-8 w-28"
                value={day.open}
                disabled={day.closed}
                onChange={(e) => updateDay(index, { open: e.target.value })}
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="time"
                className="h-8 w-28"
                value={day.close}
                disabled={day.closed}
                onChange={(e) => updateDay(index, { close: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  )
}

function AiDefaultsTab() {
  const { data: org, isLoading } = useOrgSettings()
  const updateSettings = useUpdateOrgSettings()
  const [defaults, setDefaults] = useState<AiEmployeeDefaults>({
    default_voice: "",
    default_personality: "",
    default_escalation_rules: "",
  })

  useEffect(() => {
    if (org?.settings.ai_defaults) setDefaults(org.settings.ai_defaults)
  }, [org])

  function handleSave() {
    updateSettings.mutate(
      { settings: { ai_defaults: defaults } },
      {
        onSuccess: () => toast.success("AI Employee defaults saved"),
        onError: (error) => toast.error("Failed to save defaults", { description: error.message }),
      }
    )
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Defaults for New AI Employees</h2>
        <p className="mt-1 text-xs text-slate-400">
          Prefills the creation form for a new AI Employee — doesn't retroactively change existing ones.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="default-voice">Default voice</Label>
            <Input
              id="default-voice"
              value={defaults.default_voice}
              onChange={(e) => setDefaults((d) => ({ ...d, default_voice: e.target.value }))}
              placeholder="e.g. Sarah (friendly, professional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-personality">Default personality</Label>
            <Textarea
              id="default-personality"
              value={defaults.default_personality}
              onChange={(e) => setDefaults((d) => ({ ...d, default_personality: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-escalation">Default escalation rules</Label>
            <Textarea
              id="default-escalation"
              value={defaults.default_escalation_rules}
              onChange={(e) => setDefaults((d) => ({ ...d, default_escalation_rules: e.target.value }))}
              rows={3}
              placeholder="e.g. Transfer to a human if the caller asks for a manager or mentions a complaint."
            />
          </div>
        </div>
      </div>
      <Button onClick={handleSave} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  )
}

function NotificationsTab() {
  const { data: org, isLoading } = useOrgSettings()
  const updateSettings = useUpdateOrgSettings()
  const [preferences, setPreferences] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setPreferences(org?.settings.notification_preferences ?? {})
  }, [org])

  function isEnabled(key: string): boolean {
    return preferences[key] !== false
  }

  function handleSave() {
    updateSettings.mutate(
      { settings: { notification_preferences: preferences } },
      {
        onSuccess: () => toast.success("Notification preferences saved"),
        onError: (error) => toast.error("Failed to save preferences", { description: error.message }),
      }
    )
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Notify Owners &amp; Admins When…</h2>
        <div className="mt-4 space-y-3">
          {NOTIFICATION_TYPES.map((type) => (
            <label key={type.key} className="flex items-start gap-3">
              <Checkbox
                checked={isEnabled(type.key)}
                onCheckedChange={(checked) => setPreferences((p) => ({ ...p, [type.key]: Boolean(checked) }))}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-slate-700">{type.label}</span>
                <span className="block text-xs text-slate-400">{type.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <Button onClick={handleSave} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  )
}

function IntegrationsTab() {
  const { data: employees } = useAiEmployees()
  const { subscription } = useSubscription()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined

  const services = [
    { name: "Retell (voice AI)", connected: (employees ?? []).some((e) => Boolean(e.retell_agent_id)) },
    { name: "Stripe (billing)", connected: Boolean(subscription) },
    { name: "Twilio (SMS)", connected: null },
    { name: "Resend (email)", connected: null },
    { name: "Clerk (auth)", connected: true },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Connected Services</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {services.map((service) => (
            <li key={service.name} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-700">{service.name}</span>
              {service.connected === null ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                  Configured via server secrets
                </Badge>
              ) : service.connected ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                  Not connected
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Webhook URLs</h2>
        <p className="mt-1 text-xs text-slate-400">Hand these to Retell/Stripe when configuring their webhooks.</p>
        <div className="mt-4 space-y-2 font-mono text-xs">
          <div className="rounded bg-slate-50 p-2 text-slate-600">{supabaseUrl}/functions/v1/retell-call-webhook</div>
          <div className="rounded bg-slate-50 p-2 text-slate-600">{supabaseUrl}/functions/v1/retell-inbound-webhook</div>
          <div className="rounded bg-slate-50 p-2 text-slate-600">{supabaseUrl}/functions/v1/stripe-webhook</div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">API Keys</h2>
        <p className="mt-1 text-xs text-slate-400">
          API keys and integration secrets are stored server-side as Supabase Edge Function secrets and are never
          exposed in the browser — there's nothing sensitive to display here by design.
        </p>
      </div>
    </div>
  )
}

function DangerZoneTab() {
  const { data: org } = useOrgSettings()
  const deleteOrg = useDeleteOrganization()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  function handleDelete() {
    deleteOrg.mutate(confirmText, {
      onSuccess: () => {
        toast.success("Organization deleted")
        window.location.href = "/"
      },
      onError: (error) => toast.error("Failed to delete organization", { description: error.message }),
    })
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/50 p-5">
      <h2 className="text-sm font-semibold text-red-800">Delete Organization</h2>
      <p className="mt-1 text-sm text-red-700">
        Permanently deletes this organization and everything in it — contacts, leads, deals, AI Employees, calls,
        campaigns, billing history, all of it. This cannot be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setConfirmOpen(true)}>
        Delete Organization
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {org?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the organization and every record in it. Type <strong>{org?.name}</strong> below
              to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={org?.name} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== org?.name || deleteOrg.isPending}
              onClick={handleDelete}
            >
              {deleteOrg.isPending ? "Deleting…" : "Permanently Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SettingsPageContent() {
  const { isOwner } = usePermissions()

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Workspace, notification, and account preferences.</p>
      </div>

      <Tabs defaultValue="organization" className="mt-6">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="ai-defaults">AI Employee Defaults</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          {isOwner && <TabsTrigger value="danger">Danger Zone</TabsTrigger>}
        </TabsList>
        <TabsContent value="organization">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="ai-defaults">
          <AiDefaultsTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        {isOwner && (
          <TabsContent value="danger">
            <DangerZoneTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <PermissionGate requiredRole={["owner", "admin"]}>
      <SettingsPageContent />
    </PermissionGate>
  )
}
