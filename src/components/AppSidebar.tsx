import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  FolderClosed,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/kit";
import { ROLE_LABELS, signOut, useMyProfile, useMyRoles } from "@/hooks/useAuth";

const NAV = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Today", to: "/today", icon: Sun },
  { label: "Leads", to: "/leads", icon: Sparkles },
  { label: "Projects", to: "/projects", icon: FolderClosed },
  { label: "Schedule", to: "/schedule", icon: CalendarDays },
  { label: "Install Materials", to: "/materials", icon: Package },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useMyRoles();
  const primaryRole = roles[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-7">
        <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
          </svg>
        </div>
        <div className="text-[14px] leading-[1.15] font-bold tracking-[-0.02em]">
          COBBLESTONE
          <div className="mt-0.5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">TILE OS</div>
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
                "flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted",
              )}
            >
              <item.icon className="size-[17px]" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar
            initials={profile?.initials || profile?.full_name?.slice(0, 1) || "?"}
            tone={profile?.avatar_tone ?? "blue"}
            size={34}
          />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">
              {profile?.full_name || "Signed in"}
            </div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {primaryRole ? ROLE_LABELS[primaryRole] : "No role assigned"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-secondary-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
