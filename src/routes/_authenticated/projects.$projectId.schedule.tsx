import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState, SectionCard, Table, Td, Th } from "@/components/kit";
import { useCrews, useScheduleAssignments } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — Cobblestone Job Operations" },
      {
        name: "description",
        content: "Crew schedule and assignments for this project.",
      },
      { property: "og:title", content: "Schedule — Cobblestone Job Operations" },
      { property: "og:description", content: "Crew schedule and assignments for this project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectSchedulePage,
});

function ProjectSchedulePage() {
  const { projectId } = Route.useParams();
  const { data: assignments = [] } = useScheduleAssignments();
  const { data: crews = [] } = useCrews();

  const projectAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.project_id === projectId)
        .sort((a, b) => a.work_date.localeCompare(b.work_date)),
    [assignments, projectId],
  );

  const crewName = (id: string | null) => crews.find((c) => c.id === id)?.name ?? "Unassigned";

  return (
    <SectionCard
      title="Crew assignments"
      subtitle="Scheduled crew days for this project"
      icon={<CalendarDays className="size-4 text-primary" />}
      actions={
        <Link
          to="/schedule"
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          Open full schedule →
        </Link>
      }
    >
      {projectAssignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          note="This project has not been scheduled. Use the full schedule to assign crews."
        />
      ) : (
        <Table>
          <thead>
            <tr className="bg-muted/40">
              <Th>Date</Th>
              <Th>Crew</Th>
              <Th>Status</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {projectAssignments.map((a) => (
              <tr key={a.id} className="border-b border-border/70 last:border-0">
                <Td className="whitespace-nowrap">
                  {new Date(a.work_date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Td>
                <Td>{crewName(a.crew_id)}</Td>
                <Td>
                  <span className="text-[12px] font-medium capitalize">{a.status}</span>
                </Td>
                <Td className="text-muted-foreground">{a.notes ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );
}
