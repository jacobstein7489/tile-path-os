import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Combobox,
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
  WORK_ITEM_STATUSES,
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
    owner_user_id: "" as string | null,
    waiting_on: "",
    status: "Open",
    due_date: "",
    next_action: "",
    item_type: "Task",
    description: "",
  });
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      owner_user_id: item.owner_user_id ?? null,
      waiting_on: item.waiting_on ?? "",
      status: item.status,
      due_date: item.due_date ?? "",
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
        owner_user_id: form.owner_user_id || null,
        owner: form.owner_user_id
          ? (profiles.find((p) => p.user_id === form.owner_user_id)?.full_name ?? null)
          : null,
        waiting_on: form.waiting_on || null,
        status: form.status,
        due_date: form.due_date || null,
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
      title={item.title}
      subtitle={
        <Link
          to="/projects/$projectId"
          params={{ projectId: item.project_id }}
          className="font-medium text-primary hover:underline"
        >
          {item.projects?.name ?? "Project"}
        </Link>
      }
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
        <div className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-3">
          <div className="text-[10.5px] font-semibold tracking-[0.14em] text-primary/80 uppercase">
            Next action
          </div>
          <p className="mt-0.5 text-[14px] font-semibold text-primary">
            {item.next_action ?? "No next action set"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3.5">
          <Field label="Owner">
            <Combobox
              options={profileOptions(profiles)}
              value={form.owner_user_id}
              onChange={(v) => set("owner_user_id", v)}
              placeholder="Search employees…"
            />
          </Field>
          <Field label="Waiting on">
            <TextInput
              value={form.waiting_on}
              onChange={(e) => set("waiting_on", e.target.value)}
              placeholder="Nobody"
            />
          </Field>
          <Field label="Needed by">
            <TextInput
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </Field>
        </div>

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

        <Link
          to="/projects/$projectId/files"
          params={{ projectId: item.project_id }}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] font-medium text-primary transition-colors hover:border-border-strong hover:bg-muted/40"
        >
          <Paperclip className="size-4" /> Open project files and photos
        </Link>

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
              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Type">
                  <Select value={form.item_type} onChange={(e) => set("item_type", e.target.value)}>
                    {WORK_ITEM_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                    {[...new Set([form.status, ...WORK_ITEM_STATUSES])].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Next action text">
                <TextInput
                  value={form.next_action}
                  onChange={(e) => set("next_action", e.target.value)}
                />
              </Field>
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
