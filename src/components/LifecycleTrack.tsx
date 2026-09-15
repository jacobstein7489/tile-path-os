import { AlertCircle, Check, ChevronRight, Lock } from "lucide-react";
import { LIFECYCLE_STAGES, canEnterStage, nextStage, normalizeStage, stageIndex } from "@/lib/lifecycle";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Stage detail: the seven controlled operating stages plus the named readiness
 * blockers behind the current one.
 *
 * Stage is a controlled state — it only moves forward, and only when the user
 * (or a defined system event) advances it. A blocker never pushes a project
 * backward; it is simply shown. Manual sub-workflow checkboxes are retired:
 * everything here is derived from real records.
 */

export type StageBlocker = {
  label: string;
  detail?: string | null;
  category: string;
};

export function LifecycleTrack({
  stage,
  exceptionState,
  blockers = [],
  hasScheduleAssignment = false,
  onAdvance,
}: {
  stage: string;
  exceptionState?: string | null;
  blockers?: StageBlocker[];
  hasScheduleAssignment?: boolean;
  onAdvance?: (to: string) => void;
}) {
  const normalized = normalizeStage(stage);
  const current = stageIndex(stage);
  const next = nextStage(stage);
  const gate = next
    ? canEnterStage(next, { blockers: blockers.length, hasScheduleAssignment })
    : { ok: false, reason: "Project is complete" };
  const canAdvance = Boolean(next) && gate.ok && !exceptionState;

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Stage {current + 1}/{LIFECYCLE_STAGES.length}
          </span>
          <span className="text-[14px] font-semibold tracking-tight">{normalized}</span>
          {exceptionState ? <Chip tone="amber">{exceptionState}</Chip> : null}
          <span className="text-[11.5px] text-muted-foreground tabular-nums">
            {blockers.length === 0 ? "No open blockers" : `${blockers.length} blocker(s)`}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {next && onAdvance ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => onAdvance(next)}
              title={
                canAdvance
                  ? `Advance to ${next}`
                  : exceptionState
                    ? `Project is ${exceptionState}`
                    : (gate.reason ?? "Not ready")
              }
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors duration-100",
                canAdvance
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              {canAdvance ? null : <Lock className="size-3.5" />}
              Move to {next}
              {canAdvance ? <ChevronRight className="size-3.5" /> : null}
            </button>
          ) : null}
        </div>
      </div>

      <ol className="flex items-start px-4 pt-1 pb-3.5">
        {LIFECYCLE_STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === LIFECYCLE_STAGES.length - 1;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-[2px] flex-1 rounded-full",
                    i === 0 ? "opacity-0" : done || active ? "bg-success/40" : "bg-track",
                  )}
                />
                <span
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full border text-[9.5px] font-bold",
                    done && "border-success bg-success text-primary-foreground",
                    active &&
                      "border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--primary-soft)]",
                    !done && !active && "border-border-strong bg-card text-muted-foreground/70",
                  )}
                >
                  {done ? <Check className="size-2.5" strokeWidth={3.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "h-[2px] flex-1 rounded-full",
                    last ? "opacity-0" : done ? "bg-success/40" : "bg-track",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-1.5 px-0.5 text-center text-[10px] leading-[1.2] tracking-tight",
                  active
                    ? "font-semibold text-primary"
                    : done
                      ? "font-medium text-success/90"
                      : "text-muted-foreground/60",
                )}
              >
                {s}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border bg-muted/40 px-5 py-3">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          What is holding this back · derived from records
        </div>
        {blockers.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-secondary-foreground">
            Nothing outstanding was found. Stage still moves forward only when you say so.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {blockers.slice(0, 8).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{b.label}</span>
                  <span className="ml-1.5 text-muted-foreground">{b.category}</span>
                  {b.detail ? (
                    <span className="ml-1.5 text-muted-foreground">· {b.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
            {blockers.length > 8 ? (
              <li className="text-[12px] text-muted-foreground">
                +{blockers.length - 8} more
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  );
}
