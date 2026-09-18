import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronDown, Paperclip, Star } from "lucide-react";
import { toast } from "sonner";
import { Button, Combobox, DateField, Field, TextArea, TextInput } from "@/components/kit";
import { VoiceField } from "@/components/VoiceField";
import { profileOptions, useCompanies, useContacts, useProfiles } from "@/lib/people";
import { useAreasWithSurfaces } from "@/lib/data";
import {
  currentMoveState,
  MOVE_STATES,
  useMoveForward,
  type MoveSnapshot,
  type MoveState,
} from "@/lib/moveforward";
import { isComplete, useSaveWorkItem, useWorkItemEvents, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Canonical full-page work item editor. Every screen links to the same route
 * and renders this component against the same work_items record.
 *
 * Hierarchy: title + context → owner → current state → ONE dominant Move
 * Forward action → secondary waiting/follow-up, notes, files, history.
 */

const STATE_TONE: Record<MoveState, string> = {
  "To Do": "bg-foreground",
  Waiting: "bg-warning",
  Scheduled: "bg-primary",
  Done: "bg-success",
};

export function WorkItemPanel({ item }: { item: WorkItemRow | null }) {
  const save = useSaveWorkItem();
  const { move, undo, isPending: moving } = useMoveForward();
  const { data: events = [] } = useWorkItemEvents(item?.id ?? null);
  const { data: profiles = [] } = useProfiles();
  const { data: contacts = [] } = useContacts();
  const { data: companies = [] } = useCompanies();
  const { areas, surfaces } = useAreasWithSurfaces(item?.project_id ?? "");

  const [moveOpen, setMoveOpen] = useState(false);
  const [note, setNote] = useState("");
  const [next, setNext] = useState<MoveState>("To Do");
  const [waitingOn, setWaitingOn] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!item) return;
    setMoveOpen(false);
    setNote("");
    setNext(currentMoveState(item) === "Done" ? "To Do" : currentMoveState(item));
    setWaitingOn(item.waiting_on ?? "");
    setFollowUpOn(item.follow_up_on ?? "");
    setScheduledFor(item.due_date ?? "");
    setDescription(item.description ?? "");
    setDueDate(item.due_date ?? null);
    setTitle(item.title);
    setHistoryOpen(false);
  }, [item]);

  const waitingOptions = useMemo(() => {
    const rows = [
      ...profiles.map((p) => ({ value: p.full_name, label: p.full_name, hint: "Employee" })),
      ...contacts.map((c) => ({
        value: c.full_name,
        label: c.full_name,
        hint: c.title ?? "Contact",
      })),
      ...companies.map((c) => ({ value: c.name, label: c.name, hint: "Company" })),
    ];
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.value) ? false : (seen.add(r.value), true)));
  }, [profiles, contacts, companies]);

  if (!item) return null;

  const state = currentMoveState(item);
  const done = isComplete(item);
  const areaName = areas.data?.find((a) => a.id === item.area_id)?.name ?? null;
  const surfaceName = surfaces.data?.find((s) => s.id === item.surface_id)?.name ?? null;
  const ownerName =
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? null;

  const runMove = async () => {
    const target = next;
    const previous: MoveSnapshot = await move({
      item,
      next: target,
      note,
      waitingOn,
      followUpOn,
      scheduledFor,
    });
    setMoveOpen(false);
    setNote("");
    if (target === "Done") {
      toast.success("Completed", {
        description: item.title,
        action: {
          label: "Undo",
          onClick: () => void undo(item.id, previous).then(() => toast("Completion undone")),
        },
      });
    } else {
      toast.success(`Moved to ${target}`, {
        action: {
          label: "Undo",
          onClick: () => void undo(item.id, previous).then(() => toast("Change undone")),
        },
      });
    }
  };

  const saveDetails = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: {
        title: title.trim() || item.title,
        description: description || null,
      },
      note: "Details updated",
    });
    toast.success("Saved");
  };

  const saveDueDate = async (next: string | null) => {
    const previous = dueDate;
    setDueDate(next);
    setScheduledFor(next ?? "");
    try {
      await save.mutateAsync({
        id: item.id,
        patch: { due_date: next },
        note: next ? `Due date set to ${next}` : "Due date cleared",
      });
      toast.success(next ? "Due date saved" : "Due date cleared");
    } catch {
      setDueDate(previous);
      setScheduledFor(previous ?? "");
      toast.error("Due date was not saved. Please try again.");
    }
  };

  return (
    <article className="mx-auto w-full max-w-[980px] rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="border-b border-border px-4 py-5 sm:px-7 sm:py-6">
        <span className="block">
          <span className="v2-kicker block">
            {item.project_id ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId: item.project_id }}
                className="hover:underline"
              >
                {item.projects?.name ?? "Project"}
              </Link>
            ) : (
              "Company · no job"
            )}
            {areaName ? ` · ${areaName}` : ""}
            {surfaceName ? ` · ${surfaceName}` : ""}
          </span>
          <span className="mt-2 block text-[21px] leading-snug font-bold md:text-[24px]">
            {item.title}
          </span>
        </span>
        <span className="mt-3 inline-flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-semibold text-secondary-foreground">
            <span className={cn("size-1.5 rounded-full", STATE_TONE[state])} />
            {state}
          </span>
          <span>{ownerName ? `Owner ${ownerName}` : "Unassigned"}</span>
        </span>
      </header>
      <div className="px-4 py-6 sm:px-7">
        <div className="space-y-6">
          {/* Owner — the only always-visible assignment control. */}
          <Field label="Owner">
            <Combobox
              options={profileOptions(profiles)}
              value={item.owner_user_id ?? null}
              onChange={(v) =>
                save.mutate({
                  id: item.id,
                  patch: {
                    owner_user_id: v || null,
                    owner: v ? (profiles.find((p) => p.user_id === v)?.full_name ?? null) : null,
                  },
                  note: "Owner changed",
                })
              }
              placeholder="Unassigned"
            />
          </Field>

          {/* ONE dominant action. */}
          <section className="border-y border-primary/25 bg-primary-soft/35">
            {moveOpen ? (
              <div className="space-y-4 px-4 py-4">
                <VoiceField
                  label="What happened?"
                  value={note}
                  onChange={setNote}
                  placeholder="Spoke with Millie. Material expected Monday."
                  rows={3}
                />
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-secondary-foreground">
                    What happens next?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {MOVE_STATES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNext(s)}
                        aria-pressed={next === s}
                        className={
                          next === s
                            ? "min-h-11 cursor-pointer rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background"
                            : "min-h-11 cursor-pointer rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-secondary-foreground transition-colors hover:bg-muted"
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {next === "Waiting" ? (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="Waiting on">
                      <Combobox
                        options={waitingOptions}
                        value={waitingOn || null}
                        onChange={(v) => setWaitingOn(v ?? "")}
                        onCreate={(label) => setWaitingOn(label)}
                        createLabel="Use"
                        placeholder="Person, vendor or trade"
                      />
                    </Field>
                    <Field label="Follow up on">
                      <DateField
                        value={followUpOn || null}
                        label="Follow up on"
                        placeholder="Pick a date"
                        onChange={(v) => setFollowUpOn(v ?? "")}
                      />
                    </Field>
                  </div>
                ) : null}

                {next === "Scheduled" ? (
                  <Field
                    label="Scheduled for"
                    hint="Stored on this item's date — crew scheduling stays on the Schedule screen."
                  >
                    <DateField
                      value={scheduledFor || null}
                      label="Scheduled for"
                      placeholder="Pick a date"
                      onChange={(v) => setScheduledFor(v ?? "")}
                    />
                  </Field>
                ) : null}

                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={() => void runMove()} loading={moving}>
                    {next === "Done" ? "Complete" : `Move to ${next}`}
                  </Button>
                  <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setMoveOpen(true)}
                className="h-auto w-full justify-between rounded-none px-4 py-5 text-left hover:bg-primary-soft/60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                    {done ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
                  </span>
                  <span>
                    <span className="v2-kicker block !text-primary">Primary action</span>
                    <span className="mt-1 block text-[16px] font-bold text-foreground">
                      Move forward
                    </span>
                    <span className="mt-0.5 block text-[12px] font-medium text-muted-foreground">
                      Record what happened and decide what comes next
                    </span>
                  </span>
                </span>
                <span className="text-primary">→</span>
              </Button>
            )}
          </section>

          {/* Secondary context — read-first, never a wall of controls. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border pb-5 text-[13px]">
            <div>
              <dt className="v2-kicker">Waiting on</dt>
              <dd className="mt-1 font-medium">{item.waiting_on ?? "—"}</dd>
            </div>
            <div>
              <dt className="v2-kicker">Follow up</dt>
              <dd className="mt-1 font-medium">{item.follow_up_on ?? "—"}</dd>
            </div>
            <div>
              <dt className="v2-kicker">Type</dt>
              <dd className="mt-1 font-medium">{item.item_type}</dd>
            </div>
            {item.next_action ? (
              <div className="col-span-2">
                <dt className="v2-kicker">Next action</dt>
                <dd className="mt-1 font-medium">{item.next_action}</dd>
              </div>
            ) : null}
          </dl>

          {/* Due date — always editable, on every item type and every state. */}
          <Field
            label="Due date"
            hint="Set, change or clear the date this action is due. Available on any work item."
          >
            <div className="flex items-center gap-2">
              <DateField
                value={dueDate}
                label="Due date"
                placeholder="No due date"
                onChange={(v) => void saveDueDate(v || null)}
              />
            </div>
          </Field>

          <Field label="Action">
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 text-[16px] md:text-[14px]"
            />
          </Field>

          <Field label="Notes">
            <TextArea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, decisions, anything useful."
            />
          </Field>

          {item.project_id ? (
            <Link
              to="/projects/$projectId/files"
              params={{ projectId: item.project_id }}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-[13px] font-semibold text-primary transition-colors hover:border-border-strong hover:bg-muted/40"
            >
              <Paperclip className="size-4" /> Files and photos for this job
            </Link>
          ) : null}

          <section className="border-t border-border">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between text-[12.5px] font-semibold text-secondary-foreground"
            >
              History {events.length ? `· ${events.length}` : ""}
              <ChevronDown
                className={cn("size-4 transition-transform", historyOpen && "rotate-180")}
              />
            </button>
            {historyOpen ? (
              <ul className="space-y-3 border-t border-border py-3">
                {events.map((e) => (
                  <li key={e.id} className="text-[12.5px] leading-relaxed">
                    <span className="font-medium">{e.message}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {new Date(e.created_at).toLocaleString()}
                      {e.actor ? ` · ${e.actor}` : ""}
                    </span>
                  </li>
                ))}
                <li className="text-[12.5px] text-muted-foreground">
                  Created {new Date(item.created_at).toLocaleDateString()}
                  {item.created_by ? ` by ${item.created_by}` : ""}
                </li>
              </ul>
            ) : null}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="ghost"
              className={cn(item.is_important ? "text-warning" : "text-muted-foreground")}
              onClick={() =>
                save.mutate({
                  id: item.id,
                  patch: { is_important: !item.is_important },
                  note: item.is_important ? "Unmarked important" : "Marked important",
                })
              }
              aria-pressed={Boolean(item.is_important)}
            >
              <Star className={cn("size-4", item.is_important && "fill-warning text-warning")} />
              {item.is_important ? "Important" : "Mark important"}
            </Button>
            <Button variant="primary" onClick={() => void saveDetails()} loading={save.isPending}>
              Save details
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
