import { Sparkles } from "lucide-react"
import type { ComponentType } from "react"
import { NavLink } from "react-router-dom"

import { useIsActivePartner } from "@/hooks/usePartner"
import { useIsJhdmAdmin } from "@/hooks/useJhdmAdmin"
import { useWhiteLabel } from "@/hooks/useWhiteLabel"
import { getNavSections } from "@/lib/nav-config"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SidebarProps {
  collapsed: boolean
  onNavigate?: () => void
}

export default function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  const { data: isPartner } = useIsActivePartner()
  const { data: isJhdmAdmin } = useIsJhdmAdmin()
  const { data: whiteLabel } = useWhiteLabel()

  const navSections = getNavSections({ isPartner: Boolean(isPartner), isJhdmAdmin: Boolean(isJhdmAdmin) })
  const brandName = whiteLabel?.company_name || "APEX-CRM"

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full w-full flex-col bg-apex-navy text-white">
        <div
          className={cn(
            "flex h-16 items-center border-b border-white/10 px-4",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex items-center gap-2">
            {whiteLabel?.custom_logo_url ? (
              <img
                src={whiteLabel.custom_logo_url}
                alt={brandName}
                className="h-9 w-9 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-apex-teal">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-base font-bold tracking-tight">
                  {whiteLabel?.company_name ? (
                    brandName
                  ) : (
                    <>
                      APEX<span className="text-apex-teal">-CRM</span>
                    </>
                  )}
                </div>
                <div className="truncate text-[11px] text-white/50">
                  AI Workforce CRM
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  {section.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavItem item={item} collapsed={collapsed} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  )
}

function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: { label: string; to: string; icon: ComponentType<{ className?: string }> }
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
          collapsed && "justify-center px-0 py-2.5",
          isActive && "bg-apex-teal text-white hover:bg-apex-teal"
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
