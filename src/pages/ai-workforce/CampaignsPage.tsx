import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { CreateCampaignWizard } from "@/components/ai-workforce/campaigns/CreateCampaignWizard"
import { FeatureGate } from "@/components/billing/FeatureGate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDefaultCampaignFilters, useCampaigns } from "@/hooks/useCampaigns"
import { formatDate } from "@/lib/utils"
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPE_LABELS,
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

export default function CampaignsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(getDefaultCampaignFilters)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: campaigns, isLoading, error } = useCampaigns(filters)

  return (
    <FeatureGate feature="campaigns">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns</h1>
            <p className="mt-1 text-sm text-slate-500">
              Outbound sequences run by your AI Workforce — reactivation, nurture, and follow-up.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Create Campaign</Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ status: value as CampaignStatus | "all" })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {CAMPAIGN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading campaigns…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">
              Failed to load campaigns: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          ) : !campaigns || campaigns.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No campaigns yet. Create one to start reactivating leads or reaching new prospects.
            </p>
          ) : (
            campaigns.map((campaign) => {
              const progressPct =
                campaign.total_contacts > 0
                  ? Math.round((campaign.contacts_processed / campaign.total_contacts) * 100)
                  : 0

              return (
                <div
                  key={campaign.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/campaigns/${campaign.id}`)
                  }}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{campaign.name}</span>
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600">
                          {CAMPAIGN_TYPE_LABELS[campaign.type]}
                        </Badge>
                        <Badge variant="outline" className={STATUS_BADGE_CLASSES[campaign.status]}>
                          {STATUS_LABELS[campaign.status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {campaign.ai_employee?.name ?? "No AI Employee assigned"}
                        {campaign.started_at && ` · Started ${formatDate(campaign.started_at)}`}
                        {campaign.completed_at && ` · Completed ${formatDate(campaign.completed_at)}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
                      <div className="w-40">
                        <div className="flex items-center justify-between">
                          <span>
                            {campaign.contacts_processed}/{campaign.total_contacts}
                          </span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-apex-teal"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-800">
                          {campaign.appointments_booked}
                        </div>
                        <div>appointments</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <CreateCampaignWizard open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </FeatureGate>
  )
}
