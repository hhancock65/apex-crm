import { useState } from "react"
import { Outlet } from "react-router-dom"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useApplyWhiteLabelStyles } from "@/hooks/useWhiteLabel"
import { cn } from "@/lib/utils"
import Header from "./Header"
import Sidebar from "./Sidebar"

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useApplyWhiteLabelStyles()

  return (
    <div className="flex min-h-screen bg-apex-surface">
      <div
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 md:block",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="fixed h-screen" style={{ width: collapsed ? "5rem" : "16rem" }}>
          <Sidebar collapsed={collapsed} />
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-none bg-apex-navy p-0">
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
