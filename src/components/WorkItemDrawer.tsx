import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, FileText, History, MessageSquareText, Paperclip, Star } from "lucide-react";
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
  type TaskStatus,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Action editor. Desktop: right-side drawer. Phone: full-height sheet.
 * The user sees what needs to happen, who owns it, when, and one obvious
 * way to log what happened. Everything technical stays out of the way.
 */

type Outcome = "Done" | "Still waiting" | "Keep open" | "New action needed";
const OUTCOMES: Outcome[] = ["Done", "Still waiting", "Keep open", "New action needed"];
type DetailTab = "Updates" | "Notes" | "Files";

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
  const [detailTab, setDetailTab] = useState<DetailTab>("Updates");

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
    setDetailTab("Updates");
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
       width="max-w-[560px]"
       title={
         <span className="block pr-2">
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
              "Company / no job"
            )}
          </span>
            <span className="mt-2 block text-[22px] leading-snug font-bold md:text-[26px]">
            {item.title}
          </span>
        </span>
      }
       subtitle={
         <span className="inline-flex items-center gap-1.5 font-semibold text-secondary-foreground">
           <span className="size-1.5 rounded-full bg-primary" />
           {simpleStatus(item.status)}
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
              <Check className="size-4" /> Complete
            </Button>
          )}
          <Button variant="primary" onClick={saveChanges} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
       <div className="space-y-7">
        <Field label="Action">
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="What needs to happen"
            className="h-11 text-[16px] md:text-[14px]"
          />
        </Field>

         <div className="grid grid-cols-1 gap-3 border-y border-border py-4 sm:grid-cols-3">
          <Field label="Owner">
            <Combobox
              options={profileOptions(profiles)}
              value={form.owner_user_id}
              onChange={(v) => set("owner_user_id", v)}
              placeholder="Unassigned"
            />
          </Field>
          <Field label="Status">
             <Select
               value={form.status}
               onChange={(e) => set("status", e.target.value as TaskStatus)}
             >
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due">
            <DateField
              value={form.due_date || null}
              label="Due"
              placeholder="No date"
              onChange={(v) => set("due_date", v ?? "")}
            />
          </Field>
        </div>

         <Button
           variant="ghost"
           size="sm"
           className={cn(
             "-mt-2 w-fit",
             item.is_important ? "text-warning hover:bg-warning-soft" : "text-muted-foreground",
           )}
           onClick={() =>
             save.mutate({
               id: item.id,
               patch: { is_important: !item.is_important },
               note: item.is_important ? "Unmarked important" : "Marked important",
             })
           }
           aria-pressed={Boolean(item.is_important)}
           title={item.is_important ? "Remove important mark" : "Mark important"}
         >
           <Star className={cn("size-4", item.is_important && "fill-warning text-warning")} />
           {item.is_important ? "Important" : "Mark important"}
         </Button>

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

         {/* Move Forward is the single dominant operational action. */}
          <section className="overflow-hidden border-y border-primary/25 bg-primary-soft/35">
          {logOpen ? (
             <div className="space-y-4 px-4 py-4">
              <VoiceField
                label="What happened?"
                value={log}
                onChange={setLog}
                placeholder="Spoke with Millie. Material expected Monday."
                rows={3}
              />
               <div>
                 <p className="mb-2 text-[12px] font-semibold text-secondary-foreground">Where does it stand?</p>
                 <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    aria-pressed={outcome === o}
                    className={
                      outcome === o
                         ? "min-h-10 cursor-pointer rounded-lg bg-foreground px-3 text-[12.5px] font-semibold text-background"
                         : "min-h-10 cursor-pointer rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground transition-colors hover:bg-muted"
                    }
                  >
                    {o}
                  </button>
                ))}
                 </div>
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
               <Button
               variant="ghost"
              onClick={() => setLogOpen(true)}
                className="h-auto w-full justify-between rounded-none px-4 py-5 text-left hover:bg-primary-soft/60"
            >
               <span className="flex min-w-0 items-center gap-3">
                 <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                   <MessageSquareText className="size-4" />
                 </span>
                 <span>
                    <span className="v2-kicker block !text-primary">Primary action</span><span className="mt-1 block text-[16px] font-bold text-foreground">Move forward</span>
                   <span className="mt-0.5 block text-[12px] font-medium text-muted-foreground">
                     Record what happened and decide what comes next
                   </span>
                 </span>
              </span>
               <span className="text-primary">→</span>
             </Button>
          )}
        </section>

         <section className="border-t border-border pt-1">
           <div className="flex items-center gap-5 border-b border-border">
             {(["Updates", "Notes", "Files"] as DetailTab[]).map((tab) => (
               <button
                 key={tab}
                 type="button"
                 onClick={() => setDetailTab(tab)}
                 className={cn(
                   "relative flex h-11 cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold transition-colors duration-150",
                   detailTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground",
                 )}
               >
                 {tab === "Updates" ? <History className="size-3.5" /> : null}
                 {tab === "Notes" ? <FileText className="size-3.5" /> : null}
                 {tab === "Files" ? <Paperclip className="size-3.5" /> : null}
                 {tab}
                 {tab === "Updates" && events.length ? ` ${events.length}` : ""}
                 {detailTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
               </button>
             ))}
           </div>

           {detailTab === "Notes" ? (
             <div className="pt-4">
               <TextArea
                 rows={4}
                 value={form.description}
                 onChange={(e) => set("description", e.target.value)}
                 placeholder="Context, decisions, anything useful."
               />
             </div>
           ) : null}

           {detailTab === "Files" ? (
             <div className="pt-4">
               {item.project_id ? (
                 <Link
                   to="/projects/$projectId/files"
                   params={{ projectId: item.project_id }}
                   className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-[13px] font-semibold text-primary transition-colors hover:border-border-strong hover:bg-muted/40"
                 >
                   <Paperclip className="size-4" /> Open files and photos for this job
                 </Link>
               ) : (
                 <p className="py-3 text-[12.5px] text-muted-foreground">Link this action to a job to add files.</p>
               )}
             </div>
           ) : null}

           {detailTab === "Updates" ? (
             <div className="pt-2">
               <button
                 type="button"
                 onClick={() => setHistoryOpen((v) => !v)}
                 className="flex min-h-11 w-full cursor-pointer items-center justify-between text-[12.5px] font-semibold text-secondary-foreground"
               >
                 Activity history
                 <ChevronDown className={cn("size-4 transition-transform", historyOpen && "rotate-180")} />
               </button>
               {historyOpen ? (
                 <ul className="space-y-3 border-t border-border py-3">
                   {events.map((e) => (
                     <li key={e.id} className="text-[12.5px] leading-relaxed">
                       <span className="font-medium">{e.message}</span>
                       <span className="text-muted-foreground">
                         {" · "}{new Date(e.created_at).toLocaleString()}{e.actor ? ` · ${e.actor}` : ""}
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
             </div>
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
