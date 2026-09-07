import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  FolderClosed,
  LogOut,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/kit";
import { QuickCapture } from "@/components/QuickCapture";
import { ROLE_LABELS, signOut, useMyProfile, useMyRoles } from "@/hooks/useAuth";

/** Global navigation for the Job Operations product. */
const NAV = [
  { label: "Today", short: "Today", to: "/today", icon: Sun },
  { label: "Work", short: "Work", to: "/work", icon: CheckSquare },
  { label: "Projects", short: "Jobs", to: "/projects", icon: FolderClosed },
  { label: "Schedule", short: "Sched", to: "/schedule", icon: CalendarDays },
  { label: "Settings", short: "More", to: "/settings", icon: Settings },
] as const;

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

export function AppSidebar() {
  const isActive = useIsActive();
  const { data: profile } = useMyProfile();
  const { data: roles = [] } = useMyRoles();
  const primaryRole = roles[0];
  const [capture, setCapture] = useState(false);

  return (
    <>
      {/* Desktop: one permanent, quiet rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[216px] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-6">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
            </svg>
          </div>
          <div className="text-[13px] leading-[1.15] font-bold tracking-[-0.02em]">
            COBBLESTONE
            <div className="mt-0.5 text-[9.5px] font-semibold tracking-[0.16em] text-muted-foreground">
              JOB OPERATIONS
            </div>
          </div>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setCapture(true)}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary/90 active:translate-y-[0.5px] focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus className="size-4" /> Capture
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] font-medium outline-none",
                  "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-[17px]" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar
              initials={profile?.initials || profile?.full_name?.slice(0, 1) || "?"}
              tone={profile?.avatar_tone ?? "blue"}
              size={30}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">
                {profile?.full_name || "Signed in"}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {primaryRole ? ROLE_LABELS[primaryRole] : "No role assigned"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Phone: bottom tab bar plus one capture button — no hidden drawer. */}
      <button
        type="button"
        onClick={() => setCapture(true)}
        aria-label="Quick capture"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 grid size-14 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-raised)] active:scale-95 md:hidden"
      >
        <Plus className="size-6" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/98 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-[20px]" strokeWidth={active ? 2.3 : 1.8} />
              {item.short}
            </Link>
          );
        })}
      </nav>

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
    </>
  );
}
