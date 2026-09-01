import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  FolderClosed,
  LayoutDashboard,
  LogOut,
  Menu,
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
  const [open, setOpen] = useState(false);

  // Navigating on a phone closes the drawer.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => setOpen(true)}
      className="fixed top-2.5 left-2.5 z-40 grid size-10 cursor-pointer place-items-center rounded-xl border border-border bg-card text-secondary-foreground shadow-[var(--shadow-card)] md:hidden"
    >
      <Menu className="size-5" />
    </button>
    {open ? (
      <button
        type="button"
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
      />
    ) : null}
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-sidebar-border bg-sidebar",
        "transition-transform duration-200 md:z-30 md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
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
              preload="intent"
              className={cn(
                "flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] font-medium outline-none",
                "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 active:translate-y-[0.5px]",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
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
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md text-[12.5px] font-medium text-secondary-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
