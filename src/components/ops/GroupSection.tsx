import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A project or person group. The whole header toggles — the chevron is only
 * feedback, never the target you have to hit.
 */
export function GroupSection({
  title,
  meta,
  open,
  onToggle,
  projectId,
  avatar,
  children,
}: {
  title: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  projectId?: string | null;
  avatar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-[68px] flex-1 cursor-pointer items-center gap-3 px-3.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 md:px-4"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
              !open && "-rotate-90",
            )}
          />
          {avatar}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16.5px] leading-tight font-bold tracking-[-0.02em]">
              {title}
            </span>
            <span className="mt-1 block truncate text-[12.5px] font-medium text-muted-foreground">
              {meta}
            </span>
          </span>
        </button>
        {projectId ? (
          <Link
            to="/projects/$projectId"
            params={{ projectId }}
            className="hidden shrink-0 items-center border-l border-border px-4 text-[13px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft/60 md:flex"
          >
            View project →
          </Link>
        ) : null}
      </div>
      {open ? <div className="border-t border-border px-1 py-1.5 md:px-1.5">{children}</div> : null}
    </section>
  );
}
