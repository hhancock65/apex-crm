import { useOrganization, UserButton } from "@clerk/clerk-react"
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"

import { NotificationBell } from "@/components/layout/NotificationBell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface HeaderProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenMobileMenu: () => void
}

export default function Header({
  collapsed,
  onToggleCollapsed,
  onOpenMobileMenu,
}: HeaderProps) {
  const { organization } = useOrganization()

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>

      <div className="hidden shrink-0 items-center gap-2 border-r border-slate-200 pr-3 sm:flex">
        <span className="text-sm font-semibold text-slate-800">
          {organization?.name ?? "Personal Workspace"}
        </span>
      </div>

      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Search leads, contacts, deals…"
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  )
}
