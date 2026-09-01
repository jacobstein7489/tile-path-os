import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, Field, Select, StepSequence, TextArea, TextInput } from "@/components/kit";
import { Chip } from "@/lib/status";
import {
  advanceWorkflow,
  isComplete,
  OWNERS,
  statusTone,
  typeTone,
  useAddWorkNote,
  useSaveWorkItem,
  useWorkItemEvents,
  workflowFor,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  type WorkItemRow,
} from "@/lib/workitems";

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
  const [form, setForm] = useState({
    owner: "",
    waiting_on: "",
    status: "Open",
    due_date: "",
    next_action: "",
    item_type: "Task",
    description: "",
  });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!item) return;
    setForm({
      owner: item.owner ?? "",
      waiting_on: item.waiting_on ?? "",
      status: item.status,
      due_date: item.due_date ?? "",
      next_action: item.next_action ?? "",
      item_type: item.item_type,
      description: item.description ?? "",
    });
    setNote("");
  }, [item]);

  if (!item) return null;
  const wf = workflowFor(item);
  const done = isComplete(item);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveChanges = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: {
        owner: form.owner || null,
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

  const advance = async () => {
    const patch = advanceWorkflow(item);
    if (!patch) return;
    await save.mutateAsync({
      id: item.id,
      patch,
      note: `Advanced to “${patch.workflow_step}”`,
    });
    toast.success(patch.status === "Complete" ? "Item closed" : `Now: ${patch.next_action}`);
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
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to="/projects/$projectId"
            params={{ projectId: item.project_id }}
            className="font-medium text-primary hover:underline"
          >
            {item.projects?.name ?? "Project"}
          </Link>
          <Chip tone={typeTone(item.item_type)}>{item.item_type}</Chip>
          <Chip tone={statusTone(item.status)}>{item.status}</Chip>
        </span>
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
          {wf && !done ? (
            <Button onClick={advance} disabled={save.isPending}>
              Advance step <ArrowRight className="size-4" />
            </Button>
          ) : null}
          <Button variant="primary" onClick={saveChanges} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {wf ? (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                Workflow
              </span>
              <span className="text-[12.5px] font-semibold text-primary">
                {item.next_action ?? "—"}
              </span>
            </div>
            <StepSequence steps={wf.steps} current={item.workflow_step ?? wf.steps[0] ?? null} />
          </div>
        ) : null}

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
          <Field label="Owner">
            <Select value={form.owner} onChange={(e) => set("owner", e.target.value)}>
              <option value="">Unassigned</option>
              {[...new Set([...(form.owner ? [form.owner] : []), ...OWNERS])].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </Field>
          <Field label="Waiting on">
            <TextInput
              value={form.waiting_on}
              onChange={(e) => set("waiting_on", e.target.value)}
              placeholder="Nobody"
            />
          </Field>
          <Field label="Needed by (optional)">
            <TextInput
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </Field>
          <Field label="Next action">
            <TextInput value={form.next_action} onChange={(e) => set("next_action", e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        {item.impact ? (
          <div className="rounded-xl border border-border px-4 py-3">
            <div className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Impact
            </div>
            <p className="mt-1 text-[13px]">{item.impact}</p>
          </div>
        ) : null}

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

        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] text-muted-foreground">
          <Paperclip className="size-4" /> Files and photos attach here once storage is enabled.
        </div>
      </div>
    </Drawer>
  );
}
