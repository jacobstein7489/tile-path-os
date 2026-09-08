import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { EmptyState, SectionCard, Table, Td, Th } from "@/components/kit";
import { Chip } from "@/lib/status";
import { useAreasWithSurfaces } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/tiles")({
  component: TilesAndFinishes,
});

/**
 * Tiles & Finishes — the finish selections tied to each area and surface:
 * tile, grout, metals, saddles. Distinct from Install Materials (consumables)
 * and from Deliveries (receiving).
 */
function TilesAndFinishes() {
  const { projectId } = Route.useParams();
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];

  return (
    <div className="space-y-5">
      {areaList.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          note="Add rooms and surfaces first — finish selections hang off them."
        />
      ) : null}

      {areaList.map((area) => {
        const list = surfaceList.filter((s) => s.area_id === area.id);
        return (
          <SectionCard
            key={area.id}
            title={area.name}
            icon={<Layers className="size-[18px] text-primary" />}
            subtitle="Finish selections for each surface in this room."
            badge={<Chip>{list.length} {list.length === 1 ? "surface" : "surfaces"}</Chip>}
          >
            {list.length === 0 ? (
              <EmptyState
                title="No surfaces in this room"
                note="Surfaces are added on the Rooms tab."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Surface</Th>
                    <Th>Tile</Th>
                    <Th>Size / finish</Th>
                    <Th>Manufacturer</Th>
                    <Th>Grout</Th>
                    <Th>Metal / trim</Th>
                    <Th>Layout</Th>
                    <Th>Confirmed</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <Td className="font-semibold">{s.name}</Td>
                      <Td>{s.tile_tag ?? s.tile_sku ?? "—"}</Td>
                      <Td>
                        {[s.tile_size, s.tile_finish].filter(Boolean).join(" · ") || "—"}
                      </Td>
                      <Td>{s.manufacturer ?? "—"}</Td>
                      <Td>
                        {[s.grout_color, s.joint_size].filter(Boolean).join(" · ") || "—"}
                      </Td>
                      <Td>{s.metal_profile ?? "—"}</Td>
                      <Td>
                        {[s.layout_pattern, s.layout_direction].filter(Boolean).join(" · ") || "—"}
                      </Td>
                      <Td>
                        {s.detail_confirmed ? (
                          <Chip tone="green">Confirmed</Chip>
                        ) : (
                          <Chip tone="amber">Needs review</Chip>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        );
      })}

      <p className="text-[12.5px] text-muted-foreground">
        Edit selections on the{" "}
        <Link
          to="/projects/$projectId/scope"
          params={{ projectId }}
          className="font-medium text-primary hover:underline"
        >
          Rooms
        </Link>{" "}
        tab, surface by surface.
      </p>
    </div>
  );
}
