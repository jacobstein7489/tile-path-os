import { useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import { addDays, humanDate, nextBusinessMilestone, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Date as a plain clickable value. One tap gives Today / Tomorrow / the next
 * weekday / next week, and the change saves straight away.
 */
export function DatePicker({
  value,
  onChange,
  align = "right",
  emptyLabel = "Add date",
  tone = "auto",
  size = "sm",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  align?: "left" | "right";
  emptyLabel?: string;
  tone?: "auto" | "plain";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const milestone = nextBusinessMilestone();

  const overdue = tone === "auto" && value && value < today();
  const dueToday = tone === "auto" && value === today();

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        title={value ? "Change date" : "Add date"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
          size === "md" ? "min-h-10 text-[14px]" : "min-h-8 text-[13px]",
          overdue
            ? "text-danger"
            : dueToday
              ? "text-primary"
              : value
                ? "text-foreground"
                : "text-muted-foreground",
        )}
      >
        {value ? null : <CalendarPlus className="size-4" />}
        {value ? humanDate(value) : emptyLabel}
      </button>

      <Popover open={open} onClose={() => setOpen(false)} align={align} title="When">
        <PopoverItem active={value === today()} onClick={() => pick(today())}>
          Today
        </PopoverItem>
        <PopoverItem active={value === addDays(1)} onClick={() => pick(addDays(1))}>
          Tomorrow
        </PopoverItem>
        <PopoverItem active={value === milestone.iso} onClick={() => pick(milestone.iso)}>
          {milestone.label}
        </PopoverItem>
        <PopoverItem active={value === addDays(7)} onClick={() => pick(addDays(7))}>
          Next week
        </PopoverItem>
        <div className="relative">
          <PopoverItem
            onClick={() => {
              const el = nativeRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") el.showPicker();
              else el.focus();
            }}
          >
            Pick a date…
          </PopoverItem>
          <input
            ref={nativeRef}
            type="date"
            aria-label="Pick a date"
            value={value ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => pick(e.target.value || null)}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </div>
        {value ? (
          <PopoverItem tone="muted" onClick={() => pick(null)}>
            <X className="size-4" /> Clear date
          </PopoverItem>
        ) : null}
      </Popover>
    </div>
  );
}
