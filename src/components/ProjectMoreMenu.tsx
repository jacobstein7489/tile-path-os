import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Modal, Select, TextInput } from "@/components/kit";
import { useDeleteRow, useUpdateProject, type Project } from "@/lib/data";
import { useCanEditProject, usePermissions } from "@/hooks/useAuth";
import {
  companyOptions,
  contactOptions,
  profileOptions,
  useCompanies,
  useContacts,
  useProfiles,
  useSaveCompany,
  useSaveContact,
} from "@/lib/people";
import { Combobox } from "@/components/kit";
import { cn } from "@/lib/utils";

export function ProjectMoreMenu({
  project,
  compact = false,
}: {
  project: Project;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    note: string;
    confirmLabel: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateProject(project.id);
  const del = useDeleteRow("projects");
  const navigate = useNavigate();
  const perms = usePermissions();
  const { canEdit, isLoading: accessLoading } = useCanEditProject(project.id);

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
      : {
          label: "Put on hold",
          run: () => (
            setOpen(false),
            setPendingAction({
              title: "Put project on hold?",
              note: "The project stays active and keeps its full history, but will be clearly marked as paused.",
              confirmLabel: "Put on hold",
              run: () => setException("On Hold", "Project put on hold"),
            })
          ),
        },
    ...(perms.isAdmin || perms.has("gm")
      ? [
          {
            label: "Cancel project",
            run: () => (
              setOpen(false),
              setPendingAction({
                title: "Cancel project?",
                note: "The project stays in the database with its full history and can be restored later.",
                confirmLabel: "Cancel project",
                danger: true,
                run: () => setException("Cancelled", "Project marked cancelled"),
              })
            ),
          },
        ]
      : []),
    ...((project.lifecycle_stage === "Complete" || project.exception_state === "Cancelled") &&
    perms.isAdmin
      ? [
          {
            label: "Archive project",
            run: () => (
              setOpen(false),
              setPendingAction({
                title: "Archive project?",
                note: "The project will leave active lists but its records and history remain intact.",
                confirmLabel: "Archive project",
                run: archive,
              })
            ),
          },
        ]
      : []),
    ...(perms.isAdmin
      ? [
          {
            label: "Delete permanently",
            run: () => (setOpen(false), setConfirmDelete(true)),
            danger: true,
          },
        ]
      : []),
  ];

  if (accessLoading || (!canEdit && !perms.isAdmin)) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        className={compact ? "size-9 px-0" : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-label={compact ? "Project actions" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="size-4" /> {compact ? null : "More"}
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
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={pendingAction?.title ?? "Confirm action"}
        footer={
          <>
            <Button onClick={() => setPendingAction(null)}>Cancel</Button>
            <Button
              variant={pendingAction?.danger ? "danger" : "primary"}
              loading={update.isPending}
              onClick={async () => {
                const action = pendingAction;
                if (!action) return;
                await action.run();
                setPendingAction(null);
              }}
            >
              {pendingAction?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-secondary-foreground">{pendingAction?.note}</p>
      </Modal>

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
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const { data: profiles = [] } = useProfiles();
  const saveCompany = useSaveCompany();
  const saveContact = useSaveContact();
  const [form, setForm] = useState({
    name: project.name,
    address: project.address ?? "",
    customer: project.customer ?? "",
    project_type: project.project_type,
    project_manager: project.project_manager ?? "",
    crew_lead: project.crew_lead ?? "",
    target_date: project.target_date ?? "",
    customer_company_id: project.customer_company_id ?? (null as string | null),
    gc_company_id: project.gc_company_id ?? (null as string | null),
    primary_contact_id: project.primary_contact_id ?? (null as string | null),
    pm_user_id: project.pm_user_id ?? (null as string | null),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
                customer_company_id: form.customer_company_id,
                gc_company_id: form.gc_company_id,
                primary_contact_id: form.primary_contact_id,
                pm_user_id: form.pm_user_id,
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
          <Combobox
            options={companyOptions(companies)}
            value={form.customer_company_id}
            onChange={(value) => set("customer_company_id", value)}
            placeholder="Search customers…"
            onCreate={async (label) => {
              const company = await saveCompany.mutateAsync({
                values: { name: label, kind: "customer" },
              });
              if (company) set("customer_company_id", company.id);
            }}
            createLabel="Add customer"
          />
        </Field>
        <Field label="Project type">
          <Select value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>
            {["New Job", "Existing Client", "Commercial", "Warranty / Return"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="PM / owner">
          <Combobox
            options={profileOptions(profiles)}
            value={form.pm_user_id}
            onChange={(value) => set("pm_user_id", value)}
            placeholder="Search employees…"
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
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="General contractor">
          <Combobox
            options={companyOptions(companies)}
            value={form.gc_company_id}
            onChange={(value) => set("gc_company_id", value)}
            placeholder="Search companies…"
            onCreate={async (label) => {
              const company = await saveCompany.mutateAsync({
                values: { name: label, kind: "gc" },
              });
              if (company) set("gc_company_id", company.id);
            }}
            createLabel="Add company"
          />
        </Field>
        <Field label="Main contact">
          <Combobox
            options={contactOptions(contacts, companies)}
            value={form.primary_contact_id}
            onChange={(value) => set("primary_contact_id", value)}
            placeholder="Search contacts…"
            onCreate={async (label) => {
              const contact = await saveContact.mutateAsync({
                values: { full_name: label, company_id: form.customer_company_id },
              });
              if (contact) set("primary_contact_id", contact.id);
            }}
            createLabel="Add contact"
          />
        </Field>
      </div>
    </Modal>
  );
}
