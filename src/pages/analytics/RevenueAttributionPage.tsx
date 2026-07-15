import { ArrowRight, Bot, CheckCircle2, CircleDollarSign, User, UserPlus, type LucideIcon } from "lucide-react"

import { MetricCard } from "@/components/overview/MetricCard"
import { Skeleton } from "@/components/ui/skeleton"
import { useRevenueAttribution, type AttributionChainLink } from "@/hooks/useRevenueAttribution"
import { useSubscription } from "@/hooks/useSubscription"
import { PLANS, type PlanId } from "@/lib/plans"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

function ChainNode({
  icon: Icon,
  label,
  detail,
  highlight,
}: {
  icon: LucideIcon
  label: string
  detail?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5",
        highlight ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", highlight ? "text-green-600" : "text-slate-400")} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{label}</p>
        {detail && <p className="truncate text-[10px] text-slate-400">{detail}</p>}
      </div>
    </div>
  )
}

function AttributionChain({ link }: { link: AttributionChainLink }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/60 p-3">
      {link.attributionMethod === "lead_match" && link.leadId ? (
        <>
          <ChainNode
            icon={UserPlus}
            label="AI-Sourced Lead"
            detail={link.leadCreatedAt ? formatDate(link.leadCreatedAt) : undefined}
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
        </>
      ) : link.aiEmployeeName ? (
        <>
          <ChainNode icon={Bot} label={link.aiEmployeeName} detail="Created this opportunity" />
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
        </>
      ) : null}
      <ChainNode icon={User} label={link.contactName} detail="Contact" />
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
      <ChainNode icon={CircleDollarSign} label={link.dealTitle} detail={formatCurrency(link.dealValue)} />
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
      <ChainNode icon={CheckCircle2} label="Won" detail={formatDate(link.wonAt)} highlight />
    </div>
  )
}

function RoiCalculator({ pipelineValue, closedRevenueThisMonth }: { pipelineValue: number; closedRevenueThisMonth: number }) {
  const { subscription, planId, isLoading } = useSubscription()
  const plan = planId ? PLANS[planId as PlanId] : null

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!subscription || !plan) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-400">Subscribe to a plan to see your ROI.</p>
      </div>
    )
  }

  const monthlyCost = plan.priceMonthly
  const roi = monthlyCost > 0 ? ((closedRevenueThisMonth - monthlyCost) / monthlyCost) * 100 : null

  return (
    <div className="rounded-lg border border-apex-teal/20 bg-apex-teal/5 p-6">
      <h2 className="text-sm font-semibold text-slate-800">ROI Calculator</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <p>
          You pay <span className="font-semibold text-slate-900">{formatCurrency(monthlyCost)}/month</span> for Apex ({plan.name}).
        </p>
        <p>
          This month, your AI Employees have generated{" "}
          <span className="font-semibold text-slate-900">{formatCurrency(pipelineValue)}</span> in open pipeline and{" "}
          <span className="font-semibold text-slate-900">{formatCurrency(closedRevenueThisMonth)}</span> in closed revenue.
        </p>
      </div>
      <div className="mt-4 rounded-md bg-white p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Return on Investment (this month)</p>
        <p className={cn("mt-1 text-3xl font-bold", roi !== null && roi >= 0 ? "text-green-600" : "text-slate-900")}>
          {roi !== null ? `${roi >= 0 ? "+" : ""}${roi.toFixed(0)}%` : "—"}
        </p>
        <p className="mt-1 text-xs text-slate-400">(Closed revenue − monthly cost) ÷ monthly cost</p>
      </div>
    </div>
  )
}

export default function RevenueAttributionPage() {
  const { data, isLoading } = useRevenueAttribution()

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revenue Attribution</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revenue directly traceable to your AI Employees — from first contact to closed deal.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Revenue Influenced (all time)"
          isLoading={isLoading}
          value={formatCurrency(data?.totalClosedRevenueAllTime ?? 0)}
          subtext={data ? `${data.totalClosedDealsAllTime} deals` : undefined}
        />
        <MetricCard
          label="Current AI-Sourced Pipeline"
          isLoading={isLoading}
          value={formatCurrency(data?.currentPipelineValue ?? 0)}
          subtext={data ? `${data.currentPipelineDealCount} open deals` : undefined}
        />
        <MetricCard
          label="Closed This Month"
          isLoading={isLoading}
          value={formatCurrency(data?.closedRevenueThisMonth ?? 0)}
        />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        A deal counts as AI-attributed when either an AI Employee directly created the opportunity during a call, or
        its contact matches an AI-sourced lead by phone/email (best-effort — not a hard link in every case).
      </p>

      <div className="mt-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <RoiCalculator
            pipelineValue={data?.currentPipelineValue ?? 0}
            closedRevenueThisMonth={data?.closedRevenueThisMonth ?? 0}
          />
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Top Attributed Deals</h2>
        <p className="text-xs text-slate-400">Your highest-value won deals, traced from lead or AI action to closed revenue.</p>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.topAttributedDeals || data.topAttributedDeals.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No AI-attributed won deals yet.</p>
          ) : (
            data.topAttributedDeals.map((link) => <AttributionChain key={link.dealId} link={link} />)
          )}
        </div>
      </div>
    </div>
  )
}
