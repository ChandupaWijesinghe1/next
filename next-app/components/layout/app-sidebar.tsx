import { SidebarNav } from "./sidebar-nav"

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sm:flex">
      <div className="border-b border-sidebar-border px-6 py-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Navigation
        </p>
      </div>

      <SidebarNav />
    </aside>
  )
}
