import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronRight, CircleHelp, Clock3, UserRound } from "lucide-react";
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
type Entry = { rule: QuestionRule; ctx: Ctx; key: string };

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
  const [followUp, setFollowUp] = useState("");
  const [mobileRail, setMobileRail] = useState(false);

  const entries = useMemo<Entry[]>(() => (setup.contexts as Ctx[]).flatMap((ctx) => setup.ruleList
    .filter((rule) => rule.readiness_category === "Design decisions")
    .filter((rule) => ruleApplies(rule, ctx))
    .filter((rule) => !setup.decisionList.some((decision) => decision.question_key === rule.key && decision.zone_id === ctx.zone.id && ["confirmed", "unresolved"].includes(decision.status)))
    .map((rule) => ({ rule, ctx, key: `${ctx.zone.id}:${rule.key}` }))), [setup.contexts, setup.ruleList, setup.decisionList]);
  const current = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;
  const currentIndex = current ? entries.findIndex((entry) => entry.key === current.key) : -1;
  const rooms = useMemo(() => setup.areaList.map((area) => ({ area, entries: entries.filter((entry) => entry.ctx.areaId === area.id) })).filter((group) => group.entries.length), [setup.areaList, entries]);

  useEffect(() => { setValue(""); setNote(""); setOwnerUserId(""); setFollowUp(""); setUnresolvedOpen(false); }, [current?.key]);
  const getSession = async () => { if (sessionId) return sessionId; const id = await openSession.mutateAsync(); setSessionId(id); return id; };

  if (setup.loading) return <div className="border-x border-b border-border bg-card px-6 py-10 text-sm text-muted-foreground">Loading design information…</div>;
  if (!current) return <div className="border-x border-b border-border bg-card px-6 py-16"><EmptyState title="Design decisions are complete" note="No applicable design questions remain for this project." action={<Link to="/projects/$projectId/scope" params={{ projectId }} className="text-sm font-semibold text-primary">Review Rooms</Link>} /></div>;

  const { rule, ctx } = current;
  const known = [ctx.selection ? selectionSummary(ctx.selection) : null, ctx.assignment?.grout_color ? `Grout · ${ctx.assignment.grout_color}` : null, ctx.assignment?.layout_pattern ? `Pattern · ${ctx.assignment.layout_pattern}` : null, ctx.surface.waterproofing ? `Waterproofing · ${ctx.surface.waterproofing}` : null].filter(Boolean);
  const ownerChoices = profileOptions(profiles);
  const submitConfirmed = async (answer: string) => { const id = await getSession(); await confirm.mutateAsync({ rule, ctx, areaId: ctx.areaId, value: answer.trim(), sessionId: id }); toast.success("Decision recorded"); setSelectedKey(null); };
  const submitUnresolved = async () => { const id = await getSession(); const workItemId = await unresolved.mutateAsync({ rule, ctx, areaId: ctx.areaId, note, sessionId: id }); const owner = profiles.find((p) => p.user_id === ownerUserId); if (ownerUserId || followUp) await saveWork.mutateAsync({ id: workItemId, patch: { owner_user_id: ownerUserId || null, owner: owner?.full_name ?? null, follow_up_on: followUp || null } }); toast.success("Tracked in Work"); setUnresolvedOpen(false); setSelectedKey(null); };

  return <>
    <div className="min-h-[630px] border-x border-b border-border bg-card lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <DecisionRail rooms={rooms} currentKey={current.key} onSelect={(key) => { setSelectedKey(key); setMobileRail(false); }} className="hidden border-r border-border lg:block" />
      <section className="flex min-w-0 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 md:px-7">
          <button type="button" onClick={() => setMobileRail(true)} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary lg:hidden"><ArrowLeft className="size-4" /> All decisions</button>
          <div className="hidden min-w-0 lg:block"><span className="text-xs font-semibold text-muted-foreground">{ctx.areaName} · {ctx.surface.name}{ctx.zone.is_default ? "" : ` · ${ctx.zone.name}`}</span></div>
          <span className="text-xs font-semibold text-muted-foreground">{currentIndex + 1} of {entries.length} open</span>
        </header>

        <div className="flex-1 px-5 py-8 pb-28 md:px-10 md:py-12 lg:px-14">
          <div className="mx-auto max-w-[760px]">
            <div className="mb-7 flex items-center gap-2 text-xs font-semibold text-primary lg:hidden"><span>{ctx.areaName}</span><ChevronRight className="size-3.5" /><span>{ctx.surface.name}</span></div>
            <div className="flex items-start gap-4">
              <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><CircleHelp className="size-4" /></span>
              <div><h1 className="text-[25px] leading-[1.25] font-semibold md:text-[31px]">{rule.prompt}</h1>{rule.help_text ? <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted-foreground">{rule.help_text}</p> : null}</div>
            </div>

            {known.length ? <div className="mt-8 border-y border-border py-4"><div className="text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Already known</div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">{known.map((item) => <span key={item}>{item}</span>)}</div></div> : null}

            <div className="mt-8">
              <AnswerControl rule={rule} value={value} onChange={setValue} selections={setup.selectionList} onChoose={submitConfirmed} disabled={!canEdit || confirm.isPending} />
            </div>
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 flex min-h-16 items-center justify-between gap-3 border-t border-border bg-card/95 px-4 backdrop-blur md:px-7">
          <Button variant="ghost" disabled={!canEdit} onClick={() => setUnresolvedOpen(true)}><Clock3 className="size-4" /> Can’t decide yet</Button>
          {!isInstantChoice(rule) ? <Button variant="primary" disabled={!canEdit || !value.trim()} loading={confirm.isPending} onClick={() => submitConfirmed(value)}><Check className="size-4" /> Record decision</Button> : null}
        </footer>
      </section>
    </div>

    <Drawer open={mobileRail} onClose={() => setMobileRail(false)} title="Open design decisions" subtitle={`${entries.length} remaining`}>
      <DecisionRail rooms={rooms} currentKey={current.key} onSelect={(key) => { setSelectedKey(key); setMobileRail(false); }} />
    </Drawer>
    <Drawer open={unresolvedOpen} onClose={() => setUnresolvedOpen(false)} title="Track this decision" subtitle={`${ctx.areaName} · ${ctx.surface.name}`} footer={<Button variant="primary" loading={unresolved.isPending || saveWork.isPending} disabled={!canEdit} onClick={submitUnresolved}>Add to Work</Button>}>
      <p className="mb-5 text-sm font-semibold leading-6">{rule.prompt}</p>
      <div className="space-y-4">
        <Field label="What is this waiting on?"><TextArea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer choice, designer input, field verification…" /></Field>
        <Field label="Owner"><Select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}><option value="">Unassigned</option>{ownerChoices.map((owner) => <option key={owner.value} value={owner.value}>{owner.label}</option>)}</Select></Field>
        <Field label="Follow up"><TextInput type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
        <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><UserRound className="mt-0.5 size-3.5 shrink-0" />Reopening this decision later updates the same Work item instead of creating a duplicate.</p>
      </div>
    </Drawer>
  </>;
}

function AnswerControl({ rule, value, onChange, selections, onChoose, disabled }: { rule: QuestionRule; value: string; onChange: (value: string) => void; selections: { id: string; label: string; tile_size?: string | null; manufacturer?: string | null }[]; onChoose: (value: string) => Promise<void>; disabled: boolean }) {
  const options = rule.answer_type === "boolean" ? ["Yes", "No"] : rule.options ?? [];
  if (rule.answer_type === "boolean" || (rule.answer_type === "choice" && options.length > 0 && options.length <= 6)) return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" disabled={disabled} onClick={() => onChoose(option)} className="min-h-16 rounded-lg border border-border bg-background px-5 text-left text-[15px] font-semibold transition-colors duration-150 hover:border-primary/45 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50">{option}</button>)}</div>;
  if (rule.answer_type === "selection_ref") return <div className="space-y-3">{selections.map((selection) => <button key={selection.id} type="button" disabled={disabled} onClick={() => onChoose(selection.id)} className="flex min-h-16 w-full items-center gap-4 rounded-lg border border-border bg-background px-5 text-left transition-colors duration-150 hover:border-primary/45 hover:bg-primary-soft disabled:opacity-50"><span className="min-w-0 flex-1"><b className="block text-[14px]">{selection.label}</b><span className="text-xs text-muted-foreground">{[selection.manufacturer, selection.tile_size].filter(Boolean).join(" · ")}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div>;
  return <Field label="Confirmed answer">{rule.answer_type === "choice" ? <Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Choose…</option>{options.map((option) => <option key={option}>{option}</option>)}</Select> : <TextInput type={rule.answer_type === "number" ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type the confirmed answer" />}</Field>;
}

function isInstantChoice(rule: QuestionRule) { return rule.answer_type === "boolean" || rule.answer_type === "selection_ref" || (rule.answer_type === "choice" && (rule.options?.length ?? 0) > 0 && (rule.options?.length ?? 0) <= 6); }
function DecisionRail({ rooms, currentKey, onSelect, className }: { rooms: { area: { id: string; name: string }; entries: Entry[] }[]; currentKey: string; onSelect: (key: string) => void; className?: string }) { return <aside className={cn("min-w-0", className)}><div className="border-b border-border px-4 py-4"><h2 className="text-[13px] font-semibold">Open decisions</h2><p className="mt-0.5 text-xs text-muted-foreground">One at a time, by room</p></div><div className="divide-y divide-border">{rooms.map(({ area, entries }) => <section key={area.id} className="py-2"><h3 className="px-4 py-2 text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{area.name}</h3>{entries.map((entry) => <button key={entry.key} type="button" onClick={() => onSelect(entry.key)} className={cn("flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-muted", currentKey === entry.key && "bg-primary-soft text-primary")}><span className="min-w-0 flex-1"><b className="block truncate text-[12.5px]">{entry.ctx.surface.name}{entry.ctx.zone.is_default ? "" : ` · ${entry.ctx.zone.name}`}</b><span className="block truncate text-[11.5px] text-muted-foreground">{entry.rule.prompt}</span></span><ChevronRight className="size-3.5 shrink-0" /></button>)}</section>)}</div></aside>; }
