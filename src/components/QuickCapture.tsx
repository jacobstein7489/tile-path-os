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
  owner_user_id: string | null;
  waiting_on: string;
  status: string;
  next_action: string;
  due_date: string;
};

/** Heuristic classification. Designed so smarter classification can replace this later. */
function classify(line: string): { item_type: string; status: string; next_action: string; waiting_on: string } {
  const l = line.toLowerCase();
  if (/waiting|still has to|still needs to|contractor|depend|hold up|holding/.test(l))
    return {
      item_type: "Dependency",
      status: "Waiting",
      next_action: "Follow up",
      waiting_on: /contractor|gc\b/.test(l) ? "Contractor" : /plumb/.test(l) ? "Plumber" : "",
    };
  if (/measure|verify|check|confirm dimension|template|test/.test(l))
    return { item_type: "Field Verification", status: "Measurement Needed", next_action: "Verify on site", waiting_on: "" };
  if (/order|thinset|primer|adhesive|mortar|sand|portland|membrane|schluter|material|supply|supplies|grout|caulk/.test(l))
    return { item_type: "Install Material Need", status: "To Order", next_action: "Order material", waiting_on: "" };
  if (/price|pricing|quote|change order|extra|add(ing|ed)? work/.test(l))
    return { item_type: "Potential Change", status: "Needs Pricing", next_action: "Price change", waiting_on: "" };
  if (/touch.?up|punch|repair|redo|crack|regrout|fix/.test(l))
    return { item_type: "Punch / Return Work", status: "Crew Needed", next_action: "Assign installer", waiting_on: "" };
  if (/\?\s*$|^(can|does|should|who|what|when|why|how|is |are )/i.test(line.trim()))
    return { item_type: "Question", status: "Open", next_action: "Get an answer", waiting_on: "" };
  return { item_type: "Task", status: "Open", next_action: "", waiting_on: "" };
}

/** Chat noise: WhatsApp timestamps, sender prefixes, bullets, list numbers. */
function cleanLine(line: string) {
  return line
    .replace(/^\s*[[(][^\])]{0,40}[\])]\s*/, "")
    .replace(/^\s*\d{1,2}[:/]\d{2}(\s*[ap]m)?[,\s-]+/i, "")
    .replace(/^\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?[,\s]+/, "")
    .replace(/^\s*[A-Z][\w'’.\- ]{1,24}:\s+/, "")
    .replace(/^[-–—•*·>\s]+/, "")
    .replace(/^\d{1,2}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy project match: any distinctive token of the job name appearing in the text. */
function matchProject(text: string, projects: { id: string; name: string }[]) {
  const t = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    let score = 0;
    if (t.includes(name)) score = 100 + name.length;
    else {
      const tokens = name.split(/[^a-z0-9-]+/).filter((w) => w.length > 2 || /\d/.test(w));
      const hits = tokens.filter((w) => t.includes(w));
      if (hits.length) score = hits.reduce((a, w) => a + w.length, 0) * (hits.length > 1 ? 2 : 1);
    }
    if (score > 6 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best?.id ?? "";
}

/** Strip the matched job name out of the item summary so titles read cleanly. */
function stripProject(line: string, name?: string) {
  if (!name) return line;
  const cleaned = line.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  return cleaned.replace(/^[\s—–\-:,]+/, "").trim();
}

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: projects = [] } = useProjects();
  const { data: profiles = [] } = useProfiles();
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
    // Newlines first (chat / list pastes), then sentence boundaries inside a line.
    const rawLines = text
      .split(/\r?\n+/)
      .flatMap((l) => l.split(/(?<=[a-z0-9)])\.\s+|\s*;\s*|\s+—\s+/i))
      .map((l) => ({ original: l, clean: cleanLine(l) }))
      .filter(
        ({ clean }) => /[a-z]{3}/i.test(clean) && clean.replace(/[^a-z0-9]/gi, "").length > 3,
      );

    // A job named on its own line stays in effect for the lines beneath it.
    let sticky = matchProject(text, projects);
    const drafted: Draft[] = [];
    rawLines.forEach(({ original, clean: l }, i) => {
      // Match against the original text: a "Mark Drive: ..." prefix names the job.
      const matchedId = matchProject(original, projects);
      if (matchedId) sticky = matchedId;
      const matchedName = projects.find((p) => p.id === matchedId)?.name;
      const stripped = stripProject(l, matchedName);
      // A bare job name (heading line) is context for the lines below, not a work item.
      if (matchedId && stripped.replace(/[^a-z0-9]/gi, "").length < 4) return;
      const title = stripped || l;
      drafted.push({
        key: `${i}-${l.slice(0, 10)}`,
        project_id: matchedId || sticky,
        title,
        owner: "",
        owner_user_id: null,
        due_date: "",
        ...classify(l),
      });
    });
    setDrafts(drafted.length ? drafted : null);
    if (!drafted.length) toast.error("Nothing to capture yet");
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
        owner_user_id: d.owner_user_id,
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
