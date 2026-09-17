import type { ReactNode } from "react";
import { AppHeader, type Crumb } from "@/components/AppHeader";

export function PageShell({
  crumbs,
  title,
  subtitle,
  actions,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <AppHeader crumbs={crumbs} />
      <main className="mx-auto w-full max-w-[1520px] px-4 pt-6 pb-14 md:px-7 md:pt-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:gap-6">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] leading-tight font-bold md:text-[32px]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
        <div className="mt-7 space-y-5">{children}</div>
      </main>
    </>
  );
}

export function ComingLater({
  crumbs,
  title,
  note,
}: {
  crumbs: Crumb[];
  title: string;
  note: string;
}) {
  return (
    <PageShell crumbs={crumbs} title={title} subtitle={note}>
      <div className="surface flex h-56 items-center justify-center px-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          This module is intentionally not built yet. Phase 1 covers the design system, navigation,
          Projects, the project shell, the 12-stage lifecycle and Project Overview.
        </p>
      </div>
    </PageShell>
  );
}
