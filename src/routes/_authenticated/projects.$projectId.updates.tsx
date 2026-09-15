import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus, Users } from "lucide-react";
import { Button, EmptyState, SectionCard, friendlyDate } from "@/components/kit";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { useProject } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";

export const Route = createFileRoute("/_authenticated/projects/$projectId/updates")({
  component: ProjectUpdates,
});

/** Every daily update on this job, newest first. This is the job's history. */
function ProjectUpdates() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: reports = [], isLoading } = useFieldReports(projectId);
  const [sheet, setSheet] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);

  return (
    <>
      <SectionCard
        title="Daily updates"
        icon={<MessageSquarePlus className="size-[18px] text-primary" />}
        subtitle="What happened on site, day by day."
        actions={
          <><Button size="sm" onClick={() => setStatusSheet(true)}>Project Status Update</Button><Button variant="primary" size="sm" onClick={() => setSheet(true)}>Daily Update</Button></>
        }
        bodyClassName="divide-y divide-border"
      >
        {isLoading ? (
          <div className="px-5 py-6 text-[13px] text-muted-foreground">Loading updates…</div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No updates yet"
            note="Add the first daily update from the job — it takes under a minute."
          />
        ) : (
          reports.map((r) => (
            <article key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[13.5px] font-semibold">{friendlyDate(r.report_date)}</span>
                {r.submitted_by_name ? (
                  <span className="text-[12px] text-muted-foreground">{r.submitted_by_name}</span>
                ) : null}
                {r.crew_label || r.worker_count ? (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Users className="size-3.5" />
                    {[r.crew_label, r.worker_count ? `${r.worker_count} on site` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </div>
              {r.areas_worked ? (
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  Areas: {r.areas_worked}
                </p>
              ) : null}
              {r.progress_note ? (
                <p className="mt-2 text-[13.5px] leading-relaxed">{r.progress_note}</p>
              ) : null}
              <dl className="mt-2 grid gap-x-6 gap-y-1.5 md:grid-cols-3">
                {[
                  ["Blockers", r.blockers],
                  ["Material needed", r.material_needed],
                  ["Next work", r.next_work],
                ]
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        {label}
                      </dt>
                      <dd className="text-[13px]">{value}</dd>
                    </div>
                  ))}
              </dl>
            </article>
          ))
        )}
      </SectionCard>

      {sheet ? (
        <FieldReportSheet
          projectId={projectId}
          projectName={project?.name ?? "Project"}
          onClose={() => setSheet(false)}
        />
      ) : null}
      {statusSheet && project ? <ProjectStatusUpdateSheet project={project} onClose={() => setStatusSheet(false)} /> : null}
    </>
  );
}
