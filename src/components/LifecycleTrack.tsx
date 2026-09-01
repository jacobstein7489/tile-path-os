import { Check, ChevronRight, Lock } from "lucide-react";
import { LIFECYCLE_STAGES, STAGE_SUB_WORKFLOWS, nextStage, stageIndex } from "@/lib/lifecycle";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Reusable full 10-stage master lifecycle. Status/context above the project —
 * never a navigation menu. The stage sub-workflow is rendered as a visually
 * separate band so it can never be confused with the master lifecycle.
 */
export function LifecycleTrack({
  stage,
  exceptionState,
  stepsDone = [],
  onToggleStep,
  onAdvance,
}: {
  stage: string;
  exceptionState?: string | null;
  stepsDone?: string[];
  onToggleStep?: (step: string) => void;
  onAdvance?: (to: string) => void;
}) {
  const current = stageIndex(stage);
  const sub = STAGE_SUB_WORKFLOWS[stage as keyof typeof STAGE_SUB_WORKFLOWS];
  const next = nextStage(stage);
  const remaining = (sub ?? []).filter((s) => !stepsDone.includes(s));
  const canAdvance = Boolean(next) && remaining.length === 0 && !exceptionState;

  return (
    <section className="surface overflow-hidden">
      {/* Master lifecycle */}
      <div className="px-6 pt-5 pb-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Master Lifecycle · Stage {current + 1} of {LIFECYCLE_STAGES.length}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <h2 className="text-[19px] leading-tight font-semibold tracking-tight">{stage}</h2>
              {exceptionState ? <Chip tone="amber">{exceptionState}</Chip> : null}
            </div>
          </div>
          {next ? (
            <div className="text-right">
              <button
                type="button"
                disabled={!canAdvance || !onAdvance}
                onClick={() => onAdvance?.(next)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition-colors",
                  canAdvance && onAdvance
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                {canAdvance ? null : <Lock className="size-3.5" />}
                Advance to {next}
                {canAdvance ? <ChevronRight className="size-4" /> : null}
              </button>
              {!canAdvance ? (
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  {exceptionState
                    ? `Project is ${exceptionState}`
                    : `${remaining.length} ${stage} step${remaining.length === 1 ? "" : "s"} outstanding`}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <ol className="mt-5 flex items-start">
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
                      i === 0 ? "opacity-0" : done || active ? "bg-primary/40" : "bg-track",
                    )}
                  />
                  <span
                    className={cn(
                      "grid size-[26px] shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors",
                      done && "border-primary/50 bg-primary/10 text-primary",
                      active &&
                        "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--primary-soft)]",
                      !done && !active && "border-border-strong bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "h-[2px] flex-1 rounded-full",
                      last ? "opacity-0" : done ? "bg-primary/40" : "bg-track",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "mt-2 px-1 text-center text-[10.5px] leading-[1.25] tracking-tight",
                    active
                      ? "font-semibold text-foreground"
                      : done
                        ? "text-secondary-foreground"
                        : "text-muted-foreground/70",
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Stage sub-workflow — clearly separate from the master lifecycle */}
      {sub ? (
        <div className="border-t border-border bg-muted/40 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {stage} Workflow · inside this stage
            </div>
            <div className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {sub.length - remaining.length} of {sub.length} complete
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sub.map((step) => {
              const done = stepsDone.includes(step);
              return (
                <button
                  key={step}
                  type="button"
                  disabled={!onToggleStep}
                  onClick={() => onToggleStep?.(step)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    done
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-border bg-background text-secondary-foreground",
                    onToggleStep ? "hover:border-border-strong" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full border",
                      done ? "border-success bg-success text-background" : "border-border-strong",
                    )}
                  >
                    {done ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
                  </span>
                  {step}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
