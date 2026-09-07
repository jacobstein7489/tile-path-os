import { useEffect, useRef, useState } from "react";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { OwnerPicker } from "@/components/ops/OwnerPicker";
import { DatePicker } from "@/components/ops/DatePicker";
import { actionDate, isComplete, isWaiting, useSaveWorkItem, type WorkItemRow } from "@/lib/workitems";
import { firstName, humanDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Every task everywhere in the product is this one row. */
export function TaskRow({
  item,
  onOpen,
  selected,
  showOwner = true,
  showProject = false,
}: {
  item: WorkItemRow;
  onOpen: (item: WorkItemRow) => void;
  selected?: boolean;
  showOwner?: boolean;
  showProject?: boolean;
}) {
  const save = useSaveWorkItem();
  const [completing, setCompleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  // A completion that is still lingering must not be lost if the view changes.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) {
        save.mutate({
          id: item.id,
          patch: { status: "Complete", completed_at: new Date().toISOString() },
          note: "Completed",
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const done = isComplete(item);
  const date = actionDate(item);
  const waiting = isWaiting(item);
  const overdue = Boolean(date && date < new Date().toISOString().slice(0, 10)) && !done;

  const complete = () => {
    if (done || completing) return;
    setCompleting(true);
    pending.current = true;
    timer.current = setTimeout(() => {
      pending.current = false;
      save.mutate({
        id: item.id,
        patch: { status: "Complete", completed_at: new Date().toISOString() },
        note: "Completed",
      });
    }, 800);
    toast.success("Completed", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          if (timer.current) clearTimeout(timer.current);
          pending.current = false;
          setCompleting(false);
          if (isComplete(item)) {
            save.mutate({ id: item.id, patch: { status: "Open", completed_at: null } });
          }
        },
      },
    });
  };

  const reopen = () =>
    save.mutate({ id: item.id, patch: { status: "Open", completed_at: null }, note: "Reopened" });

  const waitingLine = [
    item.waiting_on ? `Waiting on ${item.waiting_on}` : null,
    item.follow_up_on ? `Follow up ${humanDate(item.follow_up_on)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className={cn(
        "group relative flex cursor-pointer items-start gap-2 rounded-xl px-2 py-2.5 outline-none transition-colors duration-150 md:items-center md:gap-3 md:px-3",
        "hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary/30",
        selected && "bg-primary-soft/60 hover:bg-primary-soft/60",
        completing && "bg-success-soft",
      )}
    >
      <StarButton item={item} />

      <div className="min-w-0 flex-1">
        {showProject ? (
          <div className="truncate text-[11.5px] font-semibold text-muted-foreground">
            {item.projects?.name ?? "Company"}
          </div>
        ) : null}
        <div
          className={cn(
            "text-[15px] leading-snug font-semibold tracking-[-0.01em]",
            (done || completing) && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </div>
        {waiting && waitingLine ? (
          <div className="mt-0.5 truncate text-[12.5px] text-warning">{waitingLine}</div>
        ) : null}
        {/* Phone: owner and date sit under the title so nothing scrolls sideways. */}
        <div className="mt-1 flex flex-wrap items-center gap-1 md:hidden">
          {showOwner ? (
            <OwnerPicker
              ownerUserId={item.owner_user_id}
              fallbackName={item.owner}
              align="left"
              onChange={(userId, name) =>
                save.mutate({ id: item.id, patch: { owner_user_id: userId, owner: name } })
              }
            />
          ) : null}
          <DatePicker
            value={date}
            align="left"
            onChange={(next) =>
              save.mutate({
                id: item.id,
                patch: item.follow_up_on && !item.due_date ? { follow_up_on: next } : { due_date: next },
              })
            }
          />
        </div>
      </div>

      <div className="hidden items-center gap-1 md:flex">
        {showOwner ? (
          <OwnerPicker
            ownerUserId={item.owner_user_id}
            fallbackName={item.owner}
            onChange={(userId, name) =>
              save.mutate({ id: item.id, patch: { owner_user_id: userId, owner: name } })
            }
          />
        ) : null}
        <div className={cn("w-[92px] text-right", overdue && "font-semibold")}>
          <DatePicker
            value={date}
            onChange={(next) =>
              save.mutate({
                id: item.id,
                patch: item.follow_up_on && !item.due_date ? { follow_up_on: next } : { due_date: next },
              })
            }
          />
        </div>
      </div>

      <button
        type="button"
        aria-label={done ? "Reopen task" : "Complete task"}
        title={done ? "Reopen" : "Complete"}
        onClick={(e) => {
          e.stopPropagation();
          if (done) reopen();
          else complete();
        }}
        className={cn(
          "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 md:size-10",
        )}
      >
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150",
            done || completing
              ? "scale-105 border-success bg-success text-primary-foreground"
              : "border-border-strong text-transparent group-hover:border-success/70 hover:bg-success/10",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </button>
    </div>
  );
}

/** Star with a generous invisible hit area. */
export function StarButton({ item }: { item: WorkItemRow }) {
  const save = useSaveWorkItem();
  return (
    <button
      type="button"
      aria-label={item.is_important ? "Remove important" : "Mark important"}
      title="Mark important"
      aria-pressed={item.is_important}
      onClick={(e) => {
        e.stopPropagation();
        save.mutate({ id: item.id, patch: { is_important: !item.is_important } });
      }}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 md:size-9"
    >
      <Star
        className={cn(
          "size-[18px] transition-[color,transform] duration-150",
          item.is_important
            ? "scale-110 fill-warning text-warning"
            : "text-border-strong hover:text-warning",
        )}
      />
    </button>
  );
}

export function ownerLabel(item: WorkItemRow) {
  return firstName(item.owner) || "Unassigned";
}
