import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown, Search } from "lucide-react";
import type { ReactNode } from "react";

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

export function AppHeader({
  crumbs,
  viewLabel = "OFFICE / ADMIN VIEW",
}: {
  crumbs: Crumb[];
  viewLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-8 backdrop-blur">
      <nav className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="font-semibold tracking-wide text-primary">{viewLabel}</span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 text-muted-foreground">
            <span className="text-border-strong">/</span>
            {c.to ? (
              <Crumbed crumb={c} />
            ) : (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <label className="relative hidden lg:block">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search projects, people, or tasks"
            className="h-9 w-[300px] rounded-lg border border-border bg-background pr-3 pl-9 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <button
          type="button"
          className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            2
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
            OT
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}

function Crumbed({ crumb }: { crumb: Crumb }): ReactNode {
  return (
    <Link
      to={crumb.to!}
      {...(crumb.params ? { params: crumb.params } : {})}
      className="truncate font-medium hover:text-foreground"
    >
      {crumb.label}
    </Link>
  );
}
