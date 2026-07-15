import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsJhdmAdmin, usePlatformOrganizations, usePlatformPartners, useUpdatePartnerStatus } from "@/hooks/useJhdmAdmin"
import { PLANS, type PlanId } from "@/lib/plans"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { PartnerStatus, PlatformPartnerRow } from "@/types/partner"

const PARTNER_STATUS_CLASSES: Record<PartnerStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-green-200 bg-green-50 text-green-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])

function planName(planId: string | null): string {
  if (!planId) return "No plan"
  return PLANS[planId as PlanId]?.name ?? planId
}

function PartnerStatusActions({ partner }: { partner: PlatformPartnerRow }) {
  const updateStatus = useUpdatePartnerStatus()

  async function setStatus(status: PartnerStatus) {
    try {
      await updateStatus.mutateAsync({ partnerId: partner.partner_id, status })
      toast.success(`${partner.partner_name} ${status === "active" ? "approved" : status}`)
    } catch (error) {
      toast.error("Failed to update partner status", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (partner.status === "pending") {
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => setStatus("suspended")}>
          Reject
        </Button>
        <Button size="sm" disabled={updateStatus.isPending} onClick={() => setStatus("active")}>
          Approve
        </Button>
      </div>
    )
  }

  if (partner.status === "active") {
    return (
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={updateStatus.isPending}
          onClick={() => setStatus("suspended")}
        >
          Suspend
        </Button>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => setStatus("active")}>
        Reactivate
      </Button>
    </div>
  )
}

export default function JHDMAdminPage() {
  const { data: isJhdmAdmin, isLoading: adminCheckLoading } = useIsJhdmAdmin()
  const { data: partners, isLoading: partnersLoading } = usePlatformPartners(Boolean(isJhdmAdmin))
  const { data: organizations, isLoading: orgsLoading } = usePlatformOrganizations(Boolean(isJhdmAdmin))

  if (adminCheckLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!isJhdmAdmin) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-500">You don't have access to this page.</p>
      </div>
    )
  }

  const orgs = organizations ?? []
  const totalOrgs = orgs.length
  const totalAiEmployees = orgs.reduce((sum, o) => sum + o.ai_employee_count, 0)
  const totalCalls = orgs.reduce((sum, o) => sum + o.calls_count, 0)
  // Apex's own list-price MRR — deliberately NOT partner_organizations.
  // monthly_rate summed here (that's a partner's custom rate with THEIR
  // client, a different number from what Apex itself is actually billing
  // via Stripe for that org's subscription). See migration 0021's header.
  const totalMrr = orgs.reduce((sum, o) => {
    if (!o.plan_id || !ACTIVE_SUBSCRIPTION_STATUSES.has(o.subscription_status ?? "")) return sum
    return sum + (PLANS[o.plan_id as PlanId]?.priceMonthly ?? 0)
  }, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">JHDM Admin</h1>
      <p className="mt-1 text-sm text-slate-500">Platform-wide partner and organization management.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Organizations</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{orgsLoading ? "—" : totalOrgs}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total AI Employees</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{orgsLoading ? "—" : totalAiEmployees.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Calls</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{orgsLoading ? "—" : totalCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total MRR</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{orgsLoading ? "—" : formatCurrency(totalMrr)}</p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Partners</h2>
        <div className="mt-3">
          {partnersLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !partners || partners.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No partners yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing Type</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Partner MRR</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.partner_id}>
                    <TableCell>
                      <p className="font-medium text-slate-800">{partner.partner_name}</p>
                      <p className="text-xs text-slate-400">{partner.email ?? partner.contact_name ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PARTNER_STATUS_CLASSES[partner.status]}>
                        {partner.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{partner.billing_type.replace("_", " ")}</TableCell>
                    <TableCell>{partner.client_count}</TableCell>
                    <TableCell>{formatCurrency(partner.partner_mrr)}</TableCell>
                    <TableCell>{formatDate(partner.created_at)}</TableCell>
                    <TableCell>
                      <PartnerStatusActions partner={partner} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">All Organizations</h2>
        <div className="mt-3">
          {orgsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : orgs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No organizations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>AI Employees</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => (
                  <TableRow key={org.org_id}>
                    <TableCell className="font-medium text-slate-800">{org.org_name}</TableCell>
                    <TableCell>{org.partner_name ?? <span className="text-slate-400">Direct</span>}</TableCell>
                    <TableCell>{planName(org.plan_id)}</TableCell>
                    <TableCell>{org.ai_employee_count}</TableCell>
                    <TableCell>{org.calls_count.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(org.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
