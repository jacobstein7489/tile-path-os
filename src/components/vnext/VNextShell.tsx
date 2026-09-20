import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BriefcaseBusiness, CalendarDays, CheckSquare2, Menu, Sparkles, Sun, UsersRound } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Today", to: "/vnext", icon: Sun },
  { label: "Jobs", to: "/vnext/jobs", icon: BriefcaseBusiness },
  { label: "Actions", to: "/work", icon: CheckSquare2 },
  { label: "Schedule", to: "/schedule", icon: CalendarDays },
  { label: "Customers", to: "/customers", icon: UsersRound },
] as const;

export function VNextShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="vnext min-h-screen bg-vnext-canvas text-vnext-ink">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-vnext-line bg-vnext-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Link to="/vnext" className="flex shrink-0 items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[11px] bg-vnext-ink text-vnext-surface shadow-[var(--vnext-shadow-mark)]">
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" /></svg>
            </span>
            <span className="hidden sm:block">
              <strong className="block font-display text-[13px] leading-none">COBBLESTONE</strong>
              <span className="mt-1 block text-[9px] font-extrabold tracking-[0.16em] text-vnext-blue uppercase">Tile OS · VNext</span>
            </span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="VNext navigation">
            {NAV.map((item) => {
              const active = item.to === "/vnext" ? pathname === item.to : pathname.startsWith(item.to);
              return <Link key={item.to} to={item.to} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-bold transition-colors", active ? "bg-vnext-ink text-vnext-surface" : "text-vnext-muted hover:bg-vnext-wash hover:text-vnext-ink")}><item.icon className="size-3.5" />{item.label}</Link>;
            })}
          </nav>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-vnext-line bg-vnext-wash px-2.5 py-1 text-[10px] font-extrabold text-vnext-muted uppercase"><Sparkles className="size-3 text-vnext-blue" /> Visual gate</span>
          </div>
          <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen((value) => !value)} className="ml-auto grid size-9 place-items-center rounded-lg border border-vnext-line bg-vnext-surface md:hidden"><Menu className="size-4" /></button>
        </div>
        {mobileOpen ? <nav className="grid gap-1 border-t border-vnext-line bg-vnext-surface p-3 md:hidden">{NAV.map((item) => <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-bold hover:bg-vnext-wash"><item.icon className="size-4 text-vnext-blue" />{item.label}</Link>)}</nav> : null}
      </header>
      <main className="min-h-screen pt-[68px]"><Outlet /></main>
    </div>
  );
}
