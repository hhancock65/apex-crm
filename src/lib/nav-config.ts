import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CheckSquare,
  CircuitBoard,
  Contact,
  Crown,
  DollarSign,
  FileText,
  Gauge,
  Handshake,
  KanbanSquare,
  Layers,
  LineChart,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Notebook,
  Phone,
  Plug,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  Target,
  Users,
  Webhook,
  Workflow,
} from "lucide-react"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const BASE_NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/", icon: Gauge },
      { label: "AI Command Center", to: "/ai-command-center", icon: Sparkles },
      { label: "Activity Feed", to: "/activity-feed", icon: Activity },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Leads", to: "/leads", icon: Target },
      { label: "Contacts", to: "/contacts", icon: Contact },
      { label: "Companies", to: "/companies", icon: Building2 },
      { label: "Pipeline", to: "/pipeline", icon: KanbanSquare },
      { label: "Deals", to: "/deals", icon: DollarSign },
    ],
  },
  {
    title: "AI Workforce",
    items: [
      { label: "AI Employees", to: "/ai-employees", icon: Bot },
      { label: "AI Activity", to: "/ai-activity", icon: CircuitBoard },
      { label: "Conversations", to: "/conversations", icon: MessagesSquare },
      { label: "Messages", to: "/messages", icon: MessageSquare },
      { label: "Calls", to: "/calls", icon: Phone },
      { label: "Campaigns", to: "/campaigns", icon: Megaphone },
      { label: "Knowledge Base", to: "/knowledge-base", icon: Layers },
    ],
  },
  {
    title: "Productivity",
    items: [
      { label: "Tasks", to: "/tasks", icon: CheckSquare },
      { label: "Calendar", to: "/calendar", icon: Calendar },
      { label: "Appointments", to: "/appointments", icon: Calendar },
      { label: "Notes", to: "/notes", icon: Notebook },
    ],
  },
  {
    title: "Automation",
    items: [
      { label: "Workflows", to: "/workflows", icon: Workflow },
      { label: "Triggers", to: "/triggers", icon: Webhook },
      { label: "Templates", to: "/templates", icon: FileText },
      { label: "Integrations", to: "/integrations", icon: Plug },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Sales Analytics", to: "/analytics/sales", icon: BarChart3 },
      { label: "AI Performance", to: "/analytics/ai-performance", icon: LineChart },
      { label: "Conversion Analytics", to: "/analytics/conversion", icon: Target },
      { label: "Revenue Attribution", to: "/analytics/revenue-attribution", icon: DollarSign },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Team", to: "/admin/team", icon: Users },
      { label: "Roles & Permissions", to: "/admin/roles-permissions", icon: Shield },
      { label: "Billing", to: "/admin/billing", icon: Receipt },
      { label: "Usage", to: "/admin/usage", icon: Gauge },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
]

/**
 * Partner/JHDM nav items are conditional on data only known once Clerk +
 * Supabase have both loaded (useIsActivePartner/useIsJhdmAdmin), so this is
 * a function Sidebar calls with that state rather than a static export —
 * everything else in this file stays exactly as it was.
 */
export function getNavSections(options: { isPartner: boolean; isJhdmAdmin: boolean }): NavSection[] {
  const sections = [...BASE_NAV_SECTIONS]

  if (options.isPartner) {
    sections.splice(1, 0, {
      title: "Partner",
      items: [{ label: "Partner Dashboard", to: "/partner/dashboard", icon: Handshake }],
    })
  }

  if (options.isJhdmAdmin) {
    const adminSection = sections.find((s) => s.title === "Admin")
    adminSection?.items.push({ label: "JHDM Admin", to: "/admin/jhdm", icon: Crown })
  }

  return sections
}
