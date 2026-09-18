import { useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  FolderKanban,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { ProjectQuickViewDialog } from "@/components/projects/ProjectQuickViewDialog";
import { useProjects, useScheduleAssignments, type Project } from "@/lib/data";
import { useCompanies, useContacts, type Company } from "@/lib/people";
import { useFieldReports } from "@/lib/fieldreports";
import { compareWorkItems, isComplete, isOverdue, isWaiting, useWorkFeed } from "@/lib/workitems";
import type { ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { normalizeStage } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

type Tab = "Overview" | "Projects" | "Contacts" | "Open Actions";

export function CustomersWorkspace() {
  const { data: companies = [], isLoading } = useCompanies("customer");
  const { data: contacts = [] } = useContacts();
  const { data: projects = [] } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: reports = [] } = useFieldReports();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Company | null>(null);
  const [project, setProject] = useState<ProjectQueueRecord | null>(null);

  const records = useMemo(
    () =>
      companies.map((company) => {
        const customerProjects = projects.filter((item) => item.customer_company_id === company.id);
        const ids = new Set(customerProjects.map((item) => item.id));
        const open = work.filter(
          (item) => item.project_id && ids.has(item.project_id) && !isComplete(item),
        );
        const active = customerProjects.filter(
          (item) => normalizeStage(item.lifecycle_stage) !== "Complete",
        );
        const complete = customerProjects.filter(
          (item) => normalizeStage(item.lifecycle_stage) === "Complete",
        );
        return {
          company,
          contacts: contacts.filter((item) => item.company_id === company.id),
          projects: customerProjects,
          active,
          complete,
          open,
          current: active[0] ?? null,
        };
      }),
    [companies, contacts, projects, work],
  );
  const visible = records.filter((record) =>
    `${record.company.name} ${record.company.address ?? ""} ${record.contacts.map((item) => item.full_name).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const openProject = (item: Project) => {
    const rows = work
      .filter((row) => row.project_id === item.id && !isComplete(row))
      .sort(compareWorkItems);
    const projectSchedule = schedule
      .filter((row) => row.project_id === item.id)
      .sort((a, b) => a.work_date.localeCompare(b.work_date));
    const latestReport = reports.find((row) => row.project_id === item.id);
    setProject({
      project: item,
      work: rows,
      next: rows[0],
      attention:
        rows.find(isOverdue)?.title ?? rows.find(isWaiting)?.waiting_on ?? item.needs_attention,
      relevantDate: projectSchedule[0]?.work_date ?? item.target_date,
      upcoming: projectSchedule[0],
      latestReport,
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 md:px-6">
      <section className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-raised)]">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-gradient-to-br from-primary-soft/60 to-card px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="v2-kicker">Customer operations</p>
            <h1 className="mt-1 truncate text-[22px] font-bold md:text-[27px]">Customers</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {records.length} customer relationships · projects, people and actions together
            </p>
          </div>
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
            <ContactRound className="size-5" />
          </span>
        </header>
        <div className="bg-muted/30 p-3 sm:px-4">
          <label className="flex h-8 max-w-xl items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers or contacts"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
        </div>
      </section>
      <section className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <Quiet>Loading customers…</Quiet>
        ) : visible.length ? (
          visible.map((record) => (
            <button
              key={record.company.id}
              type="button"
              onClick={() => setCustomer(record.company)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-4 py-2.5 text-left last:border-0 hover:bg-primary-soft/30 sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary-soft text-primary">
                  <Building2 className="size-5" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-[15px] sm:text-[16px]">
                    {record.company.name}
                  </strong>
                  <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                    {record.contacts[0]?.full_name ?? "No primary contact"}
                    {record.current ? ` · Current: ${record.current.name}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-2 text-[10.5px] font-bold">
                    <span className="rounded-full bg-info-soft px-2 py-0.5 text-info">
                      {record.active.length} active
                    </span>
                    <span className="rounded-full bg-neutral-chip px-2 py-0.5 text-secondary-foreground">
                      {record.complete.length} complete
                    </span>
                    {record.open.length ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                        {record.open.length} open actions
                      </span>
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
      </section>
      {customer && !project ? (
        <CustomerQuickViewDialog
          company={customer}
          records={records}
          onClose={() => setCustomer(null)}
          onProject={openProject}
        />
      ) : null}
      {project ? (
        <ProjectQuickViewDialog
          job={project}
          onClose={() => {
            setProject(null);
            if (!customer) setCustomer(null);
          }}
          backLabel={customer ? "Back to customer" : undefined}
          onBack={customer ? () => setProject(null) : undefined}
        />
      ) : null}
    </main>
  );
}

export function CustomerQuickViewDialog({
  company,
  records,
  onClose,
  onProject,
}: {
  company: Company;
  records?: ReturnType<typeof customerRows>;
  onClose: () => void;
  onProject: (project: Project) => void;
}) {
  const { data: companies = [] } = useCompanies("customer");
  const { data: contacts = [] } = useContacts();
  const { data: projects = [] } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const [tab, setTab] = useState<Tab>("Overview");
  const fallbackRecords = useMemo(
    () => customerRows(companies, contacts, projects, work),
    [companies, contacts, projects, work],
  );
  const record = (records ?? fallbackRecords).find((item) => item.company.id === company.id);
  if (!record) return null;
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={company.name}
      description="Customer operating workspace"
      bodyClassName="overflow-hidden"
    >
      <div className="flex max-h-[80dvh] min-h-[480px] flex-col bg-canvas">
        <header className="shrink-0 border-b border-border bg-card px-4 pt-3.5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="v2-kicker">Customer</p>
              <h2 className="truncate text-[22px] font-bold">{company.name}</h2>
              <p className="mt-1 truncate text-[12px] text-muted-foreground">
                {company.address ?? "Address not set"}
              </p>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {(["Overview", "Projects", "Contacts", "Open Actions"] as Tab[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-[11.5px] font-bold",
                  tab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {tab === "Overview" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CustomerPanel title="Relationship">
                <Fact
                  icon={ContactRound}
                  label="Primary contact"
                  value={record.contacts[0]?.full_name ?? "Not set"}
                />
                <Fact
                  icon={Phone}
                  label="Phone"
                  value={record.contacts[0]?.phone ?? company.phone ?? "Not set"}
                />
                <Fact
                  icon={Mail}
                  label="Email"
                  value={record.contacts[0]?.email ?? company.email ?? "Not set"}
                />
                <Fact icon={MapPin} label="Address" value={company.address ?? "Not set"} />
              </CustomerPanel>
              <CustomerPanel title="Current operations">
                <strong className="block text-[24px] text-primary">{record.active.length}</strong>
                <p className="text-[12px] text-muted-foreground">
                  active projects · {record.open.length} open actions
                </p>
                {record.current ? (
                  <button
                    type="button"
                    onClick={() => onProject(record.current as Project)}
                    className="mt-4 flex w-full items-center justify-between rounded-lg bg-primary-soft p-2.5 text-left"
                  >
                    <span>
                      <strong className="block text-[13px]">{record.current.name}</strong>
                      <span className="text-[11px] text-muted-foreground">
                        {record.current.lifecycle_stage}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-primary" />
                  </button>
                ) : null}
              </CustomerPanel>
            </div>
          ) : null}
          {tab === "Projects" ? (
            <CustomerPanel title="Projects">
              {record.projects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onProject(item)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-3 py-3 text-left first:border-t-0 hover:bg-primary-soft/35"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[13.5px]">{item.name}</strong>
                    <span className="text-[11px] text-muted-foreground">
                      {item.lifecycle_stage} · {item.readiness_pct}% ready
                    </span>
                  </span>
                  <ChevronRight className="size-4" />
                </button>
              ))}
            </CustomerPanel>
          ) : null}
          {tab === "Contacts" ? (
            <CustomerPanel title="Contacts">
              {record.contacts.map((item) => (
                <div key={item.id} className="border-t border-border px-3 py-3 first:border-t-0">
                  <strong className="text-[13.5px]">{item.full_name}</strong>
                  <p className="text-[11px] text-muted-foreground">
                    {[item.title, item.phone, item.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </CustomerPanel>
          ) : null}
          {tab === "Open Actions" ? (
            <CustomerPanel title="Open actions">
              {record.open.map((item) => (
                <div key={item.id} className="border-t border-border px-3 py-3 first:border-t-0">
                  <strong className="block text-[13.5px]">{item.title}</strong>
                  <p className="text-[11px] text-muted-foreground">
                    {item.projects?.name ?? "Project"} · {item.status}
                  </p>
                </div>
              ))}
            </CustomerPanel>
          ) : null}
        </div>
      </div>
    </CenterDialog>
  );
}

function customerRows(
  companies: Company[],
  contacts: ReturnType<typeof useContacts>["data"],
  projects: Project[],
  work: ReturnType<typeof useWorkFeed>["data"],
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
function CustomerPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <h3 className="px-3.5 py-2.5 text-[13px] font-bold">{title}</h3>
      <div className="border-t border-border p-2.5">{children}</div>
    </section>
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
