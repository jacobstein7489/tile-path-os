import { useMemo, useState } from "react";
import { Sparkles, Star, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Button,
  Checkbox,
  Combobox,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from "@/components/kit";
import { profileOptions, useProfiles } from "@/lib/people";
import { useInsertRow, useProjects } from "@/lib/data";
import { useAuthUser } from "@/hooks/useAuth";
import {
  findDuplicate,
  isComplete,
  useCreateWorkItems,
  useSaveWorkItem,
  useWorkFeed,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  type NewWorkItem,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

type MatchKind = "exact" | "fuzzy" | "none";

type Draft = {
  key: string;
  /** Stable id of the parsed section this row came from — sections never merge. */
  sectionKey: string;
  /** Heading text this row came from when no project matched — drives stub creation. */
  groupName: string;
  /** How the heading was resolved to a project, so review can warn before import. */
  matchKind: MatchKind;
  project_id: string;
  item_type: string;
  title: string;
  owner: string;
  owner_user_id: string | null;
  waiting_on: string;
  status: string;
  next_action: string;
  due_date: string;
  is_important: boolean;
  dupAction: "keep" | "skip" | "replace";
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
    return { item_type: "Question / Decision", status: "Open", next_action: "Get an answer", waiting_on: "" };
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

/** Comparison form of a project name: "5:30 Mark" and "530 Mark" collapse to "530mark". */
function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nameTokens(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Resolve a heading line to a project. Punctuation, spacing, hyphens and case are
 * ignored; a partial name still matches, but only confidently.
 */
export function matchProjectHeading(
  heading: string,
  projects: { id: string; name: string }[],
): { id: string; kind: MatchKind } {
  const h = normalizeName(heading);
  if (!h) return { id: "", kind: "none" };

  for (const p of projects) {
    if (normalizeName(p.name) === h) return { id: p.id, kind: "exact" };
  }

  const ht = new Set(nameTokens(heading));
  let best: { id: string; score: number } | null = null;
  for (const p of projects) {
    const n = normalizeName(p.name);
    let score = 0;
    if (n.length >= 4 && h.length >= 4 && (n.includes(h) || h.includes(n))) {
      score = Math.min(n.length, h.length) / Math.max(n.length, h.length);
    } else {
      const pt = new Set(nameTokens(p.name));
      let shared = 0;
      pt.forEach((t) => {
        if (ht.has(t)) shared += 1;
      });
      if (shared) score = shared / Math.max(pt.size, ht.size);
    }
    if (score >= 0.6 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best ? { id: best.id, kind: "fuzzy" } : { id: "", kind: "none" };
}

/** Strip the matched job name out of the item summary so titles read cleanly. */
function stripProject(line: string, name?: string) {
  if (!name) return line;
  const cleaned = line.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  return cleaned.replace(/^[\s—–\-:,]+/, "").trim();
}

const emptyDraft = (
  key: string,
  title: string,
  extra: Partial<Draft>,
): Draft => ({
  key,
  sectionKey: "unassigned",
  groupName: "",
  matchKind: "none",
  project_id: "",
  title,
  owner: "",
  owner_user_id: null,
  due_date: "",
  is_important: false,
  dupAction: "keep",
  ...classify(title),
  ...extra,
});

const ACTION_START =
  /^(confirm|order|call|check|measure|schedule|follow|send|get|need|price|verify|fix|install|remove|replace|deliver|pick|drop|reorder|review|update|finish|start|clean|cut|set|make|ask|email|text|meet|assign|approve)\b/i;

/**
 * Structural heading test — runs BEFORE any database matching so an unknown or
 * mistyped project name still starts its own section.
 */
function looksLikeHeading(original: string, clean: string, indentMode: boolean) {
  const indented = /^([ \t]+|\s*[-–—•*·>])/.test(original);
  if (indentMode) return !indented;
  if (indented) return false;
  return (
    clean.length <= 46 &&
    !/[,;?]/.test(clean) &&
    !/[—–]|\s-\s|:/.test(clean) &&
    clean.split(" ").length <= 5 &&
    !ACTION_START.test(clean)
  );
}

/* ============================================================
 * Bulk parse: a grouped paste where a standalone line starts a
 * new project section and the lines under it are its work.
 * Sections are structural — they never merge into each other.
 * ============================================================ */
export function parseBulk(text: string, projects: { id: string; name: string }[]): Draft[] {
  const drafts: Draft[] = [];
  const lines = text.split(/\r?\n/);

  // If the paste uses indentation or bullets at all, indentation defines the sections.
  const indentMode = lines.some(
    (l) => /^([ \t]+|\s*[-–—•*·>])/.test(l) && /[a-z0-9]{2}/i.test(cleanLine(l)),
  );

  let section = {
    key: "unassigned",
    id: "",
    name: "",
    headingText: "",
    kind: "none" as MatchKind,
  };
  let sectionIndex = 0;

  lines.forEach((original, i) => {
    const clean = cleanLine(original);
    if (!/[a-z0-9]{2}/i.test(clean)) return;

    if (looksLikeHeading(original, clean, indentMode)) {
      const match = matchProjectHeading(clean, projects);
      sectionIndex += 1;
      section = {
        key: `s${sectionIndex}`,
        id: match.id,
        name: projects.find((p) => p.id === match.id)?.name ?? clean,
        // The pasted heading, kept verbatim so an unmatched section can become a stub.
        headingText: clean,
        kind: match.kind,
      };
      return;
    }


    const title = stripProject(clean, section.id ? section.name : undefined) || clean;
    drafts.push(
      emptyDraft(`${i}-${title.slice(0, 12)}`, title, {
        sectionKey: section.key,
        project_id: section.id,
        groupName: section.headingText,
        matchKind: section.kind,
      }),
    );
  });

  return drafts;
}


/** Quick-note mode only: find a job name mentioned inside free-flowing text. */
function matchProjectMention(text: string, projects: { id: string; name: string }[]) {
  const t = text.toLowerCase();
  const tn = normalizeName(text);
  let best: { id: string; score: number } | null = null;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    let score = 0;
    if (t.includes(name) || tn.includes(normalizeName(p.name))) score = 100 + name.length;
    else {
      const tokens = nameTokens(p.name).filter((w) => w.length > 2);
      const hits = tokens.filter((w) => t.includes(w));
      if (hits.length > 1) score = hits.reduce((a, w) => a + w.length, 0) * 2;
    }
    if (score > 6 && (!best || score > best.score)) best = { id: p.id, score };
  }
  return best?.id ?? "";
}

/** Quick-note parse: sentence/line splitting with sticky project context. */
function parseNote(text: string, projects: { id: string; name: string }[]): Draft[] {
  const rawLines = text
    .split(/\r?\n+/)
    .flatMap((l) => l.split(/(?<=[a-z0-9)])\.\s+|\s*;\s*|\s+—\s+/i))
    .map((l) => ({ original: l, clean: cleanLine(l) }))
    .filter(({ clean }) => /[a-z]{3}/i.test(clean) && clean.replace(/[^a-z0-9]/gi, "").length > 3);

  let sticky = matchProjectMention(text, projects);
  const drafted: Draft[] = [];
  rawLines.forEach(({ original, clean: l }, i) => {
    const matchedId = matchProjectMention(original, projects);
    if (matchedId) sticky = matchedId;
    const matchedName = projects.find((p) => p.id === matchedId)?.name;
    const stripped = stripProject(l, matchedName);
    if (matchedId && stripped.replace(/[^a-z0-9]/gi, "").length < 4) return;
    const title = stripped || l;
    const projectId = matchedId || sticky;
    drafted.push(
      emptyDraft(`${i}-${l.slice(0, 10)}`, title, {
        project_id: projectId,
        sectionKey: projectId || "unassigned",
        matchKind: projectId ? "exact" : "none",
      }),
    );
  });
  return drafted;
}


export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: profiles = [] } = useProfiles();
  const { data: feed = [] } = useWorkFeed();
  const { user } = useAuthUser();
  const create = useCreateWorkItems();
  const save = useSaveWorkItem();
  const insertProject = useInsertRow("projects");

  const [mode, setMode] = useState<"note" | "bulk">("note");
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Inline project stub creation during review: name (+ optional address) only.
  const [stubFor, setStubFor] = useState<string | null>(null);
  const [stub, setStub] = useState({ name: "", address: "" });
  const [batchDate, setBatchDate] = useState("");

  const owners = useMemo(() => profileOptions(profiles), [profiles]);
  const openItems = useMemo(() => feed.filter((i) => !isComplete(i)), [feed]);

  const duplicates = useMemo(() => {
    const map: Record<string, WorkItemRow> = {};
    (drafts ?? []).forEach((d) => {
      const hit = findDuplicate({ title: d.title, project_id: d.project_id || null }, openItems);
      if (hit) map[d.key] = hit;
    });
    return map;
  }, [drafts, openItems]);

  const reset = () => {
    setRaw("");
    setDrafts(null);
    setSelected({});
    setExpanded({});
    setStubFor(null);
    setStub({ name: "", address: "" });
    setBatchDate("");
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => (d ? d.map((x) => (x.key === key ? { ...x, ...patch } : x)) : d));

  const updateMany = (keys: string[], patch: Partial<Draft>) =>
    setDrafts((d) => (d ? d.map((x) => (keys.includes(x.key) ? { ...x, ...patch } : x)) : d));

  const selectedKeys = Object.keys(selected).filter((k) => selected[k]);

  /** A stub is a real project with only a name/address — full setup happens later. */
  const createStub = async (groupKey: string, keys: string[]) => {
    const name = stub.name.trim();
    if (name.length < 2) {
      toast.error("Give the project a name or address");
      return;
    }
    const row = (await insertProject.mutateAsync({
      name,
      address: stub.address.trim() || null,
      project_type: "New Job",
      lifecycle_stage: "New Submission",
      created_by: user?.id ?? null,
      intake_notes: "Created as a stub from Quick Capture. Details to be completed.",
    })) as { id: string } | null;
    if (row?.id) {
      updateMany(keys, { project_id: row.id, groupName: "" });
      toast.success(`Project stub "${name}" created`);
    }
    setStubFor(null);
    setStub({ name: "", address: "" });
    void groupKey;
  };

  const split = () => {
    const text = raw.trim();
    if (!text) return;
    const drafted = mode === "bulk" ? parseBulk(text, projects) : parseNote(text, projects);
    setDrafts(drafted.length ? drafted : null);
    setSelected({});
    if (!drafted.length) toast.error("Nothing to capture yet");
  };

  /** Grouped review: one section per pasted heading — sections never merge. */
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; heading: string; pending: boolean; fuzzy: boolean; items: Draft[] }
    >();
    (drafts ?? []).forEach((d) => {
      const key = d.sectionKey || (d.project_id || "unassigned");
      if (!map.has(key)) {
        map.set(key, {
          label: d.project_id
            ? (projects.find((p) => p.id === d.project_id)?.name ?? "Project")
            : d.groupName || "Company / Unassigned",
          heading: d.groupName,
          pending: !d.project_id,
          fuzzy: Boolean(d.project_id) && d.matchKind === "fuzzy",
          items: [],
        });
      }
      map.get(key)!.items.push(d);
    });
    return [...map.entries()];
  }, [drafts, projects]);

  const unmatchedSections = groups.filter(([, g]) => g.pending && g.heading);
  const fuzzySections = groups.filter(([, g]) => g.fuzzy);


  const saveAll = async () => {
    if (!drafts) return;
    const keep = drafts.filter((d) => d.title.trim() && d.dupAction !== "skip");
    const skipped = drafts.length - keep.length;
    if (!keep.length) {
      toast.error("Nothing left to import");
      return;
    }

    // "Replace existing" retires the old open item and imports the new wording.
    for (const d of keep.filter((x) => x.dupAction === "replace")) {
      const existing = duplicates[d.key];
      if (existing) {
        await save.mutateAsync({
          id: existing.id,
          patch: { archived_at: new Date().toISOString() },
          note: "Replaced by a bulk import item",
        });
      }
    }

    const rows: NewWorkItem[] = keep.map((d) => ({
      project_id: d.project_id || null,
      item_type: d.item_type,
      title: d.title.trim(),
      owner: d.owner || null,
      owner_user_id: d.owner_user_id,
      waiting_on: d.waiting_on || null,
      status: d.status,
      next_action: d.next_action || null,
      due_date: d.due_date || null,
      is_important: d.is_important,
    }));

    await create.mutateAsync(rows);
    const needsReview = keep.filter((d) => !d.project_id && d.groupName).length;
    toast.success(`Created ${rows.length}`, {
      description: [
        `Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}`,
        `${needsReview} require project review`,
      ].join(" · "),
      duration: 8000,
    });
    reset();
    onClose();
    if (mode === "bulk") navigate({ to: "/dashboard", search: { view: "grouped" } });
  };

  const importable = (drafts ?? []).filter((d) => d.title.trim() && d.dupAction !== "skip").length;

  return (
    <Modal
      open={open}
      onClose={closeAll}
      title="Quick Capture"
      subtitle={
        mode === "bulk"
          ? "Paste a grouped list — project name on its own line, its work underneath. Nothing is created until you import."
          : "Paste raw notes from WhatsApp, email, a site visit or a phone call. Review, then save as real work items."
      }
      width={drafts && mode === "bulk" ? "max-w-[1200px]" : "max-w-3xl"}
      footer={
        drafts ? (
          <>
            <Button onClick={() => setDrafts(null)}>Back to notes</Button>
            <Button
              variant="primary"
              onClick={() => void saveAll()}
              disabled={!importable || create.isPending}
              {...(!importable ? { disabledReason: "Each item needs a summary" } : {})}
            >
              {create.isPending ? "Importing…" : `Import ${importable} Work Item${importable === 1 ? "" : "s"}`}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={closeAll}>Cancel</Button>
            <Button
              variant="primary"
              onClick={split}
              disabled={!raw.trim()}
              {...(!raw.trim() ? { disabledReason: "Paste or type a note first" } : {})}
            >
              <Sparkles className="size-4" />{" "}
              {mode === "bulk" ? "Parse into review" : "Split into work items"}
            </Button>
          </>
        )
      }
    >
      {!drafts ? (
        <>
          <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {(
              [
                ["note", "Quick Note"],
                ["bulk", "Bulk Import"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "h-7 rounded-md px-3 text-[12.5px] font-semibold transition-colors",
                  mode === value
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Field
            label={mode === "bulk" ? "Grouped work list" : "Raw note"}
            hint={
              mode === "bulk"
                ? "Project name on its own line, then its items underneath. Repeat for each project."
                : "One line per thing, or just paste the message — we split it for you."
            }
          >
            <TextArea
              rows={mode === "bulk" ? 14 : 7}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                mode === "bulk"
                  ? "114 Park Place\n  Master mosaic — confirm ETA\n  Drains — confirm details\n  PO — confirm PO\n\nWilkinson\n  Master door saddle — confirm detail\n  Window area — confirm install timing"
                  : "Wilkinson — need to measure master saddle. Contractor still has to finish window opening. Confirm curb was ordered."
              }
            />
          </Field>
        </>
      ) : (
        <div className="space-y-3">
          {unmatchedSections.length || fuzzySections.length ? (
            <div className="rounded-xl border border-warning/40 bg-warning-soft/50 px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-warning">
                Review project names before importing
              </p>
              <ul className="mt-1 space-y-0.5 text-[12px] text-secondary-foreground">
                {unmatchedSections.map(([k, g]) => (
                  <li key={k}>Unmatched project: “{g.heading}” — choose a project or create a stub</li>
                ))}
                {fuzzySections.map(([k, g]) => (
                  <li key={k}>
                    “{g.heading || g.label}” matched to {g.label} — confirm it is the right project
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* Batch tools */}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <span className="text-[12.5px] font-semibold">
              {selectedKeys.length ? `${selectedKeys.length} selected` : `${drafts.length} proposed`}
            </span>
            {selectedKeys.length ? (
              <>
                <div className="w-44">
                  <Combobox
                    options={owners}
                    value={null}
                    onChange={(v) =>
                      updateMany(selectedKeys, {
                        owner_user_id: v ?? null,
                        owner: profiles.find((p) => p.user_id === v)?.full_name ?? "",
                      })
                    }
                    placeholder="Assign owner…"
                  />
                </div>
                <Button size="sm" onClick={() => updateMany(selectedKeys, { is_important: true })}>
                  <Star className="size-3.5" /> Star
                </Button>
                <Button size="sm" onClick={() => updateMany(selectedKeys, { is_important: false })}>
                  Unstar
                </Button>
                <TextInput
                  type="date"
                  className="h-8 w-[150px]"
                  value={batchDate}
                  onChange={(e) => {
                    setBatchDate(e.target.value);
                    updateMany(selectedKeys, { due_date: e.target.value });
                  }}
                />
                <Select
                  className="h-8 w-[190px]"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    updateMany(selectedKeys, {
                      project_id: e.target.value === "__none__" ? "" : e.target.value,
                      groupName: "",
                    });
                  }}
                >
                  <option value="">Move to project…</option>
                  <option value="__none__">Company / Unassigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setDrafts((d) => (d ? d.filter((x) => !selectedKeys.includes(x.key)) : d));
                    setSelected({});
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </>
            ) : (
              <span className="text-[12px] text-muted-foreground">
                Select rows to assign an owner, star, set a needed-by date or move them to a project.
              </span>
            )}
          </div>

          {groups.map(([groupKey, group]) => {
            const keys = group.items.map((i) => i.key);
            const allSelected = keys.every((k) => selected[k]);
            return (
              <div key={groupKey} className="overflow-hidden rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                  <Checkbox
                    checked={allSelected}
                    onChange={(next) =>
                      setSelected((s) => ({
                        ...s,
                        ...Object.fromEntries(keys.map((k) => [k, next])),
                      }))
                    }
                  />
                  <span className="text-[13.5px] font-semibold">
                    {group.pending && group.heading
                      ? `Unmatched project: ${group.heading}`
                      : group.label}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    · {group.items.length} proposed
                  </span>
                  {group.pending && group.heading ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                      Choose existing project or create a stub
                    </span>
                  ) : null}
                  {group.fuzzy ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                      Matched from “{group.heading}” — confirm
                    </span>
                  ) : null}
                  <div className="ml-auto flex items-center gap-2">
                    <Select
                      className="h-8 w-[210px]"
                      value={group.items[0]?.project_id ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "__stub__") {
                          setStubFor(groupKey);
                          setStub({ name: group.heading || "", address: "" });
                          return;
                        }
                        setStubFor((s) => (s === groupKey ? null : s));
                        updateMany(keys, { project_id: e.target.value, groupName: "" });
                      }}
                    >

                      <option value="">Company / Unassigned</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="__stub__">+ Create project stub…</option>
                    </Select>
                  </div>
                </div>

                {stubFor === groupKey ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 border-b border-dashed border-border bg-background px-3 py-2.5">
                    <Field label="New project name">
                      <TextInput
                        value={stub.name}
                        onChange={(e) => setStub((v) => ({ ...v, name: e.target.value }))}
                        placeholder="118 Park Place"
                      />
                    </Field>
                    <Field label="Address (optional)">
                      <TextInput
                        value={stub.address}
                        onChange={(e) => setStub((v) => ({ ...v, address: e.target.value }))}
                        placeholder="Street, town"
                      />
                    </Field>
                    <Button
                      variant="primary"
                      loading={insertProject.isPending}
                      onClick={() => void createStub(groupKey, keys)}
                    >
                      Create stub
                    </Button>
                  </div>
                ) : null}

                <div className="divide-y divide-border/70">
                  {group.items.map((d) => {
                    const dup = duplicates[d.key];
                    return (
                      <div key={d.key} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={Boolean(selected[d.key])}
                            onChange={(next) => setSelected((s) => ({ ...s, [d.key]: next }))}
                          />
                          <button
                            type="button"
                            aria-label={d.is_important ? "Unstar item" : "Star item"}
                            onClick={() => update(d.key, { is_important: !d.is_important })}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                          >
                            <Star
                              className={cn(
                                "size-4",
                                d.is_important && "fill-warning text-warning",
                              )}
                            />
                          </button>
                          <TextInput
                            className="h-8 min-w-0 flex-1"
                            value={d.title}
                            onChange={(e) => update(d.key, { title: e.target.value })}
                          />
                          <div className="w-[150px] shrink-0">
                            <Combobox
                              options={owners}
                              value={d.owner_user_id}
                              onChange={(v) =>
                                update(d.key, {
                                  owner_user_id: v ?? null,
                                  owner: profiles.find((p) => p.user_id === v)?.full_name ?? "",
                                })
                              }
                              placeholder="Owner"
                            />
                          </div>
                          <TextInput
                            className="h-8 w-[120px] shrink-0"
                            placeholder="Waiting on"
                            value={d.waiting_on}
                            onChange={(e) => update(d.key, { waiting_on: e.target.value })}
                          />
                          <TextInput
                            type="date"
                            className="h-8 w-[140px] shrink-0"
                            value={d.due_date}
                            onChange={(e) => update(d.key, { due_date: e.target.value })}
                          />
                          <TextInput
                            className="h-8 w-[150px] shrink-0"
                            placeholder="Next action"
                            value={d.next_action}
                            onChange={(e) => update(d.key, { next_action: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((s) => ({ ...s, [d.key]: !s[d.key] }))
                            }
                            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-semibold text-primary hover:bg-accent"
                          >
                            {expanded[d.key] ? "Less" : "More"}
                          </button>
                          <button
                            type="button"
                            aria-label="Remove item"
                            onClick={() =>
                              setDrafts((x) => (x ? x.filter((y) => y.key !== d.key) : x))
                            }
                            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        {dup ? (
                          <div className="mt-1.5 ml-11 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft/50 px-2.5 py-1.5">
                            <span className="text-[11.5px] font-semibold text-warning">
                              Possible duplicate
                            </span>
                            <span className="truncate text-[11.5px] text-secondary-foreground">
                              of “{dup.title}”
                            </span>
                            <div className="ml-auto flex items-center gap-1">
                              {(["keep", "skip", "replace"] as const).map((a) => (
                                <button
                                  key={a}
                                  type="button"
                                  onClick={() => update(d.key, { dupAction: a })}
                                  className={cn(
                                    "rounded-md px-2 py-1 text-[11.5px] font-semibold",
                                    d.dupAction === a
                                      ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                                      : "text-muted-foreground hover:bg-card/70",
                                  )}
                                >
                                  {a === "keep"
                                    ? "Keep new"
                                    : a === "skip"
                                      ? "Skip"
                                      : "Replace existing"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {expanded[d.key] ? (
                          <div className="mt-2 ml-11 grid grid-cols-2 gap-2.5">
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
                            <Field label="Status">
                              <Select
                                value={d.status}
                                onChange={(e) => update(d.key, { status: e.target.value })}
                              >
                                {[...new Set([d.status, ...WORK_ITEM_STATUSES])].map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <p className="text-[12px] text-muted-foreground">
            Customers, contacts and users are never created from pasted text. Projects are only
            created when you approve a stub here. Administrative work can stay on Company /
            Unassigned.
          </p>
        </div>
      )}
    </Modal>
  );
}
