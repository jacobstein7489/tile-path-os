import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

/**
 * Quiet context bar. Breadcrumb only — no decorative search or fake badges.
 * Identity and sign-out live in the sidebar, so this stays out of the way.
 */
export function AppHeader({ crumbs }: { crumbs: Crumb[]; viewLabel?: string }) {
  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-card/90 px-4 shadow-[var(--shadow-card)] backdrop-blur-xl md:flex md:px-7">
      <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-card)] md:hidden" aria-label="Cobblestone Tile Operations">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
          <path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" />
        </svg>
      </div>
      <nav className="flex min-w-0 items-center gap-2 text-xs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 ? <span className="text-border-strong">/</span> : null}
            {c.to ? (
              <Crumbed crumb={c} />
            ) : (
              <span className="truncate font-bold text-foreground">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
}

function Crumbed({ crumb }: { crumb: Crumb }): ReactNode {
  return (
    <Link
      to={crumb.to!}
      {...(crumb.params ? { params: crumb.params } : {})}
      className="truncate font-medium text-muted-foreground hover:text-foreground"
    >
      {crumb.label}
    </Link>
  );
}
