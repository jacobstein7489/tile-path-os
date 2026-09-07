import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, TextInput } from "@/components/kit";
import { VoiceField } from "@/components/VoiceField";
import { OwnerPicker } from "@/components/ops/OwnerPicker";
import { DatePicker } from "@/components/ops/DatePicker";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import {
  actionDate,
  isComplete,
  simpleStatus,
  storedStatus,
  TASK_STATUSES,
  useAddWorkNote,
  useCreateWorkItems,
  useSaveWorkItem,
  useWorkItemEvents,
  type TaskStatus,
  type WorkItemRow,
} from "@/lib/workitems";
import { firstName, humanDate, humanDateTime, nextBusinessMilestone } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Outcome = "Keep Open" | "Waiting" | "Next Step" | "Done";

/**
 * The operating panel for one task. It opens as a summary with two decisions —
 * move it forward, or complete it — and only becomes editable where you click.
 */
export function TaskDrawer({
  item,
  onClose,
  onOpenTask,
}: {
  item: WorkItemRow | null;
  onClose: () => void;
  onOpenTask?: (id: string) => void;
}) {
  const save = useSaveWorkItem();
  const addNote = useAddWorkNote();
  const create = useCreateWorkItems();
  const { data: events = [] } = useWorkItemEvents(item?.id ?? null);

  const [mode, setMode] = useState<"summary" | "forward">("summary");
  const [what, setWhat] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [waitingOn, setWaitingOn] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [nextTitle, setNextTitle] = useState("");
  const [nextOwner, setNextOwner] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    setMode("summary");
    setWhat("");
    setOutcome(null);
    setWaitingOn("");
    setFollowUp(null);
    setNextTitle("");
    setNextDate(null);
    setNextOwner({ id: null, name: null });
  }, [item?.id]);

  if (!item) return null;

  const done = isComplete(item);
  const status = simpleStatus(item.status);
  const date = actionDate(item);
  const metaLine = [status, firstName(item.owner) || "Unassigned", humanDate(date) || null]
    .filter(Boolean)
    .join(" · ");

  const patch = (values: Partial<WorkItemRow>, note?: string) =>
    save.mutate({ id: item.id, patch: values, ...(note ? { note } : {}) });

  const finishForward = async () => {
    if (!outcome) return;
    const happened = what.trim();
    if (happened) await addNote.mutateAsync({ id: item.id, message: happened });

    if (outcome === "Keep Open") {
      patch({ status: "Open" });
      toast.success("Update saved · task still open");
    }
    if (outcome === "Waiting") {
      patch({
        status: "Waiting",
        waiting_on: waitingOn.trim() || item.waiting_on,
        follow_up_on: followUp,
      });
      toast.success("Update saved · now waiting");
    }
    if (outcome === "Done") {
      patch({ status: "Complete", completed_at: new Date().toISOString() });
      toast.success("Task completed");
    }
    if (outcome === "Next Step") {
      const title = nextTitle.trim();
      if (!title) {
        toast.error("Give the next step a name");
        return;
      }
      patch({ status: "Complete", completed_at: new Date().toISOString() });
      const ids = await create.mutateAsync([
        {
          project_id: item.project_id,
          item_type: "Task",
          title,
          owner_user_id: nextOwner.id ?? item.owner_user_id,
          owner: nextOwner.name ?? item.owner,
          due_date: nextDate,
          status: "Open",
          ...(happened ? { description: `Follows: ${item.title}` } : {}),
        },
      ]);
      toast.success("Next step created");
      const nextId = ids[0];
      if (nextId && onOpenTask) {
        onOpenTask(nextId);
        return;
      }
    }
    onClose();
  };

  const suggestion = nextBusinessMilestone();

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-[520px]"
      title={
        <span className="block">
          <span className="block text-[12px] font-semibold text-muted-foreground">
            {item.projects?.name ?? "Company"}
          </span>
          <span className="mt-1 block text-[20px] leading-tight font-bold tracking-[-0.02em]">
            {item.title}
          </span>
        </span>
      }
      subtitle={mode === "summary" ? metaLine : undefined}
    >
      {mode === "forward" ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setMode("summary")}
            className="-ml-1 flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back
          </button>

          <div>
            <h3 className="mb-2 text-[17px] font-bold tracking-[-0.01em]">What happened?</h3>
            <VoiceField
              label="Update"
              value={what}
              onChange={setWhat}
              rows={3}
              placeholder="Spoke with Millie. Replacement material expected Friday."
            />
          </div>

          <div>
            <h3 className="mb-2 text-[17px] font-bold tracking-[-0.01em]">What next?</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {(["Keep Open", "Waiting", "Next Step", "Done"] as Outcome[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    setOutcome(o);
                    if (o === "Waiting" && !followUp) setFollowUp(suggestion.iso);
                  }}
                  className={cn(
                    "min-h-[64px] cursor-pointer rounded-xl border px-3 py-3 text-left text-[14.5px] font-semibold outline-none transition-[background-color,border-color] duration-150",
                    outcome === o
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background hover:border-border-strong",
                  )}
                >
                  {o}
                  <span className="mt-0.5 block text-[11.5px] font-medium text-muted-foreground">
                    {o === "Keep Open"
                      ? "Still working on it"
                      : o === "Waiting"
                        ? "Held up by someone"
                        : o === "Next Step"
                          ? "Done — created new work"
                          : "Finished, nothing left"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {outcome === "Waiting" ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold">Waiting on</span>
                <TextInput
                  value={waitingOn}
                  placeholder="Infinity Tile"
                  onChange={(e) => setWaitingOn(e.target.value)}
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">Follow up when</span>
                <DatePicker value={followUp} onChange={setFollowUp} size="md" />
              </div>
            </div>
          ) : null}

          {outcome === "Next Step" ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold">
                  What is the next step?
                </span>
                <TextInput
                  value={nextTitle}
                  autoFocus
                  placeholder="Confirm replacement primer delivery"
                  onChange={(e) => setNextTitle(e.target.value)}
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">Owner</span>
                <OwnerPicker
                  ownerUserId={nextOwner.id}
                  size="md"
                  onChange={(id, name) => setNextOwner({ id, name })}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">Date</span>
                <DatePicker value={nextDate} onChange={setNextDate} size="md" />
              </div>
            </div>
          ) : null}

          <Button
            className="w-full"
            disabled={!outcome}
            onClick={() => {
              void finishForward();
            }}
          >
            Save update
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2.5">
            {!done ? (
              <button
                type="button"
                onClick={() => setMode("forward")}
                className="flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                Move forward <ArrowRight className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                done
                  ? patch({ status: "Open", completed_at: null }, "Reopened")
                  : patch({ status: "Complete", completed_at: new Date().toISOString() }, "Completed")
              }
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border text-[14.5px] font-semibold outline-none transition-colors duration-150",
                done
                  ? "border-border bg-background hover:bg-muted"
                  : "border-success/35 bg-success-soft text-success hover:bg-success/15",
              )}
            >
              <Check className="size-4" /> {done ? "Reopen task" : "Complete"}
            </button>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <MetaRow label="Owner">
              <OwnerPicker
                ownerUserId={item.owner_user_id}
                fallbackName={item.owner}
                size="md"
                onChange={(id, name) => patch({ owner_user_id: id, owner: name })}
              />
            </MetaRow>
            <MetaRow label="Status">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusOpen((v) => !v)}
                  className="min-h-10 cursor-pointer rounded-lg px-2 text-[14px] font-medium outline-none hover:bg-muted"
                >
                  {status}
                </button>
                <Popover
                  open={statusOpen}
                  onClose={() => setStatusOpen(false)}
                  align="right"
                  title="Status"
                  width="md:w-48"
                >
                  {TASK_STATUSES.map((s: TaskStatus) => (
                    <PopoverItem
                      key={s}
                      active={s === status}
                      onClick={() => {
                        setStatusOpen(false);
                        patch({
                          status: storedStatus(s),
                          completed_at: s === "Done" ? new Date().toISOString() : null,
                        });
                      }}
                    >
                      {s}
                    </PopoverItem>
                  ))}
                </Popover>
              </div>
            </MetaRow>
            <MetaRow label="Follow-up">
              <DatePicker
                value={item.follow_up_on ?? item.due_date ?? null}
                size="md"
                onChange={(next) =>
                  patch(item.follow_up_on ? { follow_up_on: next } : { due_date: next })
                }
              />
            </MetaRow>
            {item.waiting_on ? (
              <MetaRow label="Waiting on">
                <span className="px-2 text-[14px]">{item.waiting_on}</span>
              </MetaRow>
            ) : null}
            <MetaRow label="Important">
              <button
                type="button"
                aria-label="Mark important"
                onClick={() => patch({ is_important: !item.is_important })}
                className="grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-muted"
              >
                <Star
                  className={cn(
                    "size-[18px]",
                    item.is_important ? "fill-warning text-warning" : "text-border-strong",
                  )}
                />
              </button>
            </MetaRow>
          </div>

          {events.length ? (
            <div>
              <h3 className="mb-2 text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
                History
              </h3>
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="border-l-2 border-border pl-3">
                    <div className="text-[11.5px] font-semibold text-muted-foreground">
                      {humanDateTime(e.created_at)}
                      {e.actor ? ` · ${e.actor}` : ""}
                    </div>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed">{e.message}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 bg-card px-3">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
