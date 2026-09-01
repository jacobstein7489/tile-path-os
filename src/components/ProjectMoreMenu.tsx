import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Modal, Select, TextInput } from "@/components/kit";
import { useDeleteRow, useUpdateProject, type Project } from "@/lib/data";
import { cn } from "@/lib/utils";

export function ProjectMoreMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateProject(project.id);
  const del = useDeleteRow("projects");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const setException = async (state: string | null, label: string) => {
    setOpen(false);
    await update.mutateAsync({ exception_state: state });
    toast.success(label);
  };

  const archive = async () => {
    setOpen(false);
    await update.mutateAsync({ archived_at: new Date().toISOString() } as Partial<Project>);
    toast.success("Project archived");
  };

  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: "Edit project", run: () => (setOpen(false), setEdit(true)) },
    project.exception_state === "On Hold"
      ? { label: "Take off hold", run: () => setException(null, "Project resumed") }
      : { label: "Put on hold", run: () => setException("On Hold", "Project put on hold") },
    { label: "Mark cancelled", run: () => setException("Cancelled", "Project marked cancelled") },
    { label: "Mark lost", run: () => setException("Lost", "Project marked lost") },
    { label: "Archive project", run: archive },
    {
      label: "Delete permanently",
      run: () => (setOpen(false), setConfirmDelete(true)),
      danger: true,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <MoreHorizontal className="size-4" /> More
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[210px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[var(--shadow-raised)]"
        >
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              onClick={i.run}
              className={cn(
                "block w-full px-4 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                i.danger ? "text-danger hover:bg-danger-soft" : "text-secondary-foreground",
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
      ) : null}

      <EditProjectModal open={edit} onClose={() => setEdit(false)} project={project} />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete project permanently?"
        subtitle="This removes the project and everything attached to it. This cannot be undone."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={async () => {
                await del.mutateAsync(project.id);
                toast.success("Project deleted");
                navigate({ to: "/projects" });
              }}
            >
              {del.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-secondary-foreground">
          Type nothing — just confirm you want <strong>{project.name}</strong> gone for good. Prefer
          “Archive project” if you only want it out of the way.
        </p>
      </Modal>
    </div>
  );
}

function EditProjectModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  const update = useUpdateProject(project.id);
  const [form, setForm] = useState({
    name: project.name,
    address: project.address ?? "",
    customer: project.customer ?? "",
    project_type: project.project_type,
    project_manager: project.project_manager ?? "",
    crew_lead: project.crew_lead ?? "",
    target_date: project.target_date ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit project"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!form.name.trim() || update.isPending}
            onClick={async () => {
              await update.mutateAsync({
                name: form.name.trim(),
                address: form.address || null,
                customer: form.customer || null,
                project_type: form.project_type,
                project_manager: form.project_manager || null,
                crew_lead: form.crew_lead || null,
                target_date: form.target_date || null,
              });
              toast.success("Saved");
              onClose();
            }}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <Field label="Project name">
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
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
            {["New Job", "Existing Client", "Commercial", "Warranty / Return"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="PM / owner">
          <TextInput
            value={form.project_manager}
            onChange={(e) => set("project_manager", e.target.value)}
          />
        </Field>
        <Field label="Crew lead / contact">
          <TextInput value={form.crew_lead} onChange={(e) => set("crew_lead", e.target.value)} />
        </Field>
        <Field label="Target date">
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
