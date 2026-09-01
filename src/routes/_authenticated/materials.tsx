import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronRight,
  Hourglass,
  PackagePlus,
  ShoppingCart,
  Truck,
  Upload,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  Button,
  EmptyState,
  InfoBanner,
  KpiCard,
  SectionCard,
  Table,
  Td,
  Th,
  UnderlineTabs,
} from "@/components/kit";
import {
  CreatePoModal,
  MaterialDetailModal,
  ReceiveMaterialModal,
} from "@/components/MaterialDialogs";
import { Chip, materialTone } from "@/lib/status";
import {
  useMaterialItems,
  useProjects,
  usePurchaseOrders,
  useReceipts,
  useUpdateRow,
  type MaterialItem,
} from "@/lib/data";

const TABS = [
  { value: "needs", label: "Needs Attention" },
  { value: "install", label: "Install Materials" },
  { value: "finish", label: "Tiles & Finishes (linked)" },
  { value: "grout", label: "Grout & Metals (linked)" },
  { value: "receiving", label: "Receiving" },
];

type Search = { tab: string };

export const Route = createFileRoute("/_authenticated/materials")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tab:
      typeof search["tab"] === "string" && TABS.some((t) => t.value === search["tab"])
        ? (search["tab"] as string)
        : "needs",
  }),
  head: () => ({
    meta: [
      { title: "Install Materials — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Track finish tile, grout, metals and installation materials, purchase orders and receiving.",
      },
      { property: "og:title", content: "Install Materials — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Finish and installation materials, purchase orders and receiving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { data: materials = [], isLoading } = useMaterialItems();
  const { data: projects = [] } = useProjects();
  const { data: pos = [] } = usePurchaseOrders();
  const { data: receipts = [] } = useReceipts();
  const updateMaterial = useUpdateRow("material_items");

  const [poOpen, setPoOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [detail, setDetail] = useState<MaterialItem | null>(null);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";
  const attention = materials.filter((m) => m.needs_attention);

  const byCategory = (cat: string) => materials.filter((m) => m.category === cat);
  const finish = byCategory("Finish Tile");
  const grout = byCategory("Grout & Metals");
  const install = byCategory("Installation Materials");

  const kpi = {
    toOrder: materials.filter((m) => ["To Order", "Needed"].includes(m.status)).length,
    waiting: materials.filter((m) => ["Ordered", "Expected"].includes(m.status)).length,
    partial: materials.filter((m) => m.status === "Partially Received").length,
    action: attention.length,
  };

  const setTab = (value: string) => navigate({ to: "/materials", search: { tab: value } });

  return (
    <>
      <AppHeader crumbs={[{ label: "Install Materials" }]} />
      <div className="mx-auto max-w-7xl mx-auto px-8 pt-7 pb-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] leading-tight font-bold tracking-[-0.02em]">Install Materials</h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Cobblestone installation supplies — thinset, mortar, primer, membrane, leveling and consumables. Tile, grout and metal selections live on the project under Tiles & Finishes and are linked here.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button onClick={() => setReceiveOpen(true)}>
              <Upload className="size-4" /> Receive Material
            </Button>
            <Button variant="primary" onClick={() => setPoOpen(true)}>
              <PackagePlus className="size-4" /> Create PO
            </Button>
          </div>
        </div>

        <UnderlineTabs
          className="mt-6"
          items={TABS.map((t) =>
            t.value === "needs" ? { ...t, count: attention.length } : t,
          )}
          value={tab}
          onChange={setTab}
        />

        {tab === "needs" ? (
          <div className="mt-6 space-y-5">
            <InfoBanner>
              <strong className="font-semibold text-foreground">
                Cobblestone usually supplies installation materials.
              </strong>{" "}
              Finish tile, grout and metal may be supplied by the tile store or vendor but are linked
              to job areas and tracked here so nothing is missed.
            </InfoBanner>

            <SectionCard
              title="Needs Attention"
              subtitle="Materials that need action to keep projects on track."
              badge={
                <span className="grid size-5 place-items-center rounded-full bg-danger text-[11px] font-bold text-primary-foreground">
                  {attention.length}
                </span>
              }
              actions={
                <Button size="sm" onClick={() => setReceiveOpen(true)}>
                  Receive against a line
                </Button>
              }
            >
              <MaterialTable
                items={attention.filter((m) => m.category === "Installation Materials" || true)}
                projectName={projectName}
                onOpen={setDetail}
                loading={isLoading}
                variant="attention"
              />
            </SectionCard>

            <SectionCard
              title="Linked Tile, Grout &amp; Metal"
              subtitle="Finish materials are linked to job areas and tracked, even when supplied by the tile store or vendor."
            >
              <MaterialTable
                items={[...finish, ...grout]}
                projectName={projectName}
                onOpen={setDetail}
                loading={isLoading}
                variant="linked"
              />
            </SectionCard>
          </div>
        ) : null}

        {tab !== "needs" && tab !== "receiving" ? (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-4 gap-4">
              <KpiCard
                icon={<ShoppingCart className="size-5" />}
                tone="blue"
                label="To Order"
                value={kpi.toOrder}
                hint="Items not yet ordered"
              />
              <KpiCard
                icon={<Hourglass className="size-5" />}
                tone="amber"
                label="Waiting on Supplier"
                value={kpi.waiting}
                hint="On order, not received"
              />
              <KpiCard
                icon={<Truck className="size-5" />}
                tone="green"
                label="Partially Received"
                value={kpi.partial}
                hint="Some materials outstanding"
              />
              <KpiCard
                icon={<AlertTriangle className="size-5" />}
                tone="red"
                label="Needs Action"
                value={kpi.action}
                hint="Follow up or reorder"
              />
            </div>

            <SectionCard>
              <MaterialTable
                items={tab === "finish" ? finish : tab === "grout" ? grout : install}
                projectName={projectName}
                onOpen={setDetail}
                loading={isLoading}
                variant="full"
                onCreatePo={() => setPoOpen(true)}
              />
            </SectionCard>
          </div>
        ) : null}

        {tab === "receiving" ? (
          <div className="mt-6 space-y-5">
            <SectionCard
              title="Purchase Orders"
              subtitle="POs are separate records. Receiving never overwrites history."
              actions={
                <Button size="sm" variant="primary" onClick={() => setPoOpen(true)}>
                  Create PO
                </Button>
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>PO</Th>
                    <Th>Supplier</Th>
                    <Th>Project</Th>
                    <Th>Expected</Th>
                    <Th>Status</Th>
                    <Th className="w-40">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/40">
                      <Td className="font-semibold">{po.po_number}</Td>
                      <Td>{po.supplier}</Td>
                      <Td>
                        {po.project_id ? (
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: po.project_id }}
                            className="font-semibold text-primary hover:underline"
                          >
                            {projectName(po.project_id)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-muted-foreground">{po.expected_date ?? "—"}</Td>
                      <Td>
                        <Chip tone={materialTone(po.status)}>{po.status}</Chip>
                      </Td>
                      <Td>
                        <Button size="sm" onClick={() => setReceiveOpen(true)}>
                          Receive
                        </Button>
                      </Td>
                    </tr>
                  ))}
                  {pos.length === 0 ? (
                    <tr>
                      <Td colSpan={6}>
                        <EmptyState
                          title="No purchase orders yet"
                          note="Create a PO to link material requirements to a supplier."
                        />
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </SectionCard>

            <SectionCard
              title="Receipt history"
              subtitle="Append-only. Every delivery is kept."
              actions={
                <Button size="sm" onClick={() => setReceiveOpen(true)}>
                  <Upload className="size-4" /> Receive Material
                </Button>
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Material</Th>
                    <Th>Received</Th>
                    <Th>Damaged / Wrong</Th>
                    <Th>Packing slip</Th>
                    <Th>Notes</Th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => {
                    const m = materials.find((i) => i.id === r.material_item_id);
                    return (
                      <tr key={r.id}>
                        <Td className="whitespace-nowrap text-muted-foreground">{r.receipt_date}</Td>
                        <Td className="font-semibold">{m?.name ?? "Material"}</Td>
                        <Td>{r.received_qty}</Td>
                        <Td>
                          {r.damaged_qty || r.wrong_qty ? (
                            <Chip tone="red">
                              {r.damaged_qty} damaged · {r.wrong_qty} wrong
                            </Chip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td className="text-muted-foreground">{r.packing_slip ?? "—"}</Td>
                        <Td className="text-muted-foreground">{r.notes ?? "—"}</Td>
                      </tr>
                    );
                  })}
                  {receipts.length === 0 ? (
                    <tr>
                      <Td colSpan={6}>
                        <EmptyState title="No receipts recorded" />
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </SectionCard>
          </div>
        ) : null}

        <p className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span aria-hidden>ⓘ</span> Questions? Contact your Cobblestone Office.
        </p>
      </div>

      <CreatePoModal open={poOpen} onClose={() => setPoOpen(false)} />
      <ReceiveMaterialModal open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <MaterialDetailModal item={detail} onClose={() => setDetail(null)} />
      {updateMaterial.isPending ? null : null}
    </>
  );
}

function MaterialTable({
  items,
  projectName,
  onOpen,
  loading,
  variant,
  onCreatePo,
}: {
  items: MaterialItem[];
  projectName: (id: string) => string;
  onOpen: (item: MaterialItem) => void;
  loading: boolean;
  variant: "attention" | "linked" | "full";
  onCreatePo?: () => void;
}) {
  if (loading) {
    return <div className="px-5 py-6 text-[13px] text-muted-foreground">Loading materials…</div>;
  }
  if (items.length === 0) {
    return <EmptyState title="Nothing here yet" note="Material lines will appear as jobs are set up." />;
  }

  if (variant === "full") {
    return (
      <Table>
        <thead>
          <tr>
            <Th>Item</Th>
            <Th>Category</Th>
            <Th>Goes To</Th>
            <Th>Supplier / Responsibility</Th>
            <Th className="text-center">Ordered</Th>
            <Th>Received</Th>
            <Th>Missing</Th>
            <Th>Status</Th>
            <Th>Next Step</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const missing = Math.max(0, Number(m.required_qty ?? 0) - Number(m.received_qty ?? 0));
            return (
              <tr key={m.id} className="hover:bg-muted/40">
                <Td className="font-semibold">{m.name}</Td>
                <Td>
                  <Chip tone={m.category === "Finish Tile" ? "blue" : m.category === "Grout & Metals" ? "violet" : "green"}>
                    {m.category}
                  </Chip>
                </Td>
                <Td className="text-secondary-foreground">{m.goes_to ?? "—"}</Td>
                <Td className="text-secondary-foreground">{m.responsibility ?? m.supplier ?? "—"}</Td>
                <Td className="text-center">
                  {m.ordered_qty > 0 ? (
                    <span className="text-success">✓</span>
                  ) : (
                    <span className="text-muted-foreground">⊖</span>
                  )}
                </Td>
                <Td className="text-secondary-foreground">
                  {m.received_qty > 0
                    ? m.received_qty >= Number(m.required_qty ?? 0)
                      ? "Full"
                      : "Partial"
                    : "None"}
                </Td>
                <Td className="text-secondary-foreground">
                  {missing > 0 ? `${missing} ${m.unit ?? ""}` : "—"}
                </Td>
                <Td>
                  <Chip tone={materialTone(m.status)}>{m.status}</Chip>
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => (m.status === "To Order" && onCreatePo ? onCreatePo() : onOpen(m))}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                  >
                    {m.status === "To Order" ? "Create PO" : (m.next_step ?? "Update")}
                    <span aria-hidden>→</span>
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Project / Area</Th>
          <Th>Material / Item</Th>
          <Th>Type</Th>
          <Th>Status</Th>
          <Th>Source</Th>
          <Th>{variant === "attention" ? "Action Needed" : "Updated"}</Th>
          <Th className="w-10" />
        </tr>
      </thead>
      <tbody>
        {items.map((m) => (
          <tr key={m.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(m)}>
            <Td>
              <Link
                to="/projects/$projectId"
                params={{ projectId: m.project_id }}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-primary hover:underline"
              >
                {projectName(m.project_id)}
              </Link>
              <div className="text-[11.5px] text-muted-foreground">Area: {m.goes_to ?? "—"}</div>
            </Td>
            <Td>
              <div className="font-semibold">{m.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{m.spec ?? "—"}</div>
            </Td>
            <Td>
              <Chip tone={m.category === "Finish Tile" ? "blue" : m.category === "Grout & Metals" ? "violet" : "green"}>
                {m.category}
              </Chip>
            </Td>
            <Td>
              <Chip tone={materialTone(m.status)}>{m.status}</Chip>
            </Td>
            <Td className="text-secondary-foreground">
              {m.supplier ?? "—"}
              <div className="text-[11.5px] text-muted-foreground">{m.responsibility ?? ""}</div>
            </Td>
            <Td className="text-secondary-foreground">
              {variant === "attention"
                ? (m.next_step ?? "Review")
                : new Date(m.updated_at).toLocaleDateString()}
            </Td>
            <Td>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
