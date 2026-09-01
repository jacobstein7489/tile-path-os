import { useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Combobox, Field, Modal, Select, TextArea, TextInput } from "@/components/kit";
import { profileOptions, useProfiles } from "@/lib/people";
import { useProjects } from "@/lib/data";
import {
  useCreateWorkItems,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  type NewWorkItem,
} from "@/lib/workitems";

type Draft = {
  key: string;
  project_id: string;
  item_type: string;
  title: string;
  owner: string;
  waiting_on: string;
  status: string;
  next_action: string;
  due_date: string;
};

/** Heuristic classification. Designed so smarter classification can replace this later. */
function classify(line: string): { item_type: string; status: string; next_action: string; waiting_on: string } {
  const l = line.toLowerCase();
  if (/waiting|still has to|contractor|depend/.test(l))
    return {
      item_type: "Dependency",
      status: "Waiting",
      next_action: "Follow up",
      waiting_on: /contractor/.test(l) ? "Contractor" : "",
    };
  if (/measure|verify|check|test/.test(l))
    return { item_type: "Field Verification", status: "Measurement Needed", next_action: "Verify on site", waiting_on: "" };
  if (/order|thinset|primer|adhesive|mortar|sand|portland|membrane|material/.test(l))
    return { item_type: "Install Material Need", status: "To Order", next_action: "Order material", waiting_on: "" };
  if (/price|change|extra/.test(l))
    return { item_type: "Potential Change", status: "Needs Pricing", next_action: "Price change", waiting_on: "" };
  if (/touch.?up|punch|repair|redo/.test(l))
    return { item_type: "Punch / Return Work", status: "Crew Needed", next_action: "Assign installer", waiting_on: "" };
  return { item_type: "Task", status: "Open", next_action: "", waiting_on: "" };
}

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: projects = [] } = useProjects();
  const create = useCreateWorkItems();
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  const reset = () => {
    setRaw("");
    setDrafts(null);
  };

  const split = () => {
    const text = raw.trim();
    if (!text) return;
    const guessedProject =
      projects.find((p) => text.toLowerCase().includes(p.name.toLowerCase()))?.id ?? "";
    const lines = text
      .split(/\n|(?<=[a-z0-9)])\.\s+|\s*;\s*|\s+—\s+|\s*\.\s*$/i)
      .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 3)
      .map((l, i) => {
        const matched = projects.find((p) => l.toLowerCase().includes(p.name.toLowerCase()));
        const title = matched ? l.replace(new RegExp(matched.name, "i"), "").replace(/^[\s—–-]+/, "") : l;
        const guess = classify(l);
        return {
          key: `${i}-${l.slice(0, 8)}`,
          project_id: matched?.id ?? guessedProject,
          title: (title || l).replace(/\s+/g, " ").trim(),
          owner: guess.item_type === "Install Material Need" ? "Office" : "Site Manager",
          due_date: "",
          ...guess,
        } satisfies Draft;
      });
    setDrafts(lines.length ? lines : null);
    if (!lines.length) toast.error("Nothing to capture yet");
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => (d ? d.map((x) => (x.key === key ? { ...x, ...patch } : x)) : d));

  const saveAll = async () => {
    if (!drafts) return;
    const rows: NewWorkItem[] = drafts
      .filter((d) => d.project_id && d.title.trim())
      .map((d) => ({
        project_id: d.project_id,
        item_type: d.item_type,
        title: d.title.trim(),
        owner: d.owner || null,
        waiting_on: d.waiting_on || null,
        status: d.status,
        next_action: d.next_action || null,
        due_date: d.due_date || null,
      }));
    if (!rows.length) {
      toast.error("Each item needs a project and a summary");
      return;
    }
    await create.mutateAsync(rows);
    toast.success(`${rows.length} work item${rows.length > 1 ? "s" : ""} created`);
    reset();
    onClose();
  };

  const valid = Boolean(drafts?.some((d) => d.project_id && d.title.trim()));

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Quick Capture"
      subtitle="Paste raw notes from WhatsApp, email, a site visit or a phone call. Review, then save as real work items."
      width="max-w-3xl"
      footer={
        drafts ? (
          <>
            <Button onClick={() => setDrafts(null)}>Back to notes</Button>
            <Button
              variant="primary"
              onClick={saveAll}
              disabled={!valid || create.isPending}
              {...(!valid ? { disabledReason: "Each item needs a project and a summary" } : {})}
            >
              {create.isPending ? "Saving…" : `Create ${drafts.length} work item${drafts.length > 1 ? "s" : ""}`}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={split}
              disabled={!raw.trim()}
              {...(!raw.trim() ? { disabledReason: "Paste or type a note first" } : {})}
            >
              <Sparkles className="size-4" /> Split into work items
            </Button>
          </>
        )
      }
    >
      {!drafts ? (
        <Field
          label="Raw note"
          hint="One line per thing, or just paste the message — we split it for you."
        >
          <TextArea
            rows={7}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              "Wilkinson — need to measure master saddle. Contractor still has to finish window opening. Confirm curb was ordered."
            }
          />
        </Field>
      ) : (
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={d.key} className="rounded-xl border border-border bg-muted/30 p-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <TextInput
                  value={d.title}
                  onChange={(e) => update(d.key, { title: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setDrafts((x) => (x ? x.filter((y) => y.key !== d.key) : x))}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Project">
                  <Select
                    value={d.project_id}
                    onChange={(e) => update(d.key, { project_id: e.target.value })}
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type">
                  <Select
                    value={d.item_type}
                    onChange={(e) => update(d.key, { item_type: e.target.value })}
                  >
                    {WORK_ITEM_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Owner">
                  <Combobox
                    options={profileOptions(profiles)}
                    value={
                      profiles.find((p) => p.full_name === d.owner)?.user_id ?? null
                    }
                    onChange={(v) =>
                      update(d.key, {
                        owner: profiles.find((p) => p.user_id === v)?.full_name ?? "",
                        owner_user_id: v ?? null,
                      })
                    }
                    placeholder="Search employees…"
                  />
                </Field>
                <Field label="Waiting on">
                  <TextInput
                    value={d.waiting_on}
                    onChange={(e) => update(d.key, { waiting_on: e.target.value })}
                  />
                </Field>
                <Field label="Status">
                  <Select value={d.status} onChange={(e) => update(d.key, { status: e.target.value })}>
                    {[...new Set([d.status, ...WORK_ITEM_STATUSES])].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Next action">
                  <TextInput
                    value={d.next_action}
                    onChange={(e) => update(d.key, { next_action: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
