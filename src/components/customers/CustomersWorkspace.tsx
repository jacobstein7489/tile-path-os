import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ContactRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { ProjectQuickViewDialog } from "@/components/projects/ProjectQuickViewDialog";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { Button, Field, TextArea, TextInput } from "@/components/kit";
import { useProjects, useScheduleAssignments, type Project } from "@/lib/data";
import {
  useCompanies,
  useContacts,
  useSaveCompany,
  useSaveContact,
  type Company,
  type Contact,
} from "@/lib/people";
import { useFieldReports } from "@/lib/fieldreports";
import {
  compareWorkItems,
  isComplete,
  isOverdue,
  isWaiting,
  type WorkItemRow,
  useWorkFeed,
} from "@/lib/workitems";
import type { ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { normalizeStage } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
import {
  OpsCanvas,
  OpsPageHeader,
  OpsPlane,
  ObjectMark,
  StatusPill,
} from "@/components/ops/PremiumOps";

type Tab = "Overview" | "Projects" | "Contacts" | "Open Actions";
type CustomerRecord = ReturnType<typeof customerRows>[number];

export function CustomersWorkspace() {
  const { data: companies = [], isLoading } = useCompanies("customer");
  const { data: contacts = [] } = useContacts();
  const { data: projects = [] } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: reports = [] } = useFieldReports();
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectQueueRecord | null>(null);
  const records = useMemo(
    () => customerRows(companies, contacts, projects, work),
    [companies, contacts, projects, work],
  );
  const visible = records.filter((record) =>
    `${record.company.name} ${record.company.address ?? ""} ${record.contacts.map((item) => item.full_name).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const customer = companies.find((item) => item.id === customerId) ?? null;
  const openProject = (item: Project) => {
    const rows = work
      .filter((row) => row.project_id === item.id && !isComplete(row))
      .sort(compareWorkItems);
    const projectSchedule = schedule
      .filter((row) => row.project_id === item.id)
      .sort((a, b) => a.work_date.localeCompare(b.work_date));
    setProject({
      project: item,
      work: rows,
      next: rows[0],
      attention:
        rows.find(isOverdue)?.title ?? rows.find(isWaiting)?.waiting_on ?? item.needs_attention,
      relevantDate: projectSchedule[0]?.work_date ?? item.target_date,
      upcoming: projectSchedule[0],
      latestReport: reports.find((row) => row.project_id === item.id),
    });
  };
  return (
    <OpsCanvas className="max-w-[1440px]">
      <OpsPageHeader
        eyebrow="Customer operations"
        title="Customers"
        summary={`${records.length} relationships · projects, people and actions together`}
        action={
          <ObjectMark tone="ink">
            <ContactRound className="size-5" />
          </ObjectMark>
        }
      >
        <label className="mt-5 flex h-8 max-w-xl items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers or contacts"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </OpsPageHeader>
      <OpsPlane className="mt-4 p-2 sm:p-3">
        {isLoading ? (
          <Quiet>Loading customers…</Quiet>
        ) : visible.length ? (
          visible.map((record) => (
            <button
              key={record.company.id}
              type="button"
              onClick={() => setCustomerId(record.company.id)}
              className="group mb-2 grid min-h-[88px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-left last:mb-0 hover:border-primary/20 hover:bg-card hover:shadow-[var(--shadow-card)] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ObjectMark tone="ink">
                  <Building2 className="size-5" />
                </ObjectMark>
                <span className="min-w-0">
                  <strong className="block truncate text-[16px] sm:text-[18px]">
                    {record.company.name}
                  </strong>
                  <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                    {record.contacts[0]?.full_name ?? "No contact yet"}
                    {record.current ? ` · Current: ${record.current.name}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-2">
                    <StatusPill tone="blue">{record.active.length} active</StatusPill>
                    {record.open.length ? (
                      <StatusPill tone="amber">{record.open.length} open actions</StatusPill>
                    ) : null}
                  </span>
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary" />
            </button>
          ))
        ) : (
          <Quiet>No customers match this search.</Quiet>
        )}
      </OpsPlane>
      {customer && !project ? (
        <CustomerQuickViewDialog
          company={customer}
          records={records}
          onClose={() => setCustomerId(null)}
          onProject={openProject}
        />
      ) : null}
      {project ? (
        <ProjectQuickViewDialog
          job={project}
          onClose={() => setProject(null)}
          backLabel="Back to customer"
          onBack={() => setProject(null)}
        />
      ) : null}
    </OpsCanvas>
  );
}

export function CustomerQuickViewDialog({
  company,
  records,
  onClose,
  onProject,
}: {
  company: Company;
  records?: CustomerRecord[];
  onClose: () => void;
  onProject: (project: Project) => void;
}) {
  const { data: companies = [] } = useCompanies("customer");
  const { data: contacts = [] } = useContacts();
  const { data: projects = [] } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const saveCompany = useSaveCompany();
  const saveContact = useSaveContact();
  const [tab, setTab] = useState<Tab>("Overview");
  const [editing, setEditing] = useState(false);
  const [contactEdit, setContactEdit] = useState<Contact | "new" | null>(null);
  const [workItem, setWorkItem] = useState<WorkItemRow | null>(null);
  const fallbackRecords = useMemo(
    () => customerRows(companies, contacts, projects, work),
    [companies, contacts, projects, work],
  );
  const record =
    (records ?? fallbackRecords).find((item) => item.company.id === company.id) ??
    fallbackRecords.find((item) => item.company.id === company.id);
  const current = record?.company ?? company;
  const [form, setForm] = useState({
    name: current.name,
    address: current.address ?? "",
    phone: current.phone ?? "",
    email: current.email ?? "",
    notes: current.notes ?? "",
  });
  if (!record) return null;
  if (workItem)
    return (
      <CenterDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={workItem.title}
        description={current.name}
        className="sm:max-w-[1100px]"
        bodyClassName="overflow-hidden"
      >
        <div className="flex max-h-[84dvh] min-h-[560px] flex-col bg-canvas">
          <header className="shrink-0 border-b border-border bg-card px-4 py-2.5">
            <Button size="sm" onClick={() => setWorkItem(null)}>
              <ArrowLeft className="size-4" /> Back to customer
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
            <WorkItemPanel item={workItem} compact />
          </div>
        </div>
      </CenterDialog>
    );
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={current.name}
      description="Customer operating workspace"
      className="sm:max-w-[1100px]"
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-[calc(100dvh-0.5rem)] max-h-[84dvh] flex-col bg-canvas sm:h-[min(780px,84dvh)]">
        <header className="relative shrink-0 border-b border-border bg-card px-4 pt-4 sm:px-6 sm:pt-5 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <ObjectMark tone="ink" className="size-11">
                <Building2 className="size-5" />
              </ObjectMark>
              <div className="min-w-0">
                <p className="ops-eyebrow">Customer</p>
                <h2 className="truncate text-[23px] font-bold">{current.name}</h2>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">
                  {current.address ?? "Address not set"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={editing ? "primary" : "secondary"}
              onClick={() => setEditing((value) => !value)}
            >
              <Pencil className="size-3.5" /> {editing ? "Editing" : "Edit"}
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Summary value={record.active.length} label="Active projects" />
            <Summary value={record.open.length} label="Open actions" />
            <Summary value={record.contacts.length} label="Contacts" />
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto rounded-t-xl bg-muted/55 p-1 pb-0">
            {(["Overview", "Projects", "Contacts", "Open Actions"] as Tab[]).map((value) => (
              <Button
                key={value}
                variant="ghost"
                onClick={() => setTab(value)}
                className={cn(
                  "h-9 shrink-0 rounded-t-lg border-b-2 px-3 text-[11.5px]",
                  tab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {value}
                {value === "Open Actions" && record.open.length ? ` · ${record.open.length}` : ""}
              </Button>
            ))}
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {editing ? (
            <CompanyEditor
              form={form}
              setForm={setForm}
              saving={saveCompany.isPending}
              onCancel={() => setEditing(false)}
              onSave={async () => {
                await saveCompany.mutateAsync({
                  id: current.id,
                  values: {
                    ...form,
                    name: form.name.trim(),
                    kind: current.kind,
                    address: form.address || null,
                    phone: form.phone || null,
                    email: form.email || null,
                    notes: form.notes || null,
                  },
                });
                setEditing(false);
              }}
            />
          ) : null}
          {!editing && tab === "Overview" ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr]">
              <CustomerPanel title="Relationship">
                <Fact
                  icon={Phone}
                  label="Phone"
                  value={current.phone ?? record.contacts[0]?.phone ?? "Not set"}
                />
                <Fact
                  icon={Mail}
                  label="Email"
                  value={current.email ?? record.contacts[0]?.email ?? "Not set"}
                />
                <Fact icon={MapPin} label="Address" value={current.address ?? "Not set"} />
                {current.notes ? (
                  <p className="border-t border-border py-3 text-[12px] leading-5 text-muted-foreground">
                    {current.notes}
                  </p>
                ) : null}
              </CustomerPanel>
              <CustomerPanel title="Active work">
                {record.active.length ? (
                  record.active
                    .slice(0, 4)
                    .map((item) => (
                      <ProjectRow key={item.id} project={item} onClick={() => onProject(item)} />
                    ))
                ) : (
                  <Quiet>No active projects.</Quiet>
                )}
              </CustomerPanel>
            </div>
          ) : null}
          {!editing && tab === "Projects" ? (
            <CustomerPanel title="Projects">
              {record.projects.map((item) => (
                <ProjectRow key={item.id} project={item} onClick={() => onProject(item)} />
              ))}
            </CustomerPanel>
          ) : null}
          {!editing && tab === "Contacts" ? (
            <CustomerPanel
              title="Contacts"
              action={
                <Button size="sm" onClick={() => setContactEdit("new")}>
                  <Plus className="size-3.5" /> Add contact
                </Button>
              }
            >
              {record.contacts.length ? (
                record.contacts.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setContactEdit(item)}
                    className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-3 text-left first:border-t-0 hover:bg-primary-soft/35"
                  >
                    <span>
                      <strong className="text-[13.5px]">{item.full_name}</strong>
                      <p className="text-[11px] text-muted-foreground">
                        {[item.title, item.phone, item.email].filter(Boolean).join(" · ") ||
                          "Contact details not set"}
                      </p>
                    </span>
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <Quiet>No contacts yet.</Quiet>
              )}
            </CustomerPanel>
          ) : null}
          {!editing && tab === "Open Actions" ? (
            <CustomerPanel title="Open actions">
              {record.open.length ? (
                record.open.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setWorkItem(item)}
                    className="grid min-h-[58px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-3 py-2.5 text-left first:border-t-0 hover:bg-primary-soft/35"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-[13.5px]">{item.title}</strong>
                      <span className="text-[11px] text-muted-foreground">
                        {item.projects?.name ?? "Project"} · {item.status}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <Quiet>No open actions.</Quiet>
              )}
            </CustomerPanel>
          ) : null}
        </div>
      </div>
      {contactEdit ? (
        <ContactEditor
          companyId={current.id}
          contact={contactEdit === "new" ? null : contactEdit}
          saving={saveContact.isPending}
          onClose={() => setContactEdit(null)}
          onSave={async (values) => {
            await saveContact.mutateAsync({
              ...(contactEdit !== "new" ? { id: contactEdit.id } : {}),
              values: {
                ...values,
                company_id: current.id,
                kind: contactEdit !== "new" ? contactEdit.kind : "customer",
              },
            });
            setContactEdit(null);
          }}
        />
      ) : null}
    </CenterDialog>
  );
}

function CompanyEditor({
  form,
  setForm,
  saving,
  onCancel,
  onSave,
}: {
  form: { name: string; address: string; phone: string; email: string; notes: string };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      address: string;
      phone: string;
      email: string;
      notes: string;
    }>
  >;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  return (
    <section className="workspace-panel p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name">
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Address">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Relationship notes">
            <TextArea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!form.name.trim() || saving} onClick={onSave}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}

function ContactEditor({
  companyId,
  contact,
  saving,
  onClose,
  onSave,
}: {
  companyId: string;
  contact: Contact | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: {
    full_name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    company_id: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    full_name: contact?.full_name ?? "",
    title: contact?.title ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    notes: contact?.notes ?? "",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={contact ? "Edit contact" : "Add contact"}
      description="Customer contact"
      className="sm:max-w-[620px]"
    >
      <div className="grid gap-3 bg-canvas p-4 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label="Title">
          <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!form.full_name.trim() || saving}
            onClick={() =>
              onSave({
                full_name: form.full_name.trim(),
                title: form.title || null,
                phone: form.phone || null,
                email: form.email || null,
                notes: form.notes || null,
                company_id: companyId,
              })
            }
          >
            {saving ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </div>
    </CenterDialog>
  );
}

function customerRows(
  companies: Company[],
  contacts: Contact[] | undefined,
  projects: Project[],
  work: WorkItemRow[] | undefined,
) {
  return companies.map((company) => {
    const customerProjects = projects.filter((item) => item.customer_company_id === company.id);
    const ids = new Set(customerProjects.map((item) => item.id));
    const active = customerProjects.filter(
      (item) => normalizeStage(item.lifecycle_stage) !== "Complete",
    );
    return {
      company,
      contacts: (contacts ?? []).filter((item) => item.company_id === company.id),
      projects: customerProjects,
      active,
      complete: customerProjects.filter(
        (item) => normalizeStage(item.lifecycle_stage) === "Complete",
      ),
      open: (work ?? []).filter(
        (item) => item.project_id && ids.has(item.project_id) && !isComplete(item),
      ),
      current: active[0] ?? null,
    };
  });
}
function CustomerPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <h3 className="text-[13px] font-bold">{title}</h3>
        {action}
      </div>
      <div className="border-t border-border p-2.5">{children}</div>
    </section>
  );
}
function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[62px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-3 py-2.5 text-left first:border-t-0 hover:bg-primary-soft/35"
    >
      <span className="min-w-0">
        <strong className="block truncate text-[13.5px]">{project.name}</strong>
        <span className="text-[11px] text-muted-foreground">
          {normalizeStage(project.lifecycle_stage)} · {project.address ?? "Address not set"}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
function Summary({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-background/65 px-3 py-2">
      <strong className="block text-[17px] tabular-nums">{value}</strong>
      <span className="text-[9.5px] font-bold text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
function Fact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
        <span className="block truncate text-[12.5px] font-semibold">{value}</span>
      </span>
    </div>
  );
}
function Quiet({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">{children}</div>;
}
