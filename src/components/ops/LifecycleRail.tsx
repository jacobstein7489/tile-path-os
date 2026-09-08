import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { LIFECYCLE_STAGES, stageIndex } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

/**
 * One thin, quiet lifecycle rail. Sits directly beneath the project header:
 * completed stages read green, the current stage blue, future stages grey.
 * Clicking the rail reveals the stage detail passed in as `detail` (the full
 * stage workflow), so the large lifecycle card never occupies the page.
 */
export function LifecycleRail({
  stage,
  exceptionState,
  detail,
}: {
  stage: string;
  exceptionState?: string | null;
  detail?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const current = stageIndex(stage);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Show stage detail"
        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-1 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/25"
      >
        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LIFECYCLE_STAGES.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s} className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "grid size-[15px] shrink-0 place-items-center rounded-full text-[8.5px] font-bold",
                    done && "bg-success text-primary-foreground",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "bg-track text-muted-foreground/70",
                  )}
                >
                  {done ? <Check className="size-2.5" strokeWidth={3.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[10.5px] leading-none tracking-tight whitespace-nowrap",
                    active
                      ? "font-semibold text-primary"
                      : done
                        ? "font-medium text-success/85"
                        : "text-muted-foreground/60",
                  )}
                >
                  {s}
                </span>
                {i < LIFECYCLE_STAGES.length - 1 ? (
                  <span
                    className={cn(
                      "ml-1 h-[2px] w-4 rounded-full md:w-3.5",
                      done ? "bg-success/35" : "bg-track",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        <span className="hidden shrink-0 items-center gap-1 text-[11.5px] font-medium text-muted-foreground group-hover:text-foreground md:inline-flex">
          {exceptionState ?? "Stage detail"}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && detail ? <div className="mt-2">{detail}</div> : null}
    </div>
  );
}
