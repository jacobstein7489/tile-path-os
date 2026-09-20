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
import { OpsCanvas, OpsPageHeader, OpsPlane, ObjectMark, StatusPill } from "@/components/ops/PremiumOps";

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
    <OpsCanvas className="max-w-[1440px]">
      <OpsPageHeader eyebrow="Customer operations" title="Customers" summary={`${records.length} relationships · projects, people and actions together`} action={<ObjectMark tone="ink"><ContactRound className="size-5"/></ObjectMark>}>
        <div className="mt-5">
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
      </OpsPageHeader>
      <OpsPlane className="mt-4 p-2 sm:p-3">
        {isLoading ? (
          <Quiet>Loading customers…</Quiet>
        ) : visible.length ? (
          visible.map((record) => (
            <button
              key={record.company.id}
              type="button"
              onClick={() => setCustomer(record.company)}
               className="group mb-2 grid min-h-[96px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-left last:mb-0 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-[var(--shadow-card)] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                 <ObjectMark tone="ink"><Building2 className="size-5" /></ObjectMark>
                <span className="min-w-0">
                   <strong className="block truncate text-[16px] sm:text-[18px]">
                    {record.company.name}
                  </strong>
                  <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                    {record.contacts[0]?.full_name ?? "No primary contact"}
                    {record.current ? ` · Current: ${record.current.name}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-2 text-[10.5px] font-bold">
                     <StatusPill tone="blue">
                      {record.active.length} active
                     </StatusPill>
                     <StatusPill>
                      {record.complete.length} complete
                     </StatusPill>
                    {record.open.length ? (
                       <StatusPill tone="amber">
                        {record.open.length} open actions
                       </StatusPill>
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
      <div className="flex max-h-[84dvh] min-h-[560px] flex-col bg-canvas">
        <header className="relative shrink-0 overflow-hidden border-b border-border bg-card px-4 pt-4 sm:px-6 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground text-card shadow-[var(--shadow-card)]">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="v2-kicker">Customer</p>
              <h2 className="truncate text-[24px] font-bold">{company.name}</h2>
              <p className="mt-1 truncate text-[12px] text-muted-foreground">
                {company.address ?? "Address not set"}
              </p>
            </div>
          </div>
          <nav className="mt-4 flex gap-1 overflow-x-auto rounded-t-xl bg-muted/55 p-1 pb-0">
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
