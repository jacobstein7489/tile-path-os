import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  FileQuestion,
  FileText,
  Layers3,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Field, TextArea, TextInput } from "@/components/kit";
import { VNextLifecycle } from "@/components/vnext/VNextLifecycle";
import { JobIdentity, VNextPanel, WorkRow, formatDate } from "@/components/vnext/VNextPrimitives";
import { useAreasWithSurfaces, useProject, useUpdateProject } from "@/lib/data";
import { useCompanies, useProfiles } from "@/lib/people";
import { useProjectFiles } from "@/lib/setup";
import { compareWorkItems, isComplete, useWorkFeed } from "@/lib/workitems";
import { nextVNextStage, storedVNextStage, vnextStage } from "@/lib/vnext";

export function VNextEstimating() {
  const { jobId } = useParams({ from: "/_authenticated/vnext/jobs/$jobId/estimate" });
  const { data: project } = useProject(jobId);
  const update = useUpdateProject(jobId);
  const { data: companies = [] } = useCompanies();
  const { data: profiles = [] } = useProfiles();
  const { data: files = [] } = useProjectFiles(jobId);
  const { areas, surfaces } = useAreasWithSurfaces(jobId);
  const { data: feed = [] } = useWorkFeed();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    intake_notes: "",
    bid_due_date: "",
    follow_up_date: "",
    next_move: "",
  });
  if (!project) return null;
  const stage = vnextStage(project);
  const customer =
    companies.find((item) => item.id === project.customer_company_id)?.name ?? project.customer;
  const estimator = profiles.find((item) => item.user_id === project.estimator_user_id)?.full_name;
  const work = feed
    .filter((item) => item.project_id === jobId && !isComplete(item))
    .sort(compareWorkItems);
  const questions = work.filter((item) =>
    /question|decision|clarif/i.test(`${item.item_type} ${item.category ?? ""} ${item.title}`),
  );
  const beginEdit = () => {
    setDraft({
      intake_notes: project.intake_notes ?? "",
      bid_due_date: project.bid_due_date ?? "",
      follow_up_date: project.follow_up_date ?? "",
      next_move: project.next_move ?? "",
    });
    setEditing(true);
  };
  const save = async () => {
    await update.mutateAsync({
      intake_notes: draft.intake_notes || null,
      bid_due_date: draft.bid_due_date || null,
      follow_up_date: draft.follow_up_date || null,
      next_move: draft.next_move || null,
    });
    setEditing(false);
    toast.success("Estimate facts saved");
  };
  const next = nextVNextStage(stage);
  const advance = async () => {
    if (!next || !["New Job / Price Request", "Estimate", "Proposal Sent"].includes(stage)) return;
    await update.mutateAsync({
      lifecycle_stage: storedVNextStage(next),
      ...(next === "Awarded" ? { awarded_at: new Date().toISOString() } : {}),
    });
    toast.success(`Job advanced to ${next}`);
  };
  return (
    <div className="mx-auto max-w-[1460px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
      <Link
        to="/vnext/jobs/$jobId"
        params={{ jobId }}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-vnext-muted"
      >
        <ArrowLeft className="size-3.5" /> Job overview
      </Link>
      <header className="mt-4 overflow-hidden rounded-[18px] border border-vnext-line bg-vnext-surface shadow-[var(--vnext-shadow-panel)]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
          <JobIdentity project={project} customer={customer} stage={stage} />
          <div className="flex gap-2">
            <Button onClick={editing ? () => setEditing(false) : beginEdit}>
              {editing ? "Cancel" : "Edit estimate facts"}
            </Button>
            {editing ? (
              <Button variant="primary" onClick={() => void save()} loading={update.isPending}>
                <Save className="size-4" /> Save
              </Button>
            ) : null}
            {next && ["New Job / Price Request", "Estimate", "Proposal Sent"].includes(stage) ? (
              <Button variant="primary" className="bg-vnext-ink" onClick={() => void advance()}>
                <Send className="size-4" /> {next === "Awarded" ? "Award job" : `Move to ${next}`}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="border-t border-vnext-line bg-vnext-wash/55 px-4 py-3 sm:px-7">
          <VNextLifecycle stage={stage} />
        </div>
      </header>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.75fr)]">
        <div className="space-y-5">
          <VNextPanel title="Request & scope" eyebrow="What Cobblestone is pricing">
            {editing ? (
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Scope / request notes">
                    <TextArea
                      rows={6}
                      value={draft.intake_notes}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, intake_notes: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Bid due">
                  <TextInput
                    type="date"
                    value={draft.bid_due_date}
                    onChange={(e) =>
                      setDraft((value) => ({ ...value, bid_due_date: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Follow-up">
                  <TextInput
                    type="date"
                    value={draft.follow_up_date}
                    onChange={(e) =>
                      setDraft((value) => ({ ...value, follow_up_date: e.target.value }))
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Next move">
                    <TextInput
                      value={draft.next_move}
                      onChange={(e) =>
                        setDraft((value) => ({ ...value, next_move: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-[12.5px] leading-6">
                  {project.intake_notes ?? "No scope notes have been recorded."}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact label="Estimator" value={estimator ?? "Unassigned"} />
                  <Fact label="Bid due" value={formatDate(project.bid_due_date)} />
                  <Fact label="Follow-up" value={formatDate(project.follow_up_date)} />
                  <Fact label="Source" value={project.source ?? "Not set"} />
                </div>
              </div>
            )}
          </VNextPanel>
          <div className="grid gap-5 lg:grid-cols-2">
            <VNextPanel title="Physical scope" eyebrow="Rooms, surfaces & quantities">
              <div className="grid grid-cols-2 gap-px bg-vnext-line">
                <BigFact
                  icon={Layers3}
                  label="Rooms / areas"
                  value={String(areas.data?.length ?? 0)}
                />
                <BigFact
                  icon={Calculator}
                  label="Surfaces"
                  value={String(surfaces.data?.length ?? 0)}
                />
              </div>
              <div className="space-y-2 p-4">
                {(areas.data ?? []).map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between rounded-lg bg-vnext-wash px-3 py-2.5"
                  >
                    <strong className="text-[11.5px]">{area.name}</strong>
                    <span className="text-[10.5px] text-vnext-muted">
                      {
                        (surfaces.data ?? []).filter((surface) => surface.area_id === area.id)
                          .length
                      }{" "}
                      surfaces
                    </span>
                  </div>
                ))}
                {!areas.data?.length ? (
                  <p className="text-[11.5px] text-vnext-muted">No rooms have been mapped yet.</p>
                ) : null}
              </div>
            </VNextPanel>
            <VNextPanel title="Plans & references" eyebrow={`${files.length} files`}>
              <div className="space-y-2 p-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border border-vnext-line p-3"
                  >
                    <FileText className="size-4 text-vnext-blue" />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold">
                      {file.filename}
                    </span>
                    <span className="text-[9px] font-bold text-vnext-faint uppercase">
                      {file.kind}
                    </span>
                  </div>
                ))}
                {!files.length ? (
                  <p className="text-[11.5px] text-vnext-muted">
                    No plans or scope documents are attached.
                  </p>
                ) : null}
              </div>
            </VNextPanel>
          </div>
        </div>
        <div className="space-y-5">
          <section className="rounded-[16px] bg-vnext-ink p-5 text-vnext-surface shadow-[var(--vnext-shadow-float)]">
            <p className="vnext-kicker text-vnext-blue-soft">Next move</p>
            <h2 className="mt-3 font-display text-[22px] leading-tight font-bold">
              {project.next_move ?? "Confirm scope and move the estimate forward"}
            </h2>
            <p className="mt-2 text-[11.5px] leading-5 text-vnext-surface/65">
              Operational estimate status lives here; financial estimating can remain in QuickBooks.
            </p>
          </section>
          <VNextPanel title="Clarifications" eyebrow={`${questions.length} open`}>
            <div className="space-y-2 p-3">
              {questions.map((item) => (
                <WorkRow key={item.id} item={item} />
              ))}
              {!questions.length ? (
                <div className="flex gap-3 p-2 text-vnext-muted">
                  <FileQuestion className="size-4 shrink-0" />
                  <p className="text-[11.5px]">No open clarification questions.</p>
                </div>
              ) : null}
            </div>
          </VNextPanel>
          <VNextPanel title="Estimate record gaps">
            <div className="space-y-2 p-4 text-[11px] leading-5 text-vnext-muted">
              <p>
                Estimate amount, proposal identifier, revision history, assumptions, exclusions, and
                QuickBooks reference are not dedicated fields today.
              </p>
              <p>
                The workspace shows only facts already stored; it does not invent commercial data.
              </p>
            </div>
          </VNextPanel>
        </div>
      </div>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-extrabold text-vnext-faint uppercase">{label}</span>
      <strong className="mt-1 block text-[11.5px]">{value}</strong>
    </div>
  );
}
function BigFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calculator;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-vnext-surface p-5">
      <Icon className="size-4 text-vnext-blue" />
      <strong className="mt-3 block font-display text-[28px]">{value}</strong>
      <span className="text-[9px] font-extrabold text-vnext-faint uppercase">{label}</span>
    </div>
  );
}
