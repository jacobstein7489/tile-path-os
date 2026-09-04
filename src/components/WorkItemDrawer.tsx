import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Paperclip, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Combobox,
  DateField,
  Drawer,
  Field,
  Select,
  StepSequence,
  TextArea,
  TextInput,
} from "@/components/kit";
import { profileOptions, useProfiles } from "@/lib/people";
import {
  advanceWorkflow,
  isComplete,
  useAddWorkNote,
  useSaveWorkItem,
  useWorkItemEvents,
  workflowActionLabel,
  workflowFor,
  simpleStatus,
  storedStatus,
  TASK_CATEGORIES,
  TASK_STATUSES,
  WORK_ITEM_TYPES,
  type WorkItemRow,
} from "@/lib/workitems";

/**
 * Action-oriented work drawer. The user sees what needs to happen, one obvious
 * action, and who is involved. Technical classification lives under More details.
 */
export function WorkItemDrawer({
  item,
  onClose,
}: {
  item: WorkItemRow | null;
  onClose: () => void;
}) {
  const save = useSaveWorkItem();
  const addNote = useAddWorkNote();
  const { data: events = [] } = useWorkItemEvents(item?.id ?? null);
  const { data: profiles = [] } = useProfiles();
  const [form, setForm] = useState({
    title: "",
    owner_user_id: "" as string | null,
    waiting_on: "",
    status: "To Do",
    due_date: "",
    follow_up_on: "",
    category: "",
    next_action: "",
    item_type: "Task",
    description: "",
  });
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      title: item.title,
      owner_user_id: item.owner_user_id ?? null,
      waiting_on: item.waiting_on ?? "",
      status: simpleStatus(item.status),
      due_date: item.due_date ?? "",
      follow_up_on: item.follow_up_on ?? "",
      category: item.category ?? "",
      next_action: item.next_action ?? "",
      item_type: item.item_type,
      description: item.description ?? "",
    });
    setNote("");
    setMore(false);
  }, [item]);

  if (!item) return null;
  const wf = workflowFor(item);
  const done = isComplete(item);
  const actionLabel = workflowActionLabel(item);
  const set = (k: keyof typeof form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  const saveChanges = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: {
        title: form.title.trim() || item.title,
        owner_user_id: form.owner_user_id || null,
        owner: form.owner_user_id
          ? (profiles.find((p) => p.user_id === form.owner_user_id)?.full_name ?? null)
          : null,
        waiting_on: form.status === "Waiting" ? form.waiting_on || null : null,
        status: storedStatus(form.status),
        due_date: form.due_date || null,
        follow_up_on: form.status === "Waiting" ? form.follow_up_on || null : null,
        category: form.category || null,
        next_action: form.next_action || null,
        item_type: form.item_type,
        description: form.description || null,
      },
      note: "Work item updated",
    });
    toast.success("Saved");
    onClose();
  };

  const doAction = async () => {
    const patch = advanceWorkflow(item);
    if (!patch) return;
    await save.mutateAsync({ id: item.id, patch, note: actionLabel ?? "Progressed" });
    toast.success(patch.status === "Complete" ? "Item closed" : (actionLabel ?? "Done"));
  };

  const complete = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: { status: "Complete", completed_at: new Date().toISOString() },
      note: "Marked complete",
    });
    toast.success("Marked complete");
  };

  const reopen = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: { status: "Open", completed_at: null },
      note: "Reopened",
    });
    toast.success("Reopened");
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span>
          {item.project_id ? (
            <Link
              to="/projects/$projectId"
              params={{ projectId: item.project_id }}
              className="text-primary hover:underline"
            >
              {item.projects?.name ?? "Project"}
            </Link>
          ) : (
            <span className="text-muted-foreground">Company / Unassigned</span>
          )}
          <span className="px-1.5 text-muted-foreground">/</span>
          {item.title}
        </span>
      }
      subtitle={`${item.category ?? item.item_type} · ${simpleStatus(item.status)}`}
      footer={
        <>
          {done ? (
            <Button onClick={reopen} disabled={save.isPending}>
              Reopen
            </Button>
          ) : (
            <Button onClick={complete} disabled={save.isPending}>
              <Check className="size-4" /> Mark complete
            </Button>
          )}
          {wf && actionLabel && !done ? (
            <Button variant="primary" onClick={doAction} disabled={save.isPending}>
              {actionLabel}
            </Button>
          ) : null}
          <Button
            variant={wf && !done ? "secondary" : "primary"}
            onClick={saveChanges}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="What needs to happen">
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Describe the work"
          />
        </Field>

        <Field label="Next action (optional)">
          <TextInput
            value={form.next_action}
            onChange={(e) => set("next_action", e.target.value)}
            placeholder="The very next step"
          />
        </Field>

        <button
          type="button"
          onClick={() =>
            save.mutate({
              id: item.id,
              patch: { is_important: !item.is_important },
              note: item.is_important ? "Unmarked important" : "Marked important",
            })
          }
          aria-pressed={Boolean(item.is_important)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[12.5px] font-medium text-secondary-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Star
            className={`size-4 ${item.is_important ? "fill-warning text-warning" : "text-muted-foreground"}`}
          />
          {item.is_important ? "Important" : "Mark important"}
        </button>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Owner">
            <Combobox
              options={profileOptions(profiles)}
              value={form.owner_user_id}
              onChange={(v) => set("owner_user_id", v)}
              placeholder="Search employees…"
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Needed by">
            <DateField
              value={form.due_date || null}
              label="Needed by"
              placeholder="No date"
              onChange={(v) => set("due_date", v ?? "")}
            />
          </Field>
        </div>

        {form.status === "Waiting" ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Waiting on">
              <TextInput
                value={form.waiting_on}
                onChange={(e) => set("waiting_on", e.target.value)}
                placeholder="Person, company or trade"
              />
            </Field>
            <Field label="Follow up on">
              <DateField
                value={form.follow_up_on || null}
                label="Follow up on"
                placeholder="No date"
                onChange={(v) => set("follow_up_on", v ?? "")}
              />
            </Field>
          </div>
        ) : null}

        <Field label="Category (optional)">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">No category</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="Notes / details">
          <TextArea
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Context, decisions, anything useful."
          />
        </Field>

        <div>
          <div className="mb-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            History
          </div>
          <div className="flex gap-2">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
            />
            <Button
              onClick={async () => {
                if (!note.trim()) return;
                await addNote.mutateAsync({ id: item.id, message: note.trim() });
                setNote("");
                toast.success("Note added");
              }}
              disabled={!note.trim() || addNote.isPending}
              {...(!note.trim() ? { disabledReason: "Write a note first" } : {})}
            >
              Add
            </Button>
          </div>
          <ul className="mt-3 space-y-2.5">
            <li className="text-[12.5px] text-muted-foreground">
              Created {new Date(item.created_at).toLocaleDateString()}
              {item.created_by ? ` by ${item.created_by}` : ""}
            </li>
            {events.map((e) => (
              <li key={e.id} className="text-[12.5px]">
                <span className="font-medium">{e.message}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {new Date(e.created_at).toLocaleString()}
                  {e.actor ? ` · ${e.actor}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {item.project_id ? (
          <Link
            to="/projects/$projectId/files"
            params={{ projectId: item.project_id }}
            className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] font-medium text-primary transition-colors hover:border-border-strong hover:bg-muted/40"
          >
            <Paperclip className="size-4" /> Open project files and photos
          </Link>
        ) : null}

        {/* Technical classification stays out of the way. */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-[12.5px] font-semibold text-secondary-foreground"
          >
            More details
            <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} />
          </button>
          {more ? (
            <div className="space-y-3.5 border-t border-border px-4 py-3.5">
              <div className="grid grid-cols-1 gap-3.5">
                <Field label="Type">
                  <Select value={form.item_type} onChange={(e) => set("item_type", e.target.value)}>
                    {WORK_ITEM_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {wf ? (
                <div className="rounded-lg bg-muted/40 px-3 py-3">
                  <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Workflow
                  </div>
                  <StepSequence
                    steps={wf.steps}
                    current={item.workflow_step ?? wf.steps[0] ?? null}
                  />
                </div>
              ) : null}
              {item.impact ? (
                <div className="text-[12.5px] text-muted-foreground">Impact: {item.impact}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
