import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, Field, Modal, Select, TextInput } from "@/components/kit";
import { useInsertRow } from "@/lib/data";

const TYPES = ["New Job", "Existing Client", "Commercial", "Warranty / Return"];
const OWNERS = ["Yaakov", "Office", "PM"];

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insert = useInsertRow("projects");
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    address: "",
    customer: "",
    project_type: "New Job",
    project_manager: "Yaakov",
    crew_lead: "",
    target_date: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = Boolean(form.name.trim());

  const save = async () => {
    if (!valid) return;
    const row = (await insert.mutateAsync({
      name: form.name.trim(),
      address: form.address || null,
      customer: form.customer || null,
      project_type: form.project_type,
      project_manager: form.project_manager || null,
      crew_lead: form.crew_lead || null,
      target_date: form.target_date || null,
      lifecycle_stage: "New Submission",
      next_move: "Start estimating",
      next_move_owner: "Office",
    })) as { id: string } | null;
    toast.success("Project created");
    onClose();
    setForm({
      name: "",
      address: "",
      customer: "",
      project_type: "New Job",
      project_manager: "Yaakov",
      crew_lead: "",
      target_date: "",
    });
    if (row?.id) navigate({ to: "/projects/$projectId", params: { projectId: row.id } });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      subtitle="Just the basics — the rest is filled in as the project moves through its lifecycle."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!valid || insert.isPending}
            {...(!valid ? { disabledReason: "Enter a project name" } : {})}
          >
            {insert.isPending ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <Field label="Project name / address">
        <TextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="118 Park Place"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Address">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Customer / GC">
          <TextInput value={form.customer} onChange={(e) => set("customer", e.target.value)} />
        </Field>
        <Field label="Project type">
          <Select value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="PM / owner">
          <Select
            value={form.project_manager}
            onChange={(e) => set("project_manager", e.target.value)}
          >
            {OWNERS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Main contact">
          <TextInput
            value={form.crew_lead}
            onChange={(e) => set("crew_lead", e.target.value)}
            placeholder="Site contact or crew lead"
          />
        </Field>
        <Field label="Bid due / target date" hint="Optional">
          <TextInput
            type="date"
            value={form.target_date}
            onChange={(e) => set("target_date", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
