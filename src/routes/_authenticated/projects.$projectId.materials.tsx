import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, PackagePlus, Plus } from "lucide-react";
import { Button, EmptyState, KpiCard, SectionCard, Table, Td, Th } from "@/components/kit";
import { MaterialDetailModal, ReceiveMaterialModal } from "@/components/MaterialDialogs";
import { RequestMaterialModal } from "@/components/WorkItemDialogs";
import { Chip, materialTone } from "@/lib/status";
import { useMaterialItems, type MaterialItem } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/materials")({
  component: ProjectMaterials,
});

const READY = ["Ready", "Received"];

function ProjectMaterials() {
  const { projectId } = Route.useParams();
  const { data: items = [] } = useMaterialItems(projectId);
  const [request, setRequest] = useState(false);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<MaterialItem | null>(null);

  const finish = items.filter((i) => i.category !== "Installation Materials");
  const install = items.filter((i) => i.category === "Installation Materials");
  const ready = items.filter((i) => READY.includes(i.status)).length;
  const toOrder = items.filter((i) => ["Needed", "To Order"].includes(i.status)).length;
  const waiting = items.filter((i) => ["Ordered", "Expected"].includes(i.status)).length;
  const attention = items.filter((i) =>
    ["Short", "Wrong", "Damaged", "Partially Received"].includes(i.status),
  ).length;

  const renderTable = (list: MaterialItem[], title: string) => (
    <SectionCard
      title={title}
      icon={<Package className="size-[18px] text-primary" />}
      badge={<Chip>{list.length}</Chip>}
    >
      {list.length === 0 ? (
        <EmptyState title="Nothing here yet" note="Requested material appears here immediately." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Goes to</Th>
              <Th>Supplier</Th>
              <Th className="text-right">Req.</Th>
              <Th className="text-right">Ord.</Th>
              <Th className="text-right">Rec.</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <Td>
                  <button
                    type="button"
                    onClick={() => setDetailFor(m)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {m.name}
                  </button>
                  {m.spec ? <div className="text-muted-foreground">{m.spec}</div> : null}
                </Td>
                <Td>{m.goes_to ?? "—"}</Td>
                <Td>{m.supplier ?? "—"}</Td>
                <Td className="text-right">
                  {m.required_qty ?? "—"} {m.unit}
                </Td>
                <Td className="text-right">{m.ordered_qty}</Td>
                <Td className="text-right">{m.received_qty}</Td>
                <Td>
                  <Chip tone={materialTone(m.status)}>{m.status}</Chip>
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    onClick={() => {
                      setReceiveId(m.id);
                      setReceiveOpen(true);
                    }}
                  >
                    Receive
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={<Package className="size-5" />} tone="amber" label="To Order" value={toOrder} />
        <KpiCard
          icon={<Package className="size-5" />}
          tone="blue"
          label="Waiting on Supplier"
          value={waiting}
        />
        <KpiCard
          icon={<Package className="size-5" />}
          tone="blue"
          label="Needs Action"
          value={attention}
        />
        <KpiCard icon={<Package className="size-5" />} tone="green" label="Ready" value={ready} />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button onClick={() => setRequest(true)}>
          <Plus className="size-4" /> Request material
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setReceiveId(null);
            setReceiveOpen(true);
          }}
          disabled={items.length === 0}
          {...(items.length === 0 ? { disabledReason: "No material lines yet" } : {})}
        >
          <PackagePlus className="size-4" /> Receive material
        </Button>
      </div>

      <div className="mt-4 space-y-5">
        {renderTable(finish, "Finish materials")}
        {renderTable(install, "Installation materials")}
      </div>

      <RequestMaterialModal open={request} onClose={() => setRequest(false)} projectId={projectId} />
      <ReceiveMaterialModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        {...(receiveId ? { presetItemId: receiveId } : {})}
      />
      {detailFor ? (
        <MaterialDetailModal item={detailFor} onClose={() => setDetailFor(null)} />
      ) : null}
    </>
  );
}
