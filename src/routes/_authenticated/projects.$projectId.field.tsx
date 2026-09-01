import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, HardHat, MessageSquarePlus, Plus } from "lucide-react";
import {
  Button,
  Checkbox,
  EmptyState,
  SectionCard,
  Table,
  Td,
  Th,
} from "@/components/kit";
import { CreateWorkItemModal, type WorkItemKind } from "@/components/WorkItemDialogs";
import { ProgressBar } from "@/components/ProgressBar";
import { Chip, areaStatusTone, workItemTone } from "@/lib/status";
import {
  useAreasWithSurfaces,
  useUpdateRow,
  useVisitChecklist,
  useWorkItems,
  type WorkItemFull,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/field")({
  component: FieldTab,
});

function FieldTab() {
  const { projectId } = Route.useParams();
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const { data: items = [] } = useWorkItems(projectId);
  const { data: checklist = [] } = useVisitChecklist(projectId);
  const updateChecklist = useUpdateRow("visit_checklist_items");
  const updateSurface = useUpdateRow("project_surfaces");
  const updateItem = useUpdateRow("work_items");
  const [create, setCreate] = useState<WorkItemKind | null>(null);

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const open = (items as WorkItemFull[]).filter((i) => i.status !== "Complete");

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-5">
        <div className="space-y-5">
          <SectionCard
            title="Physical progress by area"
            icon={<HardHat className="size-[18px] text-primary" />}
            subtitle="Surface progress rolls up to the area and to the project."
            bodyClassName="divide-y divide-border"
          >
            {areaList.map((a) => {
              const list = surfaceList.filter((s) => s.area_id === a.id);
              return (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{a.name}</span>
                      <Chip tone={areaStatusTone(a.status)}>{a.status}</Chip>
                    </div>
                    <span className="text-[13px] font-semibold">{a.progress_pct}%</span>
                  </div>
                  <ProgressBar value={a.progress_pct} className="mt-2" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {list.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2"
                      >
                        <span className="truncate text-[12.5px] font-medium">{s.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[12px] text-muted-foreground">{s.progress_pct}%</span>
                          <Button
                            size="sm"
                            variant={s.status === "Complete" ? "ghost" : "secondary"}
                            onClick={() =>
                              updateSurface.mutate({
                                id: s.id,
                                patch:
                                  s.status === "Complete"
                                    ? { status: "Working", progress_pct: 50 }
                                    : { status: "Complete", progress_pct: 100 },
                              })
                            }
                          >
                            <CheckCircle2 className="size-3.5" />
                            {s.status === "Complete" ? "Done" : "Mark done"}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {list.length === 0 ? (
                      <span className="text-[12.5px] text-muted-foreground">No surfaces yet.</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {areaList.length === 0 ? <EmptyState title="No areas yet" /> : null}
          </SectionCard>

          <SectionCard
            title="Open field items"
            badge={<Chip tone="amber">{open.length} open</Chip>}
            actions={
              <Button size="sm" variant="primary" onClick={() => setCreate("Issue")}>
                <Plus className="size-4" /> Add field issue
              </Button>
            }
          >
            {open.length === 0 ? (
              <EmptyState title="Nothing open in the field" note="New issues, questions and tasks appear here." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Item</Th>
                    <Th>Owner</Th>
                    <Th>Waiting on</Th>
                    <Th>Next action</Th>
                    <Th className="text-right">Resolve</Th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <Td>
                        <Chip tone={workItemTone(i.item_type)}>{i.item_type}</Chip>
                      </Td>
                      <Td>
                        <div className="font-semibold">{i.title}</div>
                        {i.description ? (
                          <div className="text-muted-foreground">{i.description}</div>
                        ) : null}
                      </Td>
                      <Td>{i.owner ?? "—"}</Td>
                      <Td>{i.waiting_on ?? "—"}</Td>
                      <Td>{i.next_action ?? "—"}</Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateItem.mutate({
                              id: i.id,
                              patch: { status: "Complete", completed_at: new Date().toISOString() },
                            })
                          }
                        >
                          Resolve
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Today's site visit"
            subtitle="Check off what the crew actually completed."
            bodyClassName="space-y-2.5 px-5 pb-5"
          >
            {checklist.map((c) => (
              <Checkbox
                key={c.id}
                checked={c.done}
                strike
                label={c.label}
                onChange={(next) => updateChecklist.mutate({ id: c.id, patch: { done: next } })}
              />
            ))}
            {checklist.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No visit items for this project yet.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Log from the field" bodyClassName="space-y-2 px-5 pb-5">
            {(["Field Update", "Task", "Question", "Material Need"] as WorkItemKind[]).map((k) => (
              <Button key={k} className="w-full justify-start" onClick={() => setCreate(k)}>
                <MessageSquarePlus className="size-4" /> {k}
              </Button>
            ))}
          </SectionCard>
        </div>
      </div>

      {create ? (
        <CreateWorkItemModal
          open
          onClose={() => setCreate(null)}
          kind={create}
          projectId={projectId}
        />
      ) : null}
    </>
  );
}
