import { Check } from "lucide-react";
import { LIFECYCLE_STAGES, STAGE_SUB_WORKFLOWS, stageIndex } from "@/lib/lifecycle";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Reusable FULL 12-stage master lifecycle. Status/context above the project —
 * never a navigation menu.
 */
export function LifecycleTrack({
  stage,
  exceptionState,
}: {
  stage: string;
  exceptionState?: string | null;
}) {
  const current = stageIndex(stage);
  const sub = STAGE_SUB_WORKFLOWS[stage as keyof typeof STAGE_SUB_WORKFLOWS];

  return (
    <section className="surface px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            Master Lifecycle
          </h2>
          <Chip tone="blue">{stage}</Chip>
          {exceptionState ? <Chip tone="amber">{exceptionState}</Chip> : null}
        </div>
        <span className="text-xs text-muted-foreground">
          Stage {current + 1} of {LIFECYCLE_STAGES.length}
        </span>
      </div>

      <ol className="mt-5 flex items-start">
        {LIFECYCLE_STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="relative flex min-w-0 flex-1 flex-col items-center">
              {i > 0 ? (
                <span
                  className={cn(
                    "absolute top-[11px] right-1/2 left-0 h-[2px]",
                    i <= current ? "bg-primary" : "bg-track",
                  )}
                />
              ) : null}
              {i < LIFECYCLE_STAGES.length - 1 ? (
                <span
                  className={cn(
                    "absolute top-[11px] right-0 left-1/2 h-[2px]",
                    i < current ? "bg-primary" : "bg-track",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-6 place-items-center rounded-full border-2 bg-background text-[10px] font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-4 ring-primary-soft",
                  !done && !active && "border-track text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-2 px-1 text-center text-[11px] leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>

      {sub ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            {stage} sub-workflow:
          </span>
          {sub.map((step) => (
            <Chip key={step}>{step}</Chip>
          ))}
        </div>
      ) : null}
    </section>
  );
}
