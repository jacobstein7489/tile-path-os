import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FolderClosed,
  Menu,
  Package,
  Percent,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/ops/AccountMenu";
import { useCapture } from "@/components/ops/CaptureProvider";
import { usePermissions } from "@/hooks/useAuth";

/** Everyday destinations. */
const NAV = [
  { label: "Today", short: "Today", to: "/today", icon: Sun },
  { label: "Work", short: "Work", to: "/work", icon: CheckSquare },
  { label: "Projects", short: "Jobs", to: "/projects", icon: FolderClosed },
  { label: "Schedule", short: "Sched", to: "/schedule", icon: CalendarDays },
  { label: "Materials", short: "Materials", to: "/materials", icon: Package },
] as const;

const MORE = [
  { label: "Commissions", to: "/commissions", icon: Percent, money: true },
  { label: "Reports", to: "/dashboard", icon: BarChart3, money: false },
  { label: "Settings", to: "/settings", icon: Settings, money: false },
] as const;

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => pathname === to || pathname.startsWith(to + "/");
}

export function AppSidebar() {
  const isActive = useIsActive();
  const openCapture = useCapture();
  const { canSeeMoney } = usePermissions();
  const [mobileMore, setMobileMore] = useState(false);

  const more = MORE.filter((item) => !item.money || canSeeMoney);

  return (
    <>
      {/* Desktop: one permanent, quiet rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[216px] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-[18px] pt-5 pb-7">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
            </svg>
          </div>
          <div className="text-[12px] leading-[1.15] font-bold text-foreground">
            COBBLESTONE
            <div className="mt-0.5 text-[9px] font-semibold tracking-[0.16em] text-muted-foreground">
              TILE OPERATIONS
            </div>
          </div>
        </div>

        <div className="px-3 pb-5">
          <button
            type="button"
            onClick={() => openCapture()}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary text-[12.5px] font-semibold text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary/90 active:translate-y-[0.5px] focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus className="size-4" /> Capture
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <NavRow key={item.to} item={item} active={isActive(item.to)} />
          ))}

          <div className="mt-6 px-3 pb-1 text-[9px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">More</div>
          {more.map((item) => <NavRow key={item.to} item={item} active={isActive(item.to)} />)}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="mt-2 flex items-center gap-2 px-1">
            <AccountMenu />
            <span className="text-[11.5px] text-muted-foreground">Account</span>
          </div>
        </div>
      </aside>

      {/* Phone: the five destinations people use while moving. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/98 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <PhoneTab item={NAV[0]} active={isActive(NAV[0].to)} />
        <PhoneTab item={NAV[1]} active={isActive(NAV[1].to)} />
        <button
          type="button"
          onClick={() => openCapture()}
          aria-label="Capture"
          className="flex min-h-[56px] cursor-pointer flex-col items-center justify-center gap-1"
        >
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-raised)]">
            <Plus className="size-5" />
          </span>
        </button>
        <PhoneTab item={NAV[2]} active={isActive(NAV[2].to)} />
        <button
          type="button"
          onClick={() => setMobileMore((v) => !v)}
          className={cn("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-semibold", mobileMore ? "text-primary" : "text-muted-foreground")}
        >
          <Menu className="size-5" /> More
        </button>
      </nav>

      {mobileMore ? (
        <div className="fixed inset-x-3 bottom-[68px] z-50 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-raised)] md:hidden">
          {[NAV[3], NAV[4], ...more].map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMobileMore(false)} className="flex min-h-12 items-center gap-3 border-b border-border px-4 text-sm font-semibold last:border-0">
              <item.icon className="size-4 text-muted-foreground" /> {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      preload="intent"
      className={cn(
        "flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-[12.5px] font-medium outline-none",
        "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className="size-[17px]" strokeWidth={active ? 2.2 : 1.8} />
      {item.label}
    </Link>
  );
}

function PhoneTab({
  item,
  active,
}: {
  item: { label: string; short: string; to: string; icon: NavItem["icon"] };
  active: boolean;
}) {
  return (
    <Link
      to={item.to}
      className={cn(
        "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-semibold",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <item.icon className="size-[20px]" strokeWidth={active ? 2.3 : 1.8} />
      {item.short}
    </Link>
  );
}
