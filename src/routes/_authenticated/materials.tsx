import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Button, EmptyState, FilterGroup, SearchInput, Table, Td, Th } from "@/components/kit";
import { PageShell } from "@/components/PageShell";
import { MaterialDetailModal, ReceiveMaterialModal } from "@/components/MaterialDialogs";
import { Chip, materialTone } from "@/lib/status";
import { useMaterialItems, useProjects, type MaterialItem } from "@/lib/data";
import { cn } from "@/lib/utils";

const FILTERS = ["Needs Action", "To Order", "Waiting / Expected", "Received"] as const;
type Filter = (typeof FILTERS)[number];

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Install Materials — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "A cross-project action board for installation supplies: what needs ordering, what we are waiting on and what has landed.",
      },
      { property: "og:title", content: "Install Materials — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Which installation material needs attention across all tile jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});

function matches(filter: Filter, m: MaterialItem) {
  switch (filter) {
    case "Needs Action":
      return (
        m.needs_attention ||
        ["Short", "Wrong", "Damaged", "Partially Received"].includes(m.status)
      );
    case "To Order":
      return ["Needed", "To Order"].includes(m.status);
    case "Waiting / Expected":
      return ["Ordered", "Expected"].includes(m.status);
    case "Received":
      return ["Received", "Ready"].includes(m.status);
  }
}

function MaterialsPage() {
  const { data: materials = [], isLoading } = useMaterialItems();
  const { data: projects = [] } = useProjects();
  const [filter, setFilter] = useState<Filter>("Needs Action");
  const [search, setSearch] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [detail, setDetail] = useState<MaterialItem | null>(null);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";
  const install = materials.filter((m) => m.category === "Installation Materials");
  const rows = install.filter(
    (m) =>
      matches(filter, m) &&
      (!search.trim() ||
        `${m.name} ${projectName(m.project_id)}`.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <PageShell
      crumbs={[{ label: "Install Materials" }]}
      title="Install Materials"
      subtitle="Cobblestone supplies across every job — thinset, mud, Portland, sand, primer, membrane. Tile, grout and metals live on each project under Tiles & Finishes."
      actions={
        <Button variant="primary" onClick={() => setReceiveOpen(true)}>
          <Upload className="size-4" /> Receive material
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          options={FILTERS.map((f) => ({
            value: f,
            label: f,
            count: install.filter((m) => matches(f, m)).length,
          }))}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
        <div className="ml-auto">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material or job"
            className="w-[220px]"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{filter}</h2>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {rows.length} of {install.length} lines
          </span>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-[13px] text-muted-foreground">Loading material…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing in this view"
            note="Material needs are requested on the project, then tracked here across all jobs."
          />
        ) : (
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[26%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead>
              <tr className="bg-muted/60">
                {["Project", "Material", "Need", "Status", "Needed By", "Next Action"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setDetail(m)}
                  className={cn(
                    "group cursor-pointer transition-colors duration-100 hover:bg-muted/50",
                    detail?.id === m.id && "bg-primary-soft/60",
                  )}
                >
                  <Td className="font-semibold group-last:border-0">
                    <span className="block break-words">{projectName(m.project_id)}</span>
                  </Td>
                  <Td className="group-last:border-0">
                    <span className="font-medium">{m.name}</span>
                    {m.spec ? (
                      <div className="text-[11.5px] text-muted-foreground">{m.spec}</div>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-secondary-foreground group-last:border-0">
                    {m.required_qty ?? "—"} {m.unit ?? ""}
                  </Td>
                  <Td className="group-last:border-0">
                    <Chip tone={materialTone(m.status)}>{m.status}</Chip>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
                    {m.expected_date
                      ? new Date(m.expected_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </Td>
                  <Td className="group-last:border-0">
                    <span className="font-medium text-foreground transition-colors duration-100 group-hover:text-primary">
                      {m.next_step ?? "Review with supplier"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <ReceiveMaterialModal open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      {detail ? (
        <MaterialDetailModal item={detail} onClose={() => setDetail(null)} />
      ) : null}
    </PageShell>
  );
}
