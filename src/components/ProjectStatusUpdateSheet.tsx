import { useMemo, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, TextArea } from "@/components/kit";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { useScheduleAssignments, type Project } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { compareWorkItems, isComplete, isWaiting, useWorkFeed } from "@/lib/workitems";

export function ProjectStatusUpdateSheet({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { data: reports = [] } = useFieldReports(project.id);
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const facts = useMemo(() => {
    const items = work
      .filter((i) => i.project_id === project.id && !isComplete(i))
      .sort(compareWorkItems);
    const waiting = items
      .filter(isWaiting)
      .slice(0, 3)
      .map((i) => i.title)
      .join("\n");
    const upcoming = schedule
      .filter(
        (s) => s.project_id === project.id && s.work_date >= new Date().toISOString().slice(0, 10),
      )
      .sort((a, b) => a.work_date.localeCompare(b.work_date))[0];
    return {
      completed: reports[0]?.progress_note ?? "",
      current: items[0]?.title ?? "",
      waiting,
      next: reports[0]?.next_work ?? items[0]?.next_action ?? "",
      upcoming: upcoming ? `${upcoming.work_date} · ${upcoming.kind}` : "",
    };
  }, [project.id, reports, schedule, work]);
  const [form, setForm] = useState(facts);
  const text = [
    project.name,
    `Stage: ${project.exception_state ?? project.lifecycle_stage}`,
    form.completed && `Completed since last update:\n${form.completed}`,
    form.current && `Currently working on:\n${form.current}`,
    form.waiting && `Waiting / blockers:\n${form.waiting}`,
    form.next && `Next steps:\n${form.next}`,
    form.upcoming && `Upcoming:\n${form.upcoming}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Project Status Update"
      description={`${project.name} · pre-filled from current records`}
      className="max-w-[680px]"
    >
      <div className="bg-canvas p-3 sm:p-5">
        <div className="workspace-panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-[20px] font-bold">Project Status Update</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {project.name} · pre-filled from current records
            </p>
          </header>
          <div className="space-y-4 p-5">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Review the facts before sharing. Blank sections stay out of the final update.
            </p>
            {(
              [
                ["completed", "Completed since last update"],
                ["current", "Currently working on"],
                ["waiting", "Waiting / blockers"],
                ["next", "Next steps"],
                ["upcoming", "Upcoming schedule"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <TextArea
                  rows={key === "waiting" ? 3 : 2}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
            <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <Check className="size-4 text-success" /> Built only from current project records;
              nothing is sent automatically.
            </div>
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print / Export
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                navigator.clipboard.writeText(text).then(() => toast.success("Update copied"))
              }
            >
              <Copy className="size-4" /> Copy Update
            </Button>
          </footer>
        </div>
      </div>
    </CenterDialog>
  );
}
