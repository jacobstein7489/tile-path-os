import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Field, Select, TextArea, TextInput } from "@/components/kit";
import { useCanEditProject } from "@/hooks/useAuth";
import { ruleApplies, useConfirmDecision, useMarkUnresolved, useOpenSession, type QuestionRule, type ZoneContext } from "@/lib/designmeeting";
import { selectionSummary } from "@/lib/finishes";
import { useProjectSetup } from "@/lib/setup";

export const Route = createFileRoute("/_authenticated/projects/$projectId/design")({ component: DesignMeeting });
type Ctx = ZoneContext & { areaId: string };
type Entry = { rule: QuestionRule; ctx: Ctx };

function DesignMeeting() {
  const { projectId } = Route.useParams();
  const setup = useProjectSetup(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const confirm = useConfirmDecision(projectId);
  const unresolved = useMarkUnresolved(projectId);
  const openSession = useOpenSession(projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const entries = useMemo<Entry[]>(() => (setup.contexts as Ctx[]).flatMap((ctx) => setup.ruleList.filter((rule) => ruleApplies(rule, ctx)).map((rule) => ({ rule, ctx }))), [setup.contexts, setup.ruleList]);
  const current = entries[Math.min(index, Math.max(0, entries.length - 1))] ?? null;

  useEffect(() => { if (!sessionId && canEdit && !setup.loading) openSession.mutateAsync().then(setSessionId).catch(() => undefined); }, [canEdit, openSession, sessionId, setup.loading]);
  useEffect(() => { setValue(""); setNote(""); setNoteOpen(false); }, [current?.ctx.zone.id, current?.rule.key]);

  if (setup.loading) return <div className="text-sm text-muted-foreground">Loading design information…</div>;
  if (!current) return <div className="surface"><EmptyState title="Design decisions are complete" note="No applicable questions remain for this project." /></div>;
  const { rule, ctx } = current;
  const options = rule.options ?? [];
  const known = [ctx.selection ? selectionSummary(ctx.selection) : null, ctx.assignment?.grout_color ? `Grout ${ctx.assignment.grout_color}` : null, ctx.assignment?.layout_pattern, ctx.surface.waterproofing ? `Waterproofing ${ctx.surface.waterproofing}` : null].filter(Boolean);
  const advance = () => setIndex((i) => Math.min(i + 1, Math.max(entries.length - 1, 0)));

  return <div className="mx-auto max-w-[780px]">
    <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground"><span>Decision {Math.min(index + 1, entries.length)} of {entries.length}</span><span>{ctx.areaName} · {ctx.surface.name}{ctx.zone.is_default ? "" : ` · ${ctx.zone.name}`}</span></div>
    <div className="h-1 overflow-hidden rounded-full bg-track"><div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${((index + 1) / entries.length) * 100}%` }} /></div>
    <section className="surface mt-4 overflow-hidden">
      <header className="border-b border-border px-5 py-5 md:px-7"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><CircleHelp className="size-4" /></span><div><h1 className="text-[22px] leading-snug font-bold">{rule.prompt}</h1>{rule.help_text ? <p className="mt-1 text-[13px] text-muted-foreground">{rule.help_text}</p> : null}</div></div></header>
      <div className="space-y-5 px-5 py-5 md:px-7">
        {known.length ? <div className="rounded-lg border border-border bg-muted/35 px-4 py-3"><div className="text-[10.5px] font-bold uppercase text-muted-foreground">Already known</div><p className="mt-1 text-[13px]">{known.join(" · ")}</p></div> : null}
        <Field label="Confirmed answer">{rule.answer_type === "choice" ? <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose…</option>{options.map((o) => <option key={o}>{o}</option>)}</Select> : rule.answer_type === "selection_ref" ? <Select value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a tile on this job…</option>{setup.selectionList.map((s) => <option key={s.id} value={s.id}>{[s.label, s.tile_size, s.manufacturer].filter(Boolean).join(" · ")}</option>)}</Select> : <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type the confirmed answer" />}</Field>
        {noteOpen ? <div className="space-y-3 rounded-lg border border-border bg-muted/35 p-4"><Field label="What is this waiting on?"><TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer, designer, field verification…" /></Field><Button disabled={!canEdit} onClick={() => unresolved.mutateAsync({ rule, ctx, areaId: ctx.areaId, note, sessionId }).then(() => { toast.success("Tracked in Work"); advance(); })}>Track one Work item</Button></div> : null}
      </div>
      <footer className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border px-5 py-4 md:px-7"><Button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}><ArrowLeft className="size-4" /> Back</Button><Button className="justify-self-center" onClick={() => setNoteOpen((v) => !v)}>Can’t decide yet</Button><Button variant="primary" disabled={!canEdit || !value.trim()} onClick={() => confirm.mutateAsync({ rule, ctx, areaId: ctx.areaId, value: value.trim(), sessionId }).then(() => { toast.success("Decision recorded"); advance(); })}><Check className="size-4" /> Confirm <ArrowRight className="size-4" /></Button></footer>
    </section>
  </div>;
}