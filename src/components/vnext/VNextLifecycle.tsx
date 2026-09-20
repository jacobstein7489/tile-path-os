import { Check } from "lucide-react";
import { VNEXT_STAGES, type VNextStage } from "@/lib/vnext";
import { cn } from "@/lib/utils";

export function VNextLifecycle({ stage, compact = false }: { stage: VNextStage; compact?: boolean }) {
  const current = VNEXT_STAGES.indexOf(stage);
  return (
    <div className={cn("overflow-x-auto", compact ? "py-1" : "py-2")}>
      <div className="grid min-w-[970px] grid-cols-12 items-start">
        {VNEXT_STAGES.map((item, index) => {
          const done = index < current;
          const active = index === current;
          return <div key={item} className="relative flex min-w-0 flex-col items-center text-center">
            {index > 0 ? <span className={cn("absolute top-[13px] right-1/2 h-px w-full", index <= current ? "bg-vnext-blue" : "bg-vnext-line")} /> : null}
            <span className={cn("relative z-10 grid size-[27px] place-items-center rounded-full border text-[10px] font-extrabold", done ? "border-vnext-blue bg-vnext-blue text-vnext-surface" : active ? "border-vnext-ink bg-vnext-ink text-vnext-surface shadow-[var(--vnext-shadow-mark)]" : "border-vnext-line bg-vnext-surface text-vnext-faint")}>{done ? <Check className="size-3.5" /> : index + 1}</span>
            <span className={cn("mt-2 max-w-[86px] text-[9px] leading-[1.25] font-bold", active ? "text-vnext-ink" : done ? "text-vnext-blue" : "text-vnext-faint")}>{item}</span>
          </div>;
        })}
      </div>
    </div>
  );
}
