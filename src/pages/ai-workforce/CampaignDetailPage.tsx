import { ArrowLeft, Pause, Play } from "lucide-react"
import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { MetricCard } from "@/components/overview/MetricCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getDefaultCampaignContactFilters,
  useCampaignContacts,
  useCampaignRealtime,
} from "@/hooks/useCampaignContacts"
import { useCampaign, useUpdateCampaign } from "@/hooks/useCampaigns"
import { formatDateTime } from "@/lib/utils"
import { contactFullName } from "@/types/contact"
import {
  CAMPAIGN_CONTACT_STATUSES,
  CAMPAIGN_TYPE_LABELS,
  type CampaignContactStatus,
  type CampaignStatus,
} from "@/types/campaign"

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
}

const STATUS_BADGE_CLASSES: Record<CampaignStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-green-200 bg-green-50 text-green-700",
  paused: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
}

const CONTACT_STATUS_LABELS: Record<CampaignContactStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  contacted: "Contacted",
  responded: "Responded",
  converted: "Converted",
  skipped: "Skipped",
  failed: "Failed",
}

const CONTACT_STATUS_CLASSES: Record<CampaignContactStatus, string> = {
  pending: "border-slate-200 bg-slate-50 text-slate-500",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  contacted: "border-slate-200 bg-slate-100 text-slate-700",
  responded: "border-teal-200 bg-teal-50 text-teal-700",
  converted: "border-green-200 bg-green-50 text-green-700",
  skipped: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: campaign, isLoading } = useCampaign(id)
  const updateCampaign = useUpdateCampaign()
  const [contactFilters, setContactFilters] = useState(getDefaultCampaignContactFilters)
  const { data: contactsData, isLoading: contactsLoading } = useCampaignContacts(id, contactFilters)

  useCampaignRealtime(id)

  async function togglePause() {
    if (!campaign) return
    const nextStatus: CampaignStatus = campaign.status === "active" ? "paused" : "active"
    try {
      await updateCampaign.mutateAsync({ id: campaign.id, updates: { status: nextStatus } })
      toast.success(nextStatus === "active" ? "Campaign resumed" : "Campaign paused")
    } catch (error) {
      toast.error("Failed to update campaign", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!campaign) {
    return <p className="py-10 text-center text-sm text-slate-400">Campaign not found.</p>
  }

  const conversionRate =
    campaign.contacts_processed > 0
      ? Math.round((campaign.contacts_responded / campaign.contacts_processed) * 100)
      : 0

  const contacts = contactsData?.contacts ?? []
  const total = contactsData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / contactFilters.pageSize))

  return (
    <div>
      <Link
        to="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
              {CAMPAIGN_TYPE_LABELS[campaign.type]}
            </Badge>
            <Badge variant="outline" className={STATUS_BADGE_CLASSES[campaign.status]}>
              {STATUS_LABELS[campaign.status]}
            </Badge>
            <span className="text-xs text-slate-400">{campaign.ai_employee?.name ?? "No AI Employee assigned"}</span>
          </div>
        </div>

        {(campaign.status === "active" || campaign.status === "paused") && (
          <Button variant="outline" onClick={togglePause} disabled={updateCampaign.isPending}>
            {campaign.status === "active" ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            )}
          </Button>
        )}
      </div>

      {/* Progress dashboard */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Contacts" value={campaign.total_contacts} />
        <MetricCard label="Processed" value={campaign.contacts_processed} />
        <MetricCard label="Responded" value={campaign.contacts_responded} />
        <MetricCard label="Appointments Booked" value={campaign.appointments_booked} />
        <MetricCard label="Conversion Rate" value={`${conversionRate}%`} />
      </div>

      {/* Contact list */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Contacts</h2>
          <Select
            value={contactFilters.status}
            onValueChange={(value) =>
              setContactFilters((prev) => ({
                ...prev,
                status: value as CampaignContactStatus | "all",
                page: 1,
              }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {CAMPAIGN_CONTACT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {CONTACT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 space-y-2">
          {contactsLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading contacts…</p>
          ) : contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No contacts match this filter.</p>
          ) : (
            contacts.map((cc) => (
              <div
                key={cc.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {cc.contact ? contactFullName(cc.contact) : "Unknown contact"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {cc.contact?.phone ?? "—"} · {cc.attempts} attempt{cc.attempts === 1 ? "" : "s"}
                    {cc.last_attempt_at && ` · Last attempt ${formatDateTime(cc.last_attempt_at)}`}
                  </p>
                  {cc.outcome && <p className="mt-0.5 truncate text-xs text-slate-400">{cc.outcome}</p>}
                </div>
                <Badge variant="outline" className={CONTACT_STATUS_CLASSES[cc.status]}>
                  {CONTACT_STATUS_LABELS[cc.status]}
                </Badge>
              </div>
            ))
          )}
        </div>

        {pageCount > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              page={contactFilters.page}
              pageCount={pageCount}
              onPageChange={(page) => setContactFilters((prev) => ({ ...prev, page }))}
            />
          </div>
        )}
      </div>
    </div>
  )
}
