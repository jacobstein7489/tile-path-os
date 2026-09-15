import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Check, CircleHelp } from "lucide-react";
import {
  Button,
  EmptyState,
  Field,
  SectionCard,
  Select,
  TextArea,
  TextInput,
} from "@/components/kit";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useProjectSetup } from "@/lib/setup";
import {
  ruleApplies,
  useConfirmDecision,
  useMarkUnresolved,
  useOpenSession,
  type QuestionRule,
  type ZoneContext,
} from "@/lib/designmeeting";
import { selectionSummary } from "@/lib/finishes";
import { useCanEditProject } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/projects/$projectId/design")({
  component: DesignMeeting,
});

type Ctx = ZoneContext & { areaId: string };

function DesignMeeting() {
  const { projectId } = Route.useParams();
  const setup = useProjectSetup(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const confirm = useConfirmDecision(projectId);
  const unresolved = useMarkUnresolved(projectId);
  const openSession = useOpenSession(projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId && canEdit && !setup.loading) {
      openSession.mutateAsync().then(setSessionId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, setup.loading]);

  const contexts = setup.contexts as Ctx[];
  const questionsFor = (ctx: Ctx) => setup.ruleList.filter((r) => ruleApplies(r, ctx));

  useEffect(() => {
    if (contexts.length === 0) return;
    if (zoneId && contexts.some((c) => c.zone.id === zoneId)) return;
    const firstOpen = contexts.find((c) => questionsFor(c).length > 0) ?? contexts[0]!;
    setZoneId(firstOpen.zone.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexts.length, zoneId]);

  const current = contexts.find((c) => c.zone.id === zoneId) ?? null;
  const openQuestions = useMemo(() => (current ? questionsFor(current) : []), [current, setup.ruleList]);

  if (setup.loading) {
    return <div className="text-sm text-muted-foreground">Loading design information…</div>;
  }
  if (contexts.length === 0) {
    return (
      <EmptyState
        title="No surfaces to review yet"
        note="Create rooms and surfaces first — the meeting only asks about real surfaces."
      />
    );
  }

  const total = contexts.reduce((n, c) => n + questionsFor(c).length, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <SectionCard title="Rooms & surfaces" badge={<Chip>{total} open</Chip>}>
        <div className="divide-y divide-border">
          {contexts.map((c) => {
            const count = questionsFor(c).length;
            const label = `${c.surface.name}${c.zone.is_default ? "" : ` · ${c.zone.name}`}`;
            return (
              <button
                key={c.zone.id}
                type="button"
                onClick={() => setZoneId(c.zone.id)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors",
                  c.zone.id === zoneId ? "bg-accent" : "hover:bg-muted/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{label}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {c.areaName}
                  </span>
                </span>
                {count === 0 ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="space-y-4">
        {current ? (
          <>
            <SectionCard
              title={`Known information — ${current.surface.name}${current.zone.is_default ? "" : ` · ${current.zone.name}`}`}
              badge={<Chip tone="blue">{current.areaName}</Chip>}
            >
              <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                <Known label="Tile product" value={current.selection ? selectionSummary(current.selection) : null} />
                <Known label="Manufacturer" value={current.selection?.manufacturer} />
                <Known label="SKU" value={current.selection?.tile_sku} />
                <Known label="Grout" value={[current.assignment?.grout_manufacturer, current.assignment?.grout_color].filter(Boolean).join(" ")} />
                <Known label="Joint" value={current.assignment?.joint_size} />
                <Known label="Pattern" value={current.assignment?.layout_pattern} />
                <Known label="Direction" value={current.assignment?.layout_direction} />
                <Known label="Start point" value={current.assignment?.start_point} />
                <Known label="Edge / metal" value={[current.assignment?.edge_treatment, current.assignment?.metal_profile].filter(Boolean).join(" · ")} />
                <Known label="Height / termination" value={current.assignment?.tile_height} />
                <Known label="Transition" value={current.assignment?.finish_transition} />
                <Known label="Waterproofing" value={current.surface.waterproofing} />
              </div>
            </SectionCard>

            <SectionCard
              title="Decisions needed"
              badge={
                openQuestions.length === 0 ? (
                  <Chip tone="green">Nothing outstanding</Chip>
                ) : (
                  <Chip tone="amber">{openQuestions.length} to decide</Chip>
                )
              }
              actions={
                <NextButton
                  contexts={contexts}
                  zoneId={zoneId}
                  onGo={setZoneId}
                  questionsFor={questionsFor}
                />
              }
            >
              {openQuestions.length === 0 ? (
                <div className="px-5 pb-5">
                  <p className="text-[13px] text-secondary-foreground">
                    Everything applicable here is already recorded on the surface. Move to the next
                    surface or publish the installer package.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {openQuestions.map((rule) => (
                    <QuestionRow
                      key={rule.key}
                      rule={rule}
                      ctx={current}
                      canEdit={canEdit}
                      selections={setup.selectionList}
                      onConfirm={async (value) => {
                        try {
                          await confirm.mutateAsync({
                            rule,
                            ctx: current,
                            areaId: current.areaId,
                            value,
                            sessionId,
                          });
                          toast.success("Recorded on the surface");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not save");
                        }
                      }}
                      onUnresolved={async (note) => {
                        try {
                          await unresolved.mutateAsync({
                            rule,
                            ctx: current,
                            areaId: current.areaId,
                            note: note ?? "",
                            sessionId,
                          });
                          toast.success("Tracked as work — one item, updated each time");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not save");
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Known({ label, value }: { label: string; value?: string | null | undefined }) {
  const known = value !== null && value !== undefined && String(value).trim() !== "";
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-3.5 py-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[12.5px]",
          known ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {known ? value : "Not recorded"}
      </div>
    </div>
  );
}

function NextButton({
  contexts,
  zoneId,
  onGo,
  questionsFor,
}: {
  contexts: Ctx[];
  zoneId: string | null;
  onGo: (id: string) => void;
  questionsFor: (c: Ctx) => QuestionRule[];
}) {
  const idx = contexts.findIndex((c) => c.zone.id === zoneId);
  const nextOpen =
    contexts.slice(idx + 1).find((c) => questionsFor(c).length > 0) ??
    contexts.find((c) => c.zone.id !== zoneId && questionsFor(c).length > 0);
  if (!nextOpen) return null;
  return (
    <Button size="sm" onClick={() => onGo(nextOpen.zone.id)}>
      Next surface <ArrowRight className="size-3.5" />
    </Button>
  );
}

function QuestionRow({
  rule,
  ctx,
  canEdit,
  selections,
  onConfirm,
  onUnresolved,
}: {
  rule: QuestionRule;
  ctx: Ctx;
  canEdit: boolean;
  selections: { id: string; label: string; manufacturer: string | null; tile_size: string | null }[];
  onConfirm: (value: string) => Promise<void>;
  onUnresolved: (note?: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const options = rule.options ?? [];

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-2">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">{rule.prompt}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            {rule.readiness_category}
            {rule.required_for_readiness ? " · required for readiness" : " · optional"}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Field label="Answer">
                {rule.answer_type === "choice" ? (
                  <Select value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">Choose…</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : rule.answer_type === "selection_ref" ? (
                  <Select value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">Choose a tile already on this job…</option>
                    {selections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {[s.label, s.tile_size, s.manufacturer].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <TextInput
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={rule.help_text ?? "Type the confirmed answer"}
                  />
                )}
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={!canEdit || !value.trim()}
              onClick={() => onConfirm(value.trim()).then(() => setValue(""))}
            >
              <Check className="size-4" /> Confirm
            </Button>
            <Button disabled={!canEdit} onClick={() => setShowNote((s) => !s)}>
              <AlertCircle className="size-4" /> Can't decide yet
            </Button>
          </div>

          {showNote ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <Field label="What is this waiting on?">
                <TextArea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. customer picking grout with the designer Friday"
                />
              </Field>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-muted-foreground">
                  Creates one work item and reuses it on every follow-up.
                </span>
                <Button
                  onClick={() =>
                    onUnresolved(note).then(() => {
                      setNote("");
                      setShowNote(false);
                    })
                  }
                >
                  Track as work
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="sr-only">{ctx.zone.id}</div>
    </div>
  );
}
