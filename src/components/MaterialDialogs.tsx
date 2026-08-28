import { useMemo, useState } from "react";
import { Button, Field, Modal, Select, Table, TextArea, TextInput, Td, Th } from "@/components/kit";
import {
  materialStatusFrom,
  useInsertRow,
  useMaterialItems,
  useProjects,
  usePurchaseOrders,
  useReceipts,
  useUpdateRow,
  type MaterialItem,
} from "@/lib/data";
import { Chip, materialTone } from "@/lib/status";

const PO_STATUSES = ["Draft", "Sent", "Confirmed", "Partially Received", "Closed", "Cancelled"];

/* ------------------------------ Create PO ------------------------------ */

export function CreatePoModal({
  open,
  onClose,
  presetItemId,
}: {
  open: boolean;
  onClose: () => void;
  presetItemId?: string;
}) {
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterialItems();
  const insertPo = useInsertRow("purchase_orders");
  const insertLine = useInsertRow("po_lines");
  const updateMaterial = useUpdateRow("material_items");

  const [form, setForm] = useState({
    supplier: "",
    project_id: "",
    status: "Draft",
    expected_date: "",
    notes: "",
  });
  const [lines, setLines] = useState<Record<string, string>>(
    presetItemId ? { [presetItemId]: "" } : {},
  );
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const candidates = useMemo(
    () => materials.filter((m) => !form.project_id || m.project_id === form.project_id),
    [materials, form.project_id],
  );
  const selected = Object.keys(lines);
  const valid = Boolean(form.supplier.trim() && selected.length > 0);

  const save = async () => {
    if (!valid) return;
    const po = (await insertPo.mutateAsync({
      po_number: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: form.supplier.trim(),
      project_id: form.project_id || null,
      status: form.status,
      expected_date: form.expected_date || null,
      notes: form.notes || null,
    })) as { id: string };

    for (const id of selected) {
      const item = materials.find((m) => m.id === id);
      if (!item) continue;
      const qty = Number(lines[id] || item.required_qty || 1);
      await insertLine.mutateAsync({
        po_id: po.id,
        material_item_id: id,
        description: `${item.name}${item.spec ? ` — ${item.spec}` : ""}`,
        qty,
        unit: item.unit,
      });
      if (form.status !== "Draft") {
        const nextOrdered = Number(item.ordered_qty || 0) + qty;
        await updateMaterial.mutateAsync({
          id,
          patch: {
            ordered_qty: nextOrdered,
            expected_date: form.expected_date || item.expected_date,
            status: materialStatusFrom({ ...item, ordered_qty: nextOrdered }),
            next_step: "Confirm delivery date",
          },
        });
      }
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create purchase order"
      subtitle="Links real material requirements to a supplier PO."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!valid || insertPo.isPending}
            {...(!valid ? { disabledReason: "Enter a supplier and select at least one material" } : {})}
          >
            Save PO
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Supplier">
          <TextInput
            value={form.supplier}
            onChange={(e) => set("supplier", e.target.value)}
            placeholder="Tile Store"
          />
        </Field>
        <Field label="Project">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {PO_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Expected date">
          <TextInput
            type="date"
            value={form.expected_date}
            onChange={(e) => set("expected_date", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Linked material requirements" hint="Quantity defaults to the required quantity.">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          <Table>
            <tbody>
              {candidates.map((m) => {
                const checked = m.id in lines;
                return (
                  <tr key={m.id}>
                    <Td className="w-9">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setLines((l) => {
                            const next = { ...l };
                            if (e.target.checked) next[m.id] = String(m.required_qty ?? 1);
                            else delete next[m.id];
                            return next;
                          })
                        }
                      />
                    </Td>
                    <Td>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{m.spec}</div>
                    </Td>
                    <Td className="w-28">
                      <TextInput
                        type="number"
                        disabled={!checked}
                        value={checked ? lines[m.id] : ""}
                        onChange={(e) => setLines((l) => ({ ...l, [m.id]: e.target.value }))}
                        className="h-8"
                      />
                    </Td>
                    <Td className="w-20 text-muted-foreground">{m.unit}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Field>

      <Field label="Notes">
        <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ------------------------------ Receive material ------------------------------ */

export function ReceiveMaterialModal({
  open,
  onClose,
  presetItemId,
}: {
  open: boolean;
  onClose: () => void;
  presetItemId?: string;
}) {
  const { data: materials = [] } = useMaterialItems();
  const { data: pos = [] } = usePurchaseOrders();
  const { data: receipts = [] } = useReceipts();
  const insertReceipt = useInsertRow("material_receipts");
  const updateMaterial = useUpdateRow("material_items");

  const [form, setForm] = useState({
    material_item_id: presetItemId ?? "",
    po_id: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    received_qty: "",
    damaged_qty: "0",
    wrong_qty: "0",
    packing_slip: "",
    notes: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const item = materials.find((m) => m.id === form.material_item_id);
  const history = receipts.filter((r) => r.material_item_id === form.material_item_id);
  const valid = Boolean(item && Number(form.received_qty) >= 0 && form.received_qty !== "");

  const save = async () => {
    if (!item) return;
    const received = Number(form.received_qty || 0);
    const damaged = Number(form.damaged_qty || 0);
    await insertReceipt.mutateAsync({
      material_item_id: item.id,
      po_id: form.po_id || null,
      receipt_date: form.receipt_date,
      received_qty: received,
      damaged_qty: damaged,
      wrong_qty: Number(form.wrong_qty || 0),
      packing_slip: form.packing_slip || null,
      notes: form.notes || null,
    });
    const nextGood = Number(item.received_qty || 0) + received;
    const nextDamaged = Number(item.damaged_qty || 0) + damaged;
    const patched = { ...item, received_qty: nextGood, damaged_qty: nextDamaged };
    const status = materialStatusFrom(patched);
    await updateMaterial.mutateAsync({
      id: item.id,
      patch: {
        received_qty: nextGood,
        damaged_qty: nextDamaged,
        status,
        needs_attention: status !== "Ready" && status !== "Received",
        next_step:
          status === "Ready" || status === "Received"
            ? "Ready for install"
            : "Follow up supplier for balance",
      },
    });
    onClose();
  };

  const missing = item
    ? Math.max(0, Number(item.required_qty ?? 0) - Number(item.received_qty ?? 0))
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive material"
      subtitle="Receipts are append-only — history is never overwritten."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!valid || insertReceipt.isPending}
            {...(!valid ? { disabledReason: "Select a material and enter a received quantity" } : {})}
          >
            Save receipt
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Material line">
          <Select
            value={form.material_item_id}
            onChange={(e) => set("material_item_id", e.target.value)}
          >
            <option value="">Select material…</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.spec ?? m.category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purchase order">
          <Select value={form.po_id} onChange={(e) => set("po_id", e.target.value)}>
            <option value="">No PO</option>
            {pos.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number} — {po.supplier}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Receipt date">
          <TextInput
            type="date"
            value={form.receipt_date}
            onChange={(e) => set("receipt_date", e.target.value)}
          />
        </Field>
        <Field label="Received quantity" hint={item ? `${missing} ${item.unit ?? ""} still missing` : undefined}>
          <TextInput
            type="number"
            value={form.received_qty}
            onChange={(e) => set("received_qty", e.target.value)}
          />
        </Field>
        <Field label="Damaged quantity">
          <TextInput
            type="number"
            value={form.damaged_qty}
            onChange={(e) => set("damaged_qty", e.target.value)}
          />
        </Field>
        <Field label="Wrong item quantity">
          <TextInput
            type="number"
            value={form.wrong_qty}
            onChange={(e) => set("wrong_qty", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Packing slip / photo reference">
        <TextInput
          value={form.packing_slip}
          onChange={(e) => set("packing_slip", e.target.value)}
          placeholder="Slip #, photo link or file name"
        />
      </Field>
      <Field label="Notes">
        <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      {form.material_item_id ? (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-2.5 text-[12.5px] font-semibold">
            Receipt history ({history.length})
          </div>
          <Table>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <Td className="w-28 text-muted-foreground">{r.receipt_date}</Td>
                  <Td>
                    +{r.received_qty} received
                    {r.damaged_qty ? `, ${r.damaged_qty} damaged` : ""}
                    {r.wrong_qty ? `, ${r.wrong_qty} wrong` : ""}
                  </Td>
                  <Td className="text-muted-foreground">{r.notes}</Td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <Td className="text-muted-foreground">No receipts recorded yet.</Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------ Edit material status ------------------------------ */

const MATERIAL_STATUSES = [
  "Needed",
  "To Order",
  "Ordered",
  "Expected",
  "Partially Received",
  "Received",
  "Short",
  "Wrong",
  "Damaged",
  "Ready",
];

export function MaterialDetailModal({
  item,
  onClose,
}: {
  item: MaterialItem | null;
  onClose: () => void;
}) {
  const update = useUpdateRow("material_items");
  const { data: receipts = [] } = useReceipts();
  const [status, setStatus] = useState(item?.status ?? "Needed");
  const [nextStep, setNextStep] = useState(item?.next_step ?? "");
  const [expected, setExpected] = useState(item?.expected_date ?? "");

  if (!item) return null;
  const history = receipts.filter((r) => r.material_item_id === item.id);

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      subtitle={`${item.category} · ${item.spec ?? "No spec"}`}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await update.mutateAsync({
                id: item.id,
                patch: {
                  status,
                  next_step: nextStep || null,
                  expected_date: expected || null,
                  needs_attention: !["Ready", "Received"].includes(status),
                },
              });
              onClose();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3.5">
        <Field label="Required">
          <div className="text-[13px]">
            {item.required_qty ?? "—"} {item.unit}
          </div>
        </Field>
        <Field label="Ordered">
          <div className="text-[13px]">{item.ordered_qty}</div>
        </Field>
        <Field label="Received">
          <div className="text-[13px]">
            {item.received_qty}
            {item.damaged_qty ? ` (${item.damaged_qty} damaged)` : ""}
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {MATERIAL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Expected date">
          <TextInput type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </Field>
      </div>
      <Field label="Next step">
        <TextInput value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
      </Field>
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-2.5 text-[12.5px] font-semibold">
          Receipts ({history.length})
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Received</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <Td>{r.receipt_date}</Td>
                <Td>
                  <Chip tone={materialTone("Received")}>+{r.received_qty}</Chip>
                </Td>
                <Td className="text-muted-foreground">{r.notes}</Td>
              </tr>
            ))}
            {history.length === 0 ? (
              <tr>
                <Td colSpan={3} className="text-muted-foreground">
                  No receipts yet.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </Modal>
  );
}
