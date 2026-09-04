import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Paperclip, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Combobox,
  DateField,
  Drawer,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/kit";
import { VoiceField } from "@/components/VoiceField";
import { profileOptions, useCompanies, useContacts, useProfiles } from "@/lib/people";
import {
  isComplete,
  useAddWorkNote,
  useCreateWorkItems,
  useSaveWorkItem,
  useWorkItemEvents,
  simpleStatus,
  storedStatus,
  TASK_CATEGORIES,
  TASK_STATUSES,
  type WorkItemRow,
} from "@/lib/workitems";

/**
 * Action editor. Desktop: right-side drawer. Phone: full-height sheet.
 * The user sees what needs to happen, who owns it, when, and one obvious
 * way to log what happened. Everything technical stays out of the way.
 */

type Outcome = "Done" | "Still waiting" | "Keep open" | "New action needed";
const OUTCOMES: Outcome[] = ["Done", "Still waiting", "Keep open", "New action needed"];

export function WorkItemDrawer({
  item,
  onClose,
}: {
  item: WorkItemRow | null;
  onClose: () => void;
}) {
  const save = useSaveWorkItem();
  const addNote = useAddWorkNote();
  const createItems = useCreateWorkItems();
  const { data: events = [] } = useWorkItemEvents(item?.id ?? null);
  const { data: profiles = [] } = useProfiles();
  const { data: contacts = [] } = useContacts();
  const { data: companies = [] } = useCompanies();

  const [form, setForm] = useState({
    title: "",
    owner_user_id: "" as string | null,
    waiting_on: "",
    status: "To Do",
    due_date: "",
    follow_up_on: "",
    category: "",
    description: "",
  });
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("Keep open");
  const [newTitle, setNewTitle] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

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
      description: item.description ?? "",
    });
    setLog("");
    setLogOpen(false);
    setOutcome("Keep open");
    setNewTitle("");
    setHistoryOpen(false);
  }, [item]);

  /** Waiting On searches the people and companies already configured. */
  const waitingOptions = useMemo(() => {
    const names = [
      ...profiles.map((p) => ({ value: p.full_name, label: p.full_name, hint: "Employee" })),
      ...contacts.map((c) => ({
        value: c.full_name,
        label: c.full_name,
        hint: c.title ?? "Contact",
      })),
      ...companies.map((c) => ({ value: c.name, label: c.name, hint: "Company" })),
    ];
    const seen = new Set<string>();
    return names.filter((n) => (seen.has(n.value) ? false : (seen.add(n.value), true)));
  }, [profiles, contacts, companies]);

  if (!item) return null;
  const done = isComplete(item);
  const waiting = form.status === "Waiting";
  const ownerName =
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? null;
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
        waiting_on: waiting ? form.waiting_on || null : null,
        status: storedStatus(form.status),
        completed_at: form.status === "Done" ? new Date().toISOString() : null,
        due_date: form.due_date || null,
        follow_up_on: waiting ? form.follow_up_on || null : null,
        category: form.category || null,
        description: form.description || null,
      },
      note: "Action updated",
    });
    toast.success("Saved");
    onClose();
  };

  const complete = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: { status: "Complete", completed_at: new Date().toISOString() },
      note: "Marked complete",
    });
    toast.success("Completed");
    onClose();
  };

  const reopen = async () => {
    await save.mutateAsync({
      id: item.id,
      patch: { status: "Open", completed_at: null },
      note: "Reopened",
    });
    toast.success("Reopened");
  };

  /** Log Update: append what happened, then say where the action stands. */
  const saveLog = async () => {
    const message = log.trim();
    if (message) await addNote.mutateAsync({ id: item.id, message });

    if (outcome === "Done") {
      await save.mutateAsync({
        id: item.id,
        patch: { status: "Complete", completed_at: new Date().toISOString() },
        note: "Completed after update",
      });
    } else if (outcome === "Still waiting") {
      await save.mutateAsync({
        id: item.id,
        patch: {
          status: "Waiting",
          waiting_on: form.waiting_on || null,
          follow_up_on: form.follow_up_on || null,
          completed_at: null,
        },
        note: "Still waiting",
      });
    } else if (outcome === "New action needed" && newTitle.trim()) {
      await createItems.mutateAsync([
        {
          project_id: item.project_id,
          item_type: "Task",
          title: newTitle.trim(),
          status: "Open",
        },
      ]);
    }
    toast.success(
      outcome === "New action needed" && newTitle.trim() ? "Update saved · action created" : "Update saved",
    );
    setLog("");
    setNewTitle("");
    setLogOpen(false);
    if (outcome === "Done") onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-[520px]"
      title={
        <span className="block">
          <span className="block text-[12.5px] font-semibold text-muted-foreground">
            {item.project_id ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId: item.project_id }}
                className="text-primary hover:underline"
              >
                {item.projects?.name ?? "Project"}
              </Link>
            ) : (
              "Company / no job"
            )}
          </span>
          <span className="mt-0.5 block text-[17px] leading-snug font-bold tracking-[-0.02em]">
            {item.title}
          </span>
        </span>
      }
      subtitle={simpleStatus(item.status)}
      footer={
        <>
          {done ? (
            <Button onClick={reopen} disabled={save.isPending}>
              Reopen
            </Button>
          ) : (
            <Button onClick={complete} disabled={save.isPending}>
              <Check className="size-4" /> Complete
            </Button>
          )}
          <Button variant="primary" onClick={saveChanges} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Action">
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="What needs to happen"
            className="h-11 text-[16px] md:text-[14px]"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Owner">
            <Combobox
              options={profileOptions(profiles)}
              value={form.owner_user_id}
              onChange={(v) => set("owner_user_id", v)}
              placeholder="Unassigned"
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Due">
            <DateField
              value={form.due_date || null}
              label="Due"
              placeholder="No date"
              onChange={(v) => set("due_date", v ?? "")}
            />
          </Field>
          <Field label="Important">
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
              className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium text-secondary-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Star
                className={
                  item.is_important
                    ? "size-4 fill-warning text-warning"
                    : "size-4 text-muted-foreground"
                }
              />
              {item.is_important ? "Important" : "Mark important"}
            </button>
          </Field>
        </div>

        {waiting ? (
          <div className="grid grid-cols-1 gap-3.5 rounded-xl bg-warning-soft/40 p-3.5 sm:grid-cols-2">
            <Field label="Waiting on">
              <Combobox
                options={waitingOptions}
                value={form.waiting_on || null}
                onChange={(v) => set("waiting_on", v ?? "")}
                onCreate={(label) => set("waiting_on", label)}
                createLabel="Use"
                placeholder="Person, vendor or trade"
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

        <Field label="Notes">
          <TextArea
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Context, decisions, anything useful."
          />
        </Field>

        {/* Log update — the everyday follow-up path, no duplicate actions. */}
        <section className="rounded-xl border border-border">
          {logOpen ? (
            <div className="space-y-3.5 px-4 py-4">
              <VoiceField
                label="What happened?"
                value={log}
                onChange={setLog}
                placeholder="Spoke with Millie. Material expected Monday."
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    aria-pressed={outcome === o}
                    className={
                      outcome === o
                        ? "h-9 cursor-pointer rounded-lg bg-foreground px-3 text-[12.5px] font-semibold text-background"
                        : "h-9 cursor-pointer rounded-lg border border-border px-3 text-[12.5px] font-semibold text-secondary-foreground transition-colors hover:bg-muted"
                    }
                  >
                    {o}
                  </button>
                ))}
              </div>
              {outcome === "Still waiting" ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Field label="Waiting on">
                    <Combobox
                      options={waitingOptions}
                      value={form.waiting_on || null}
                      onChange={(v) => set("waiting_on", v ?? "")}
                      onCreate={(label) => set("waiting_on", label)}
                      createLabel="Use"
                      placeholder="Person, vendor or trade"
                    />
                  </Field>
                  <Field label="Follow up on">
                    <DateField
                      value={form.follow_up_on || null}
                      label="Follow up on"
                      placeholder="Pick a date"
                      onChange={(v) => set("follow_up_on", v ?? "")}
                    />
                  </Field>
                </div>
              ) : null}
              {outcome === "New action needed" ? (
                <Field label="New action">
                  <TextInput
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="What needs to happen next"
                    className="h-11 text-[16px] md:text-[14px]"
                  />
                </Field>
              ) : null}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => void saveLog()}
                  disabled={!log.trim() && outcome === "Keep open"}
                  loading={addNote.isPending || save.isPending}
                >
                  Save update
                </Button>
                <Button onClick={() => setLogOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-[13.5px] font-semibold text-primary transition-colors hover:bg-primary-soft/50"
            >
              Log update
              <span className="text-[12.5px] font-medium text-muted-foreground">
                {events.length ? `${events.length} in history` : "Nothing logged yet"}
              </span>
            </button>
          )}
        </section>

        {item.project_id ? (
          <Link
            to="/projects/$projectId/files"
            params={{ projectId: item.project_id }}
            className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3.5 text-[13px] font-medium text-primary transition-colors hover:border-border-strong hover:bg-muted/40"
          >
            <Paperclip className="size-4" /> Files and photos for this job
          </Link>
        ) : null}

        {/* History is read-only and deliberately secondary. */}
        <section className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-[12.5px] font-semibold text-secondary-foreground"
          >
            History
            <ChevronDown
              className={`size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </button>
          {historyOpen ? (
            <ul className="space-y-2.5 border-t border-border px-4 py-3.5">
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
              <li className="text-[12.5px] text-muted-foreground">
                Created {new Date(item.created_at).toLocaleDateString()}
                {item.created_by ? ` by ${item.created_by}` : ""}
                {ownerName ? ` · owner ${ownerName}` : ""}
              </li>
            </ul>
          ) : null}
        </section>

        <details className="text-[12.5px] text-muted-foreground">
          <summary className="cursor-pointer font-semibold">Category (optional)</summary>
          <div className="mt-2">
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">No category</option>
              {TASK_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
        </details>

        {ownerName ? (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Avatar
              initials={ownerName
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("")}
              size={22}
            />
            Owned by {ownerName}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
