import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, EmptyState, Field, Select, TextArea, TextInput } from "@/components/kit";
import { useCanEditProject } from "@/hooks/useAuth";
import { ruleApplies, useConfirmDecision, useMarkUnresolved, useOpenSession, type QuestionRule, type ZoneContext } from "@/lib/designmeeting";
import { selectionSummary } from "@/lib/finishes";
import { profileOptions, useProfiles } from "@/lib/people";
import { useProjectSetup } from "@/lib/setup";
import { useSaveWorkItem } from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/design")({
  head: () => ({ meta: [
    { title: "Design Meeting — Cobblestone Tile OS" },
    { name: "description", content: "Resolve genuine tile design decisions one room and surface at a time." },
    { property: "og:title", content: "Design Meeting — Cobblestone Tile OS" },
    { property: "og:description", content: "Resolve genuine tile design decisions one at a time." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}), component: DesignMeeting,
});

type Ctx = ZoneContext & { areaId: string };
type Entry = { rule: QuestionRule; ctx: Ctx; key: string; tracked?: boolean };
const OFFICE_TARGETS = new Set(["surface.waterproofing", "surface.prep", "surface.underlayment"]);

function DesignMeeting() {
  const { projectId } = Route.useParams();
  const setup = useProjectSetup(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const confirm = useConfirmDecision(projectId);
  const unresolved = useMarkUnresolved(projectId);
  const openSession = useOpenSession(projectId);
  const saveWork = useSaveWorkItem();
  const { data: profiles = [] } = useProfiles();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [unresolvedOpen, setUnresolvedOpen] = useState(false);
  const [note, setNote] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [mobileRail, setMobileRail] = useState(false);

  // Confirmed decisions leave the queue for good. Decisions tracked in Work stay
  // available so the same question can be answered once the answer comes back.
  const entries = useMemo<Entry[]>(() => (setup.contexts as Ctx[]).flatMap((ctx) => setup.ruleList
    .filter((rule) => rule.readiness_category === "Design decisions")
    .filter((rule) => !OFFICE_TARGETS.has(rule.target_key))
    .filter((rule) => ruleApplies(rule, ctx))
    .filter((rule) => !setup.decisionList.some((decision) => decision.question_key === rule.key && decision.zone_id === ctx.zone.id && decision.status === "confirmed"))
    .map((rule) => ({ rule, ctx, key: `${ctx.zone.id}:${rule.key}`, tracked: setup.decisionList.some((decision) => decision.question_key === rule.key && decision.zone_id === ctx.zone.id && decision.status === "unresolved") })))
    .sort((a, b) => Number(a.tracked ?? false) - Number(b.tracked ?? false)), [setup.contexts, setup.ruleList, setup.decisionList]);
  const current = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;
  const currentSurfaceEntries = current ? entries.filter((entry) => entry.ctx.surface.id === current.ctx.surface.id) : [];
  const currentIndex = current ? currentSurfaceEntries.findIndex((entry) => entry.key === current.key) : -1;
  const rooms = useMemo(() => setup.areaList.map((area) => ({ area, surfaces: setup.surfaceList.filter((surface) => surface.area_id === area.id).map((surface) => ({ surface, entries: entries.filter((entry) => entry.ctx.surface.id === surface.id) })) })).filter((group) => group.surfaces.length), [setup.areaList, setup.surfaceList, entries]);

  useEffect(() => { setValue(""); setNote(""); setOwnerUserId(""); setWaitingOn(""); setFollowUp(""); setUnresolvedOpen(false); }, [current?.key]);
  const getSession = async () => { if (sessionId) return sessionId; const id = await openSession.mutateAsync(); setSessionId(id); return id; };

  if (setup.loading) return <div className="border-x border-b border-border bg-card px-6 py-10 text-sm text-muted-foreground">Loading design information…</div>;
  if (!current) return <div className="border-x border-b border-border bg-card px-6 py-16"><EmptyState title="Design decisions are complete" note="No applicable design questions remain for this project." action={<Link to="/projects/$projectId/scope" params={{ projectId }} className="text-sm font-semibold text-primary">Review Rooms</Link>} /></div>;

  const { rule, ctx } = current;
  const known = [ctx.selection ? selectionSummary(ctx.selection) : null, ctx.assignment?.grout_color ? `Grout · ${ctx.assignment.grout_color}` : null, ctx.assignment?.layout_pattern ? `Pattern · ${ctx.assignment.layout_pattern}` : null, ctx.surface.waterproofing ? `Waterproofing · ${ctx.surface.waterproofing}` : null].filter(Boolean);
  const ownerChoices = profileOptions(profiles);
  const advance = () => { const next = currentSurfaceEntries[currentIndex + 1] ?? entries.find((entry) => entry.ctx.surface.id !== current.ctx.surface.id); setSelectedKey(next?.key ?? null); };
  const submitConfirmed = async () => { const id = await getSession(); await confirm.mutateAsync({ rule, ctx, areaId: ctx.areaId, value: value.trim(), sessionId: id }); toast.success("Decision recorded"); advance(); };
  const submitUnresolved = async () => { const id = await getSession(); const workItemId = await unresolved.mutateAsync({ rule, ctx, areaId: ctx.areaId, note, sessionId: id }); const owner = profiles.find((p) => p.user_id === ownerUserId); await saveWork.mutateAsync({ id: workItemId, patch: { owner_user_id: ownerUserId || null, owner: owner?.full_name ?? null, waiting_on: waitingOn.trim() || null, follow_up_on: followUp || null } }); toast.success("Tracked in Work"); setUnresolvedOpen(false); advance(); };

  return <>
    <div className="min-h-[680px] bg-card lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <DecisionRail rooms={rooms} currentKey={current.key} onSelect={(key) => { setSelectedKey(key); setMobileRail(false); }} className="hidden border-r border-border bg-foreground text-background lg:block" />
      <section className="flex min-w-0 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 md:px-8">
          <button type="button" onClick={() => setMobileRail(true)} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary lg:hidden"><ArrowLeft className="size-4" /> All decisions</button>
          <div className="hidden min-w-0 lg:block"><span className="text-xs font-semibold text-muted-foreground">{ctx.areaName} · {ctx.surface.name}{ctx.zone.is_default ? "" : ` · ${ctx.zone.name}`}</span></div>
           <span className="text-xs font-semibold text-muted-foreground">Decision {currentIndex + 1} of {currentSurfaceEntries.length} · {ctx.surface.name}</span>
        </header>

        <div className="flex-1 px-5 py-8 pb-28 md:px-8 md:py-10">
          <div className="mx-auto grid max-w-[1020px] gap-10 xl:grid-cols-[minmax(0,1fr)_240px]">
           <div>
            <div className="mb-7 flex items-center gap-2 text-xs font-semibold text-primary lg:hidden"><span>{ctx.areaName}</span><ChevronRight className="size-3.5" /><span>{ctx.surface.name}</span></div>
            <div className="flex items-start gap-4">
               <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><CircleHelp className="size-4" /></span>
               <div><p className="v2-kicker mb-2">Decision required</p><h1 className="text-[27px] leading-[1.2] font-bold md:text-[36px]">{rule.prompt}</h1>{current.tracked ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-warning"><Clock3 className="size-3.5" /> Waiting in Work — confirming closes that item</p> : null}{rule.help_text ? <p className="mt-4 max-w-2xl text-[14px] leading-6 text-muted-foreground">{rule.help_text}</p> : null}</div>
            </div>

            <div className="mt-8">
               <AnswerControl rule={rule} value={value} onChange={setValue} selections={setup.selectionList} disabled={!canEdit || confirm.isPending} />
            </div>
           </div>
           <aside className="border-t border-border pt-6 xl:border-t-0 xl:border-l xl:pl-7"><p className="v2-kicker">Already known</p>{known.length ? <dl className="mt-4 space-y-4">{known.map((item) => { const [label, detail] = String(item).split(" · "); return <div key={String(item)}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 text-[13px] font-semibold">{detail ?? label}</dd></div>; })}</dl> : <p className="mt-3 text-xs text-muted-foreground">No related facts recorded.</p>}</aside>
          </div>
        </div>

         <footer className="fixed inset-x-0 bottom-16 z-30 flex min-h-16 items-center justify-between gap-3 border-t border-border bg-card/95 px-4 backdrop-blur md:sticky md:bottom-0 md:z-10 md:px-7 lg:inset-auto">
          <Button variant="ghost" disabled={!canEdit} onClick={() => setUnresolvedOpen(true)}><Clock3 className="size-4" /> Can’t decide yet</Button>
           <Button variant="primary" disabled={!canEdit || !value.trim()} loading={confirm.isPending} onClick={submitConfirmed}><Check className="size-4" /> Confirm & Next</Button>
        </footer>
      </section>
    </div>

    <Drawer open={mobileRail} onClose={() => setMobileRail(false)} title="Design surfaces" subtitle="One row per surface">
      <DecisionRail rooms={rooms} currentKey={current.key} onSelect={(key) => { setSelectedKey(key); setMobileRail(false); }} />
    </Drawer>
    <Drawer open={unresolvedOpen} onClose={() => setUnresolvedOpen(false)} title="Track this decision" subtitle={`${ctx.areaName} · ${ctx.surface.name}`} footer={<Button variant="primary" loading={unresolved.isPending || saveWork.isPending} disabled={!canEdit} onClick={submitUnresolved}>Add to Work</Button>}>
      <p className="mb-5 text-sm font-semibold leading-6">{rule.prompt}</p>
      <div className="space-y-4">
        <Field label="What is this waiting on?"><TextArea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer choice, designer input, field verification…" /></Field>
        <Field label="Owner"><Select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}><option value="">Unassigned</option>{ownerChoices.map((owner) => <option key={owner.value} value={owner.value}>{owner.label}</option>)}</Select></Field>
        <Field label="Waiting on"><TextInput value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="Customer, architect, site condition…" /></Field>
        <Field label="Follow up"><TextInput type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
        <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><UserRound className="mt-0.5 size-3.5 shrink-0" />Reopening this decision later updates the same Work item instead of creating a duplicate.</p>
      </div>
    </Drawer>
  </>;
}

function AnswerControl({ rule, value, onChange, selections, disabled }: { rule: QuestionRule; value: string; onChange: (value: string) => void; selections: { id: string; label: string; tile_size?: string | null; manufacturer?: string | null }[]; disabled: boolean }) {
  const options = rule.answer_type === "boolean" ? ["Yes", "No"] : rule.options ?? [];
  if (rule.answer_type === "boolean" || (rule.answer_type === "choice" && options.length > 0 && options.length <= 6)) return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" disabled={disabled} onClick={() => onChange(option)} className={cn("min-h-16 rounded-lg border bg-background px-5 text-left text-[15px] font-semibold transition-colors duration-150 hover:border-primary/45 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50", value === option ? "border-primary bg-primary-soft text-primary" : "border-border")}>{option}{value === option ? <Check className="ml-2 inline size-4" /> : null}</button>)}</div>;
  if (rule.answer_type === "selection_ref") return <div className="space-y-3">{selections.map((selection) => <button key={selection.id} type="button" disabled={disabled} onClick={() => onChange(selection.id)} className={cn("flex min-h-16 w-full items-center gap-4 rounded-lg border bg-background px-5 text-left transition-colors duration-150 hover:border-primary/45 hover:bg-primary-soft disabled:opacity-50", value === selection.id ? "border-primary bg-primary-soft" : "border-border")}><span className="min-w-0 flex-1"><b className="block text-[14px]">{selection.label}</b><span className="text-xs text-muted-foreground">{[selection.manufacturer, selection.tile_size].filter(Boolean).join(" · ")}</span></span>{value === selection.id ? <Check className="size-4 text-primary" /> : <ChevronRight className="size-4 text-muted-foreground" />}</button>)}</div>;
  return <Field label="Confirmed answer">{rule.answer_type === "choice" ? <Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Choose…</option>{options.map((option) => <option key={option}>{option}</option>)}</Select> : <TextInput type={rule.answer_type === "number" ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type the confirmed answer" />}</Field>;
}

function DecisionRail({ rooms, currentKey, onSelect, className }: { rooms: { area: { id: string; name: string }; surfaces: { surface: { id: string; name: string }; entries: Entry[] }[] }[]; currentKey: string; onSelect: (key: string) => void; className?: string }) { return <aside className={cn("min-w-0", className)}><div className="border-b border-current/15 px-4 py-5"><p className="v2-kicker !text-current/45">Design meeting</p><h2 className="mt-1 text-[15px] font-bold">Decision queue</h2></div><div>{rooms.map(({ area, surfaces }) => <section key={area.id} className="py-3"><h3 className="px-4 py-2 text-[10px] font-bold tracking-[0.1em] text-current/45 uppercase">{area.name}</h3>{surfaces.map(({ surface, entries }) => { const next = entries[0]; const selected = entries.some((entry) => entry.key === currentKey); return <button key={surface.id} type="button" disabled={!next} onClick={() => next && onSelect(next.key)} className={cn("flex min-h-12 w-full items-center gap-3 border-l-2 border-transparent px-4 text-left transition-colors duration-150 hover:bg-current/5 disabled:cursor-default", selected && "border-primary bg-current/10")}><span className="min-w-0 flex-1"><b className="block truncate text-[12.5px]">{surface.name}</b><span className={cn("block truncate text-[11px]", next ? "text-current/55" : "text-success")}>{next ? `${entries.length} remaining` : "Ready"}</span></span>{next ? <ChevronRight className="size-3.5 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0 text-success" />}</button>; })}</section>)}</div></aside>; }
