import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  FolderClosed,
  LayoutDashboard,
  Package,
  Settings,
  Sun,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Today", to: "/today", icon: Sun },
  { label: "Projects", to: "/projects", icon: FolderClosed },
  { label: "Schedule", to: "/schedule", icon: CalendarDays },
  { label: "Materials", to: "/materials", icon: Package },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[248px] flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
          </svg>
        </div>
        <div className="text-[15px] leading-tight font-bold tracking-tight">
          Cobblestone
          <br />
          Tile OS
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">Cobblestone Tile Co.</div>
            <div className="truncate text-xs text-muted-foreground">New York, NY</div>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          Company Overview <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </aside>
  );
}
