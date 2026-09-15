import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { History, Printer, Upload } from "lucide-react";
import { Button, EmptyState, SectionCard, TextInput } from "@/components/kit";
import { Chip } from "@/lib/status";
import { useProjectSetup } from "@/lib/setup";
import { buildSnapshot, isPackageOutdated, usePublishPackage } from "@/lib/packages";
import { useCanEditProject, useMyProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/projects/$projectId/package")({
  component: InstallerPackages,
});

function InstallerPackages() {
  const { projectId } = Route.useParams();
  const setup = useProjectSetup(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const { data: profile } = useMyProfile();
  const publish = usePublishPackage(projectId);
  const [note, setNote] = useState<Record<string, string>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  if (setup.loading) {
    return <div className="text-sm text-muted-foreground">Loading packages…</div>;
  }
  if (setup.areaList.length === 0) {
    return <EmptyState title="No rooms yet" note="Create rooms and surfaces before publishing." />;
  }

  const lastSpecChange =
    [...setup.assignmentList, ...setup.selectionList]
      .map((r) => (r as unknown as { updated_at?: string }).updated_at ?? "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return (
    <div className="space-y-4">
      {setup.areaList.map((area) => {
        const pkg = setup.packageList.find((p) => p.area_id === area.id) ?? null;
        const revs = setup.revisionList
          .filter((r) => pkg && r.package_id === pkg.id)
          .sort((a, b) => b.revision_no - a.revision_no);
        const snapshot = buildSnapshot({
          area,
          surfaces: setup.surfaceList,
          zones: setup.zoneList,
          assignments: setup.assignmentList,
          selections: setup.selectionList,
        });
        const outdated = pkg ? isPackageOutdated({ pkg, revisions: setup.revisionList, lastSpecChange }) : true;

        return (
          <SectionCard
            key={area.id}
            title={`${area.name} — installer package`}
            badge={
              !pkg || pkg.current_revision_no === 0 ? (
                <Chip tone="amber">Not published</Chip>
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
                <Button onClick={() => window.print()}>
                  <Printer className="size-4" /> Print
                </Button>
                {revs.length > 0 ? (
                  <Button onClick={() => setOpenHistory((v) => (v === area.id ? null : area.id))}>
                    <History className="size-4" /> {revs.length} revision(s)
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[860px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3">Surface</th>
                    <th className="py-2 pr-3">Zone</th>
                    <th className="py-2 pr-3">Tile</th>
                    <th className="py-2 pr-3">Grout / joint</th>
                    <th className="py-2 pr-3">Edge</th>
                    <th className="py-2 pr-3">Layout</th>
                    <th className="py-2 pr-3">Height</th>
                    <th className="py-2">Prep</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-semibold">{r.surface}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.zone}</td>
                      <td className="py-2 pr-3">
                        {r.tile}
                        <span className="block text-[11px] text-muted-foreground">
                          {r.manufacturer} · {r.sku} · {r.size}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {r.grout}
                        <span className="block text-[11px] text-muted-foreground">{r.joint}</span>
                      </td>
                      <td className="py-2 pr-3">{r.edge}</td>
                      <td className="py-2 pr-3">
                        {r.pattern}
                        <span className="block text-[11px] text-muted-foreground">
                          {r.direction} · from {r.start}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{r.height}</td>
                      <td className="py-2">
                        {r.prep}
                        <span className="block text-[11px] text-muted-foreground">
                          {r.waterproofing}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {snapshot.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-muted-foreground">
                        No surfaces in this room yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
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
        );
      })}
    </div>
  );
}
