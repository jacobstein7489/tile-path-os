import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, FileEdit, HelpCircle, ListChecks, Package } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  Button,
  Checkbox,
  QuickActionButton,
  SectionCard,
  Table,
  Td,
  Th,
} from "@/components/kit";
import { CreateWorkItemModal, RequestMaterialModal, type WorkItemKind } from "@/components/WorkItemDialogs";
import { Chip, type ChipTone } from "@/lib/status";
import { useAllWorkItems, useProjects, useUpdateRow, type WorkItemFull } from "@/lib/data";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Your owned tasks, questions and material needs that must move today.",
      },
      { property: "og:title", content: "Today — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Tasks, questions and material needs assigned to you today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

function priorityTone(p: string): ChipTone {
  return p === "High" ? "red" : p === "Medium" ? "amber" : "neutral";
}

function TodayPage() {
  const { data: items = [], isLoading } = useAllWorkItems();
  const { data: projects = [] } = useProjects();
  const updateItem = useUpdateRow("work_items");
  const [dialog, setDialog] = useState<WorkItemKind | "material" | null>(null);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";

  const open = items.filter((i) => i.status !== "Complete");
  const completed = items.filter((i) => i.status === "Complete");
  const blocked = open.filter((i) => i.status === "Waiting");

  const toggleComplete = (item: WorkItemFull) =>
    updateItem.mutate({
      id: item.id,
      patch:
        item.status === "Complete"
          ? { status: "Open", completed_at: null }
          : { status: "Complete", completed_at: new Date().toISOString() },
    });

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} viewLabel="SITE MANAGER VIEW" />
      <div className="mx-auto max-w-[1400px] px-8 pt-7 pb-16">
        <h1 className="text-[30px] leading-tight font-bold tracking-[-0.02em]">
          Good morning, Yaakov
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Here is your work for today.</p>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
          <div className="space-y-5">
            <div className="surface grid grid-cols-3 divide-x divide-border">
              <SummaryCell
                icon={<CheckCircle2 className="size-5" />}
                tone="green"
                label="Completed"
                value={completed.length}
              />
              <SummaryCell
                icon={<Clock className="size-5" />}
                tone="blue"
                label="Remaining"
                value={open.length}
              />
              <SummaryCell
                icon={<AlertTriangle className="size-5" />}
                tone="amber"
                label="Blocked"
                value={blocked.length}
              />
            </div>

            <SectionCard title="Today's Visit &amp; To-Do List" bodyClassName="pb-2">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-9" />
                    <Th className="w-[170px]">Project</Th>
                    <Th>Task Summary</Th>
                    <Th className="w-[130px]">Priority / Status</Th>
                    <Th className="w-[170px]">Next Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <Td colSpan={5} className="text-muted-foreground">
                        Loading work items…
                      </Td>
                    </tr>
                  ) : null}
                  {open.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/40">
                      <Td>
                        <Checkbox checked={false} onChange={() => toggleComplete(item)} />
                      </Td>
                      <Td>
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: item.project_id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {projectName(item.project_id)}
                        </Link>
                      </Td>
                      <Td className="text-secondary-foreground">{item.title}</Td>
                      <Td>
                        <Chip tone={priorityTone(item.priority)}>
                          {item.status === "Waiting" ? `Waiting · ${item.priority}` : item.priority}
                        </Chip>
                      </Td>
                      <Td>
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: item.project_id }}
                          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                        >
                          {item.next_action ?? "Open project"} <span aria-hidden>→</span>
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="border-t border-border px-5 pt-4 pb-1">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <CheckCircle2 className="size-[18px] text-success" />
                  Completed ({completed.length})
                </div>
              </div>
              <Table>
                <tbody>
                  {completed.map((item) => (
                    <tr key={item.id}>
                      <Td className="w-9">
                        <Checkbox checked onChange={() => toggleComplete(item)} />
                      </Td>
                      <Td className="w-[170px]">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: item.project_id }}
                          className="font-semibold text-muted-foreground line-through hover:underline"
                        >
                          {projectName(item.project_id)}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground line-through">{item.title}</Td>
                      <Td className="w-[130px]">
                        <Chip>{item.priority}</Chip>
                      </Td>
                      <Td className="w-[170px] font-semibold text-success">✓ Completed</Td>
                    </tr>
                  ))}
                  {completed.length === 0 ? (
                    <tr>
                      <Td colSpan={5} className="text-muted-foreground">
                        Nothing completed yet today.
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </SectionCard>
          </div>

          <SectionCard title="Quick Actions" bodyClassName="space-y-3 px-4 pb-4">
            <QuickActionButton
              icon={<FileEdit className="size-[18px]" />}
              label="Add Site Update"
              onClick={() => setDialog("Field Update")}
            />
            <QuickActionButton
              icon={<ListChecks className="size-[18px]" />}
              label="Create Task"
              onClick={() => setDialog("Task")}
            />
            <QuickActionButton
              icon={<HelpCircle className="size-[18px]" />}
              label="Create Question"
              onClick={() => setDialog("Question")}
            />
            <QuickActionButton
              icon={<Package className="size-[18px]" />}
              label="Request Material"
              onClick={() => setDialog("material")}
            />
            <Button className="w-full" onClick={() => setDialog("Issue")}>
              Log an issue
            </Button>
          </SectionCard>
        </div>
      </div>

      <RequestMaterialModal open={dialog === "material"} onClose={() => setDialog(null)} />
      {dialog && dialog !== "material" ? (
        <CreateWorkItemModal open onClose={() => setDialog(null)} kind={dialog} />
      ) : null}
    </>
  );
}

function SummaryCell({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "green" | "blue" | "amber";
  label: string;
  value: number;
}) {
  const ring =
    tone === "green"
      ? "bg-success-soft text-success"
      : tone === "blue"
        ? "bg-info-soft text-info"
        : "bg-warning-soft text-warning";
  const text = tone === "green" ? "text-success" : tone === "blue" ? "text-info" : "text-warning";
  return (
    <div className="flex items-center gap-4 px-6 py-5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${ring}`}>{icon}</span>
      <div>
        <div className="text-[13px] font-medium text-secondary-foreground">{label}</div>
        <div className={`text-[28px] leading-[1.1] font-semibold ${text}`}>{value}</div>
      </div>
    </div>
  );
}
