import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Plus } from "lucide-react";
import { Button, EmptyState, SectionCard, Table, Td, Th } from "@/components/kit";
import { RequestMaterialModal } from "@/components/WorkItemDialogs";
import { Chip, materialTone } from "@/lib/status";
import { useMaterialItems } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/install-materials")({
  component: InstallMaterials,
});

/**
 * Install Materials — thinset, mortar, primer, membrane, mud and consumables.
 * Kept deliberately separate from Tiles & Finishes and from Deliveries.
 */
function InstallMaterials() {
  const { projectId } = Route.useParams();
  const { data: items = [] } = useMaterialItems(projectId);
  const [request, setRequest] = useState(false);
  const install = items.filter((i) => i.category === "Installation Materials");

  return (
    <>
      <SectionCard
        title="Install materials"
        icon={<Boxes className="size-[18px] text-primary" />}
        subtitle="Consumables the crew needs on site — not finish material."
        badge={<Chip>{install.length}</Chip>}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setRequest(true)}>
            <Plus className="size-4" /> Request material
          </Button>
        }
      >
        {install.length === 0 ? (
          <EmptyState
            title="Nothing requested yet"
            note="Requested consumables appear here right away."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Spec</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Required</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Received</Th>
                <Th>Status</Th>
                <Th>Next step</Th>
              </tr>
            </thead>
            <tbody>
              {install.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <Td className="font-semibold">{i.name}</Td>
                  <Td>{i.spec ?? "—"}</Td>
                  <Td>{i.supplier ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{i.required_qty ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{i.ordered_qty}</Td>
                  <Td className="text-right tabular-nums">{i.received_qty}</Td>
                  <Td>
                    <Chip tone={materialTone(i.status)}>{i.status}</Chip>
                  </Td>
                  <Td>{i.next_step ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <RequestMaterialModal
        open={request}
        onClose={() => setRequest(false)}
        projectId={projectId}
      />
    </>
  );
}
