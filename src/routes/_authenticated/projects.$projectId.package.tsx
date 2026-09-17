import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Printer, Upload } from "lucide-react";
import { Button, EmptyState, SectionCard, TextInput } from "@/components/kit";
import { PrintRoomSheet, type RoomSheetInput } from "@/components/PrintRoomSheet";
import { Chip } from "@/lib/status";
import { useProjectSetup } from "@/lib/setup";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/data";
import { buildSnapshot, isPackageOutdated, usePublishPackage, type PackageSnapshot } from "@/lib/packages";
import { useCanEditProject, useMyProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/projects/$projectId/package")({
  head: () => ({
    meta: [
      { title: "Installer Package — Cobblestone Tile OS" },
      { name: "description", content: "Review and publish the installer-ready room sheet for each room." },
      { property: "og:title", content: "Installer Package — Cobblestone Tile OS" },
      { property: "og:description", content: "Publish immutable installer package revisions per room." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstallerPackages,
});

/** Photos attached to this project, grouped by room, for the printed sheet. */
function useRoomPhotos(projectId: string) {
  return useQuery({
    queryKey: ["project_photo_files", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_files")
        .select("id,area_id,storage_path,caption,mime_type,kind")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []).filter((f) => (f.mime_type ?? "").startsWith("image/") || f.kind === "photo");
    },
  });
}

function InstallerPackages() {
  const { projectId } = Route.useParams();
  const setup = useProjectSetup(projectId);
  const { data: project } = useProject(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const { data: profile } = useMyProfile();
  const { data: photoFiles = [] } = useRoomPhotos(projectId);
  const publish = usePublishPackage(projectId);
  const [note, setNote] = useState<Record<string, string>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [printAreaId, setPrintAreaId] = useState<string | null>(null);

  const lastSpecChange =
    [...setup.assignmentList, ...setup.selectionList]
      .map((r) => (r as unknown as { updated_at?: string }).updated_at ?? "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const rooms = useMemo(
    () =>
      setup.areaList.map((area) => {
        const pkg = setup.packageList.find((p) => p.area_id === area.id) ?? null;
        const revs = setup.revisionList
          .filter((r) => pkg && r.package_id === pkg.id)
          .sort((a, b) => b.revision_no - a.revision_no);
        return {
          area,
          pkg,
          revs,
          snapshot: buildSnapshot({
            area,
            surfaces: setup.surfaceList,
            zones: setup.zoneList,
            assignments: setup.assignmentList,
            selections: setup.selectionList,
          }),
          outdated: pkg ? isPackageOutdated({ pkg, revisions: setup.revisionList, lastSpecChange }) : true,
        };
      }),
    [setup.areaList, setup.packageList, setup.revisionList, setup.surfaceList, setup.zoneList, setup.assignmentList, setup.selectionList, lastSpecChange],
  );

  const sheets: RoomSheetInput[] = rooms
    .filter((room) => !printAreaId || room.area.id === printAreaId)
    .map((room) => {
      const latest = room.revs[0] ?? null;
      /** Print the published revision when there is one; otherwise the live draft. */
      const snapshot: PackageSnapshot = latest ? latest.snapshot : room.snapshot;
      return {
        projectName: project?.name ?? "Project",
        projectAddress: project?.address ?? null,
        snapshot: { ...snapshot, room: room.area.name },
        revisionLabel: latest ? `Revision ${latest.revision_no}` : "Draft — unpublished",
        publishedBy: latest?.published_by_name ?? null,
        publishedAt: latest?.published_at ?? null,
        photoPaths: photoFiles
          .filter((f) => f.area_id === room.area.id)
          .map((f) => ({ path: f.storage_path, caption: f.caption ?? null })),
      };
    });

  const printRoom = (areaId: string | null) => {
    setPrintAreaId(areaId);
    // Let the sheet render with the right room before the print dialog opens.
    window.setTimeout(() => window.print(), 60);
  };

  if (setup.loading) {
    return <div className="print-hide text-sm text-muted-foreground">Loading packages…</div>;
  }
  if (setup.areaList.length === 0) {
    return (
      <div className="print-hide">
        <EmptyState title="No rooms yet" note="Create rooms and surfaces before publishing." />
      </div>
    );
  }

  return (
    <>
      <div className="print-hide space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-[13px] text-muted-foreground">
            Every sheet is built from the room, surface, finish and design records — publishing freezes an
            immutable revision.
          </p>
          <Button onClick={() => printRoom(null)}>
            <Printer className="size-4" /> Print all rooms
          </Button>
        </div>

        {rooms.map(({ area, pkg, revs, snapshot, outdated }) => (
          <SectionCard
            key={area.id}
            title={`${area.name} — installer package`}
            badge={
              !pkg || pkg.current_revision_no === 0 ? (
                <Chip tone="amber">Draft</Chip>
              ) : outdated ? (
                <Chip tone="amber">Rev {pkg.current_revision_no} · spec changed since</Chip>
              ) : (
                <Chip tone="green">Rev {pkg.current_revision_no} published</Chip>
              )
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  value={note[area.id] ?? ""}
                  onChange={(e) => setNote((n) => ({ ...n, [area.id]: e.target.value }))}
                  placeholder="What changed?"
                  className="h-9 w-[180px]"
                />
                <Button
                  variant="primary"
                  disabled={!canEdit || publish.isPending}
                  onClick={() =>
                    publish
                      .mutateAsync({
                        area,
                        snapshot,
                        publishedByName: profile?.full_name ?? null,
                        changeNote: note[area.id] ?? "",
                      })
                      .then((rev) => {
                        setNote((n) => ({ ...n, [area.id]: "" }));
                        toast.success(`Published revision ${rev}`);
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not publish"))
                  }
                >
                  <Upload className="size-4" />
                  {pkg && pkg.current_revision_no > 0
                    ? `Publish rev ${pkg.current_revision_no + 1}`
                    : "Publish rev 1"}
                </Button>
                <Button onClick={() => printRoom(area.id)}>
                  <Printer className="size-4" /> Print room sheet
                </Button>
                {revs.length > 0 ? (
                  <Button onClick={() => setOpenHistory((v) => (v === area.id ? null : area.id))}>
                    <History className="size-4" /> {revs.length} revision(s)
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="space-y-3 px-5 pb-5">
              {snapshot.rows.map((r, i) => (
                <article key={i} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[14px] font-bold">{r.surface}</h3>
                    <span className="text-xs font-semibold text-muted-foreground">{r.zone}</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <PackageFact label="Tile" value={r.tile} detail={`${r.manufacturer} · ${r.sku} · ${r.size}`} />
                    <PackageFact label="Actual dimension" value={r.actual_size ?? "—"} detail={r.tile_finish ?? "—"} />
                    <PackageFact label="Grout / joint" value={r.grout} detail={r.joint} />
                    <PackageFact label="Layout" value={r.pattern} detail={`${r.direction} · from ${r.start}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2 text-xs">
                    <span>
                      <b>Edge</b> · {r.edge}
                    </span>
                    <span>
                      <b>Height</b> · {r.height}
                    </span>
                    <span>
                      <b>Transition</b> · {r.transition}
                    </span>
                    <span>
                      <b>Features</b> · {r.features ?? "—"}
                    </span>
                    <span>
                      <b>Prep</b> · {r.prep}
                    </span>
                    <span>
                      <b>Waterproofing</b> · {r.waterproofing}
                    </span>
                  </div>
                </article>
              ))}
              {snapshot.rows.length === 0 ? (
                <p className="py-4 text-[13px] text-muted-foreground">No surfaces in this room yet.</p>
              ) : null}
            </div>

            {openHistory === area.id ? (
              <div className="border-t border-border bg-muted/30 px-5 py-3">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Revision history
                </div>
                <ul className="mt-2 space-y-1.5">
                  {revs.map((r) => (
                    <li key={r.id} className="text-[12.5px]">
                      <span className="font-semibold">Rev {r.revision_no}</span>
                      <span className="ml-2 text-muted-foreground">
                        {new Date(r.published_at).toLocaleString()}
                        {r.published_by_name ? ` · ${r.published_by_name}` : ""}
                        {r.change_note ? ` · ${r.change_note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SectionCard>
        ))}
      </div>

      <PrintRoomSheet sheets={sheets} />
    </>
  );
}

function PackageFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
      {detail ? <div className="text-[11.5px] text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
