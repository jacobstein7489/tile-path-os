import { useState } from "react";
import { Button, Field, Modal, Select, TextArea, TextInput } from "@/components/kit";
import {
  useInsertRow,
  useProjects,
  type MaterialItem,
  type Project,
} from "@/lib/data";

export type WorkItemKind =
  | "Field Update"
  | "Task"
  | "Question"
  | "Material Need"
  | "Decision"
  | "Issue"
  | "Approval"
  | "Punch / Return Item";


/** Creates a real structured work item. Comments are context — this changes the project. */
export function CreateWorkItemModal({
  open,
  onClose,
  kind,
  projectId,
  areaId,
  surfaceId,
}: {
  open: boolean;
  onClose: () => void;
  kind: WorkItemKind;
  projectId?: string;
  areaId?: string | null;
  surfaceId?: string | null;
}) {
  const { data: projects = [] } = useProjects();
  const insert = useInsertRow("work_items");
  const [form, setForm] = useState({
    project_id: projectId ?? "",
    title: "",
    description: "",
    owner: kind === "Material Need" ? "Office / Materials" : "Site Manager",
    waiting_on: "",
    priority: "Medium",
    due_date: "",
    next_action: "",
    impact: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const chosenProject = projectId ?? form.project_id;
  const valid = Boolean(chosenProject && form.title.trim());

  const save = async () => {
    if (!valid) return;
    await insert.mutateAsync({
      project_id: chosenProject,
      area_id: areaId ?? null,
      surface_id: surfaceId ?? null,
      item_type: kind,
      title: form.title.trim(),
      description: form.description || null,
      owner: form.owner || null,
      waiting_on: form.waiting_on || null,
      priority: form.priority,
      due_date: form.due_date || null,
      next_action: form.next_action || null,
      impact: form.impact || null,
      status: form.waiting_on ? "Waiting" : "Open",
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`New ${kind}`}
      subtitle="Structured record — it will appear on the project and in Today."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!valid || insert.isPending}
            {...(!valid ? { disabledReason: "Pick a project and enter a summary" } : {})}
          >
            {insert.isPending ? "Saving…" : `Save ${kind}`}
          </Button>
        </>
      }
    >
      {!projectId ? (
        <Field label="Project">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Select a project…</option>
            {projects.map((p: Project) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label={kind === "Field Update" ? "Update summary" : "Summary"}>
        <TextInput
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={
            kind === "Material Need"
              ? "Need more thinset for restrooms"
              : kind === "Question"
                ? "Is this wire going the correct direction?"
                : "Short, specific summary"
          }
        />
      </Field>

      <Field label="Detail / context">
        <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Owner">
          <Combobox
            options={profileOptions(profiles)}
            value={ownerId}
            onChange={(v) => {
              setOwnerId(v);
              set("owner", profiles.find((p) => p.user_id === v)?.full_name ?? "");
            }}
            placeholder="Search employees…"
          />
        </Field>
        <Field label="Waiting on">
          <TextInput
            value={form.waiting_on}
            onChange={(e) => set("waiting_on", e.target.value)}
            placeholder="Vendor, GC, electrician…"
          />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </Select>
        </Field>
        <Field label="Needed by">
          <TextInput
            type="date"
            value={form.due_date}
            onChange={(e) => set("due_date", e.target.value)}
          />
        </Field>
        <Field label="Next action">
          <TextInput value={form.next_action} onChange={(e) => set("next_action", e.target.value)} />
        </Field>
        <Field label="Impact">
          <TextInput value={form.impact} onChange={(e) => set("impact", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Material request: creates both a material line and the structured need. */
export function RequestMaterialModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}) {
  const { data: projects = [] } = useProjects();
  const insertMaterial = useInsertRow<Partial<MaterialItem>>("material_items");
  const insertWork = useInsertRow("work_items");
  const [form, setForm] = useState({
    project_id: projectId ?? "",
    name: "",
    spec: "",
    category: "Installation Materials",
    goes_to: "",
    supplier: "Cobblestone (supplied)",
    required_qty: "",
    unit: "bags",
    notes: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const chosenProject = projectId ?? form.project_id;
  const valid = Boolean(chosenProject && form.name.trim());

  const save = async () => {
    if (!valid) return;
    await insertMaterial.mutateAsync({
      project_id: chosenProject,
      name: form.name.trim(),
      spec: form.spec || null,
      category: form.category,
      goes_to: form.goes_to || null,
      supplier: form.supplier || null,
      responsibility: "Cobblestone",
      unit: form.unit || null,
      required_qty: form.required_qty ? Number(form.required_qty) : null,
      status: "Needed",
      next_step: "Order and confirm delivery",
      needs_attention: true,
      notes: form.notes || null,
    });
    await insertWork.mutateAsync({
      project_id: chosenProject,
      item_type: "Material Need",
      title: `Material request: ${form.name.trim()}`,
      description: form.notes || null,
      owner: "Office / Materials",
      priority: "High",
      status: "Open",
      next_action: "Order material",
      impact: "Installation may stop without this material",
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request material"
      subtitle="Creates a material line in Materials and a Material Need work item."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!valid || insertMaterial.isPending}
            {...(!valid ? { disabledReason: "Pick a project and enter the material" } : {})}
          >
            Submit request
          </Button>
        </>
      }
    >
      {!projectId ? (
        <Field label="Project">
          <Select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Material">
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Thinset" />
        </Field>
        <Field label="Spec">
          <TextInput
            value={form.spec}
            onChange={(e) => set("spec", e.target.value)}
            placeholder="Versabond-LFT — 50 lb"
          />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option>Finish Tile</option>
            <option>Grout &amp; Metals</option>
            <option>Installation Materials</option>
          </Select>
        </Field>
        <Field label="Goes to (area)">
          <TextInput value={form.goes_to} onChange={(e) => set("goes_to", e.target.value)} />
        </Field>
        <Field label="Quantity">
          <TextInput
            type="number"
            value={form.required_qty}
            onChange={(e) => set("required_qty", e.target.value)}
          />
        </Field>
        <Field label="Unit">
          <TextInput value={form.unit} onChange={(e) => set("unit", e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </Modal>
  );
}
