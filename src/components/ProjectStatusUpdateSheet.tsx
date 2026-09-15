import { useMemo, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, Field, TextArea } from "@/components/kit";
import { useScheduleAssignments, type Project } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { compareWorkItems, isComplete, isWaiting, useWorkFeed } from "@/lib/workitems";

export function ProjectStatusUpdateSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data: reports = [] } = useFieldReports(project.id);
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const facts = useMemo(() => {
    const items = work.filter((i) => i.project_id === project.id && !isComplete(i)).sort(compareWorkItems);
    const waiting = items.filter(isWaiting).slice(0, 3).map((i) => i.title).join("\n");
    const upcoming = schedule.filter((s) => s.project_id === project.id && s.work_date >= new Date().toISOString().slice(0, 10)).sort((a,b) => a.work_date.localeCompare(b.work_date))[0];
    return {
      completed: reports[0]?.progress_note ?? "",
      current: items[0]?.title ?? "",
      waiting,
      next: reports[0]?.next_work ?? items[0]?.next_action ?? "",
      upcoming: upcoming ? `${upcoming.work_date} · ${upcoming.kind}` : "",
    };
  }, [project.id, reports, schedule, work]);
  const [form, setForm] = useState(facts);
  const text = [project.name, `Stage: ${project.exception_state ?? project.lifecycle_stage}`, form.completed && `Completed since last update:\n${form.completed}`, form.current && `Currently working on:\n${form.current}`, form.waiting && `Waiting / blockers:\n${form.waiting}`, form.next && `Next steps:\n${form.next}`, form.upcoming && `Upcoming:\n${form.upcoming}`].filter(Boolean).join("\n\n");
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  return <Drawer open onClose={onClose} width="max-w-[620px]" title="Project Status Update" subtitle={`${project.name} · pre-filled from current records`} footer={<><Button onClick={() => window.print()}><Printer className="size-4" /> Print / Export</Button><Button variant="primary" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Update copied"))}><Copy className="size-4" /> Copy Update</Button></>}>
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">Review the facts before sharing. Blank sections stay out of the final update.</p>
      {([['completed','Completed since last update'],['current','Currently working on'],['waiting','Waiting / blockers'],['next','Next steps'],['upcoming','Upcoming schedule']] as const).map(([key,label]) => <Field key={key} label={label}><TextArea rows={key === 'waiting' ? 3 : 2} value={form[key]} onChange={(e) => set(key,e.target.value)} /></Field>)}
      <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><Check className="size-4 text-success" /> Built only from current project records; nothing is sent automatically.</div>
    </div>
  </Drawer>;
}