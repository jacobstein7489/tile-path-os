import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  PackageCheck,
  Search,
  Truck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/kit";
import { MaterialDetailModal, ReceiveMaterialModal } from "@/components/MaterialDialogs";
import {
  OpsCanvas,
  OpsPageHeader,
  OpsPlane,
  ObjectMark,
  OpsMeter,
  StatusPill,
} from "@/components/ops/PremiumOps";
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
        content: "Installation material lifecycle and receiving across active tile projects.",
      },
      { property: "og:title", content: "Install Materials — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Installation material lifecycle and receiving across active tile projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});
function matches(filter: Filter, m: MaterialItem) {
  if (filter === "Needs Action")
    return (
      m.needs_attention || ["Short", "Wrong", "Damaged", "Partially Received"].includes(m.status)
    );
  if (filter === "To Order") return ["Needed", "To Order"].includes(m.status);
  if (filter === "Waiting / Expected") return ["Ordered", "Expected"].includes(m.status);
  return ["Received", "Ready"].includes(m.status);
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
  const rows = useMemo(
    () =>
      install.filter(
        (m) =>
          matches(filter, m) &&
          (!search.trim() ||
            `${m.name} ${projectName(m.project_id)}`
              .toLowerCase()
              .includes(search.trim().toLowerCase())),
      ),
    [filter, install, search],
  );
  return (
    <OpsCanvas>
      <OpsPageHeader
        eyebrow="Installation material lifecycle"
        title="Materials"
        summary="Needs, orders, delivery exceptions and site readiness across active jobs."
        action={
          <Button variant="primary" onClick={() => setReceiveOpen(true)}>
            <Upload className="size-4" />
            Receive
          </Button>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {FILTERS.map((item) => {
            const count = install.filter((m) => matches(item, m)).length;
            const Icon =
              item === "Needs Action"
                ? AlertTriangle
                : item === "To Order"
                  ? Boxes
                  : item === "Waiting / Expected"
                    ? Truck
                    : PackageCheck;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border px-3 text-left",
                  filter === item
                    ? "border-primary/30 bg-primary-soft shadow-[var(--shadow-card)]"
                    : "border-border bg-background/70",
                )}
              >
                <ObjectMark
                  tone={
                    item === "Needs Action"
                      ? "red"
                      : item === "Waiting / Expected"
                        ? "amber"
                        : item === "Received"
                          ? "green"
                          : "blue"
                  }
                >
                  <Icon className="size-4" />
                </ObjectMark>
                <span>
                  <strong className="block text-xl tabular-nums">{count}</strong>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {item}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex h-9 max-w-lg items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
            placeholder="Search material or project"
          />
        </label>
      </OpsPageHeader>
      <OpsPlane className="mt-4 p-2 sm:p-3">
        {isLoading ? (
          <Quiet>Loading materials…</Quiet>
        ) : rows.length ? (
          rows.map((m) => {
            const required = Number(m.required_qty ?? 0);
            const received = Number(m.received_qty ?? 0);
            const pct = required ? Math.round((received / required) * 100) : 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setDetail(m)}
                className="group mb-2 grid min-h-[96px] w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-left last:mb-0 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-[var(--shadow-card)]"
              >
                <ObjectMark tone={m.needs_attention ? "amber" : "blue"}>
                  <Boxes className="size-5" />
                </ObjectMark>
                <span className="grid min-w-0 gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(160px,.7fr)_minmax(220px,1fr)] md:items-center">
                  <span className="min-w-0">
                    <strong className="block truncate text-[16px]">{m.name}</strong>
                    <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                      {projectName(m.project_id)} · {m.spec ?? "Specification pending"}
                    </span>
                    <StatusPill
                      tone={
                        m.needs_attention
                          ? "amber"
                          : ["Ready", "Received"].includes(m.status)
                            ? "green"
                            : "blue"
                      }
                    >
                      {m.status}
                    </StatusPill>
                  </span>
                  <OpsMeter
                    label={`${received} of ${required || "—"} ${m.unit ?? ""} received`}
                    value={pct}
                    tone={pct >= 100 ? "green" : "blue"}
                  />
                  <span>
                    <span className="ops-eyebrow">Next action</span>
                    <strong className="mt-1 block text-[13px]">
                      {m.next_step ?? "Review with supplier"}
                    </strong>
                    {m.expected_date ? (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        Expected {m.expected_date}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
              </button>
            );
          })
        ) : (
          <Quiet>Nothing in this view.</Quiet>
        )}
      </OpsPlane>
      <ReceiveMaterialModal open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      {detail ? <MaterialDetailModal item={detail} onClose={() => setDetail(null)} /> : null}
    </OpsCanvas>
  );
}
function Quiet({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-14 text-center text-sm text-muted-foreground">{children}</div>;
}
