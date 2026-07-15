import { useOrganizationList } from "@clerk/clerk-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AddClientDialog } from "@/components/partner/AddClientDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePartnerDashboard } from "@/hooks/usePartner"
import { PLANS, type PlanId } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"
import type { PartnerClientRow } from "@/types/partner"

const LINK_STATUS_CLASSES: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  suspended: "border-slate-200 bg-slate-50 text-slate-600",
}

function planName(planId: string | null): string {
  if (!planId) return "No plan"
  return PLANS[planId as PlanId]?.name ?? planId
}

export default function PartnerDashboardPage() {
  const { data: clients, isLoading } = usePartnerDashboard()
  const { setActive, isLoaded } = useOrganizationList()
  const navigate = useNavigate()
  const [addClientOpen, setAddClientOpen] = useState(false)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)

  // Real Clerk org-switching, not a custom cross-tenant hack — the partner
  // is (or should be, per create-client-organization) an actual member of
  // this client's Clerk Organization, so this is the same mechanism the
  // built-in OrganizationSwitcher uses. Every existing page in this app
  // then works completely unchanged once switched, since get_user_org_id()
  // now genuinely resolves to the client org.
  async function handleViewClient(client: PartnerClientRow) {
    if (!isLoaded || !setActive) return
    setSwitchingOrgId(client.org_id)
    try {
      await setActive({ organization: client.org_clerk_id })
      navigate("/")
    } catch (error) {
      toast.error("Failed to switch to this client's dashboard", {
        description:
          error instanceof Error
            ? error.message
            : "Make sure you're still a member of this client's organization.",
      })
    } finally {
      setSwitchingOrgId(null)
    }
  }

  const totalClients = clients?.length ?? 0
  const totalMrr = (clients ?? []).reduce((sum, c) => sum + c.monthly_rate, 0)
  const totalCalls = (clients ?? []).reduce((sum, c) => sum + c.calls_this_month, 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partner Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your client organizations in one place.</p>
        </div>
        <Button onClick={() => setAddClientOpen(true)}>Add Client</Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Client Accounts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{isLoading ? "—" : totalClients}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total MRR</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{isLoading ? "—" : formatCurrency(totalMrr)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Calls This Month</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{isLoading ? "—" : totalCalls.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Clients</h2>
        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !clients || clients.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No clients yet — add your first one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Revenue</TableHead>
                  <TableHead>AI Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.org_id}>
                    <TableCell className="font-medium text-slate-800">{client.org_name}</TableCell>
                    <TableCell>{planName(client.plan_id)}</TableCell>
                    <TableCell>{formatCurrency(client.monthly_rate)}</TableCell>
                    <TableCell>{client.ai_employee_count}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={LINK_STATUS_CLASSES[client.link_status] ?? LINK_STATUS_CLASSES.suspended}
                      >
                        {client.link_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewClient(client)}
                        disabled={switchingOrgId === client.org_id}
                      >
                        {switchingOrgId === client.org_id ? "Switching…" : "View Dashboard"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
    </div>
  )
}
