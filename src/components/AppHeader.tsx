import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type Crumb = { label: string; to?: string; params?: Record<string, string> };

/**
 * Quiet context bar. Breadcrumb only — no decorative search or fake badges.
 * Identity and sign-out live in the sidebar, so this stays out of the way.
 */
export function AppHeader({ crumbs }: { crumbs: Crumb[]; viewLabel?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-card/95 px-4 backdrop-blur md:px-7">
      <nav className="flex min-w-0 items-center gap-2 text-xs">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 ? <span className="text-border-strong">/</span> : null}
            {c.to ? (
              <Crumbed crumb={c} />
            ) : (
              <span className="truncate font-semibold text-foreground">{c.label}</span>
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
