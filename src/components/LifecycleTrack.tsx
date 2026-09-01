import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { LIFECYCLE_STAGES, STAGE_SUB_WORKFLOWS, nextStage, stageIndex } from "@/lib/lifecycle";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Reusable full 10-stage master lifecycle. Status/context above the project —
 * never a navigation menu.
 *
 * The rail is always visible and deliberately quiet: completed stages read
 * green, the current stage reads blue, future stages stay grey. The stage
 * sub-workflow is detail, so it lives behind "Stage detail". Stages whose
 * sub-workflow is system-driven (Closeout / Return) render as read-only state,
 * never as manual checkboxes.
 */

/** Sub-workflows that are derived from records, not ticked by hand. */
const SYSTEM_DRIVEN_STAGES = new Set(["Closeout / Return"]);

export function LifecycleTrack({
  stage,
  exceptionState,
  stepsDone = [],
  onToggleStep,
  onAdvance,
  systemStepState,
}: {
  stage: string;
  exceptionState?: string | null;
  stepsDone?: string[];
  onToggleStep?: (step: string) => void;
  onAdvance?: (to: string) => void;
  /** For system-driven stages: the derived state of each step. */
  systemStepState?: Record<string, { done: boolean; detail?: string }>;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const current = stageIndex(stage);
  const sub = STAGE_SUB_WORKFLOWS[stage as keyof typeof STAGE_SUB_WORKFLOWS];
  const next = nextStage(stage);
  const systemDriven = SYSTEM_DRIVEN_STAGES.has(stage);
  const isDone = (step: string) =>
    systemDriven ? Boolean(systemStepState?.[step]?.done) : stepsDone.includes(step);
  const remaining = (sub ?? []).filter((s) => !isDone(s));
  const canAdvance = Boolean(next) && remaining.length === 0 && !exceptionState;

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Stage {current + 1}/{LIFECYCLE_STAGES.length}
          </span>
          <span className="text-[14px] font-semibold tracking-tight">{stage}</span>
          {exceptionState ? <Chip tone="amber">{exceptionState}</Chip> : null}
          {sub ? (
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {sub.length - remaining.length}/{sub.length} steps
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {sub ? (
            <button
              type="button"
              onClick={() => setShowDetail((s) => !s)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-secondary-foreground transition-colors duration-100 hover:text-foreground"
            >
              Stage detail
              <ChevronDown
                className={cn("size-3.5 transition-transform", showDetail && "rotate-180")}
              />
            </button>
          ) : null}
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
                    : `${remaining.length} ${stage} step${remaining.length === 1 ? "" : "s"} outstanding`
              }
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors duration-100",
                canAdvance
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              {canAdvance ? null : <Lock className="size-3.5" />}
              Advance to {next}
              {canAdvance ? <ChevronRight className="size-3.5" /> : null}
            </button>
          ) : null}
        </div>
      </div>

      {/* Compact always-visible rail */}
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

      {/* Stage sub-workflow — detail, hidden until asked for */}
      {sub && showDetail ? (
        <div className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {stage} Workflow ·{" "}
            {systemDriven ? "tracked automatically from records" : "inside this stage"}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sub.map((step) => {
              const done = isDone(step);
              const detail = systemDriven ? systemStepState?.[step]?.detail : undefined;
              const inner = (
                <>
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      done ? "border-success bg-success text-background" : "border-border-strong",
                    )}
                  >
                    {done ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
                  </span>
                  <span>{step}</span>
                  {detail ? (
                    <span className="text-[11px] font-normal text-muted-foreground">{detail}</span>
                  ) : null}
                </>
              );
              const shell = cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                done
                  ? "border-success/30 bg-success-soft text-success"
                  : "border-border bg-background text-secondary-foreground",
              );

              if (systemDriven) {
                return (
                  <span key={step} className={shell} title="Derived from project records">
                    {inner}
                  </span>
                );
              }
              return (
                <button
                  key={step}
                  type="button"
                  disabled={!onToggleStep}
                  onClick={() => onToggleStep?.(step)}
                  className={cn(
                    shell,
                    "transition-colors duration-100",
                    onToggleStep ? "hover:border-border-strong" : "cursor-default",
                  )}
                >
                  {inner}
                </button>
              );
            })}
          </div>
          {systemDriven ? (
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">
              These states come from punch / return work items and the schedule — they are not
              ticked by hand.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
