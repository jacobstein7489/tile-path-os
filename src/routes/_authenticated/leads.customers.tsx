import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Drawer, EmptyState, SearchInput, Table, Td, Th } from "@/components/kit";
import { useProjects } from "@/lib/data";
import { useCompanies, useContacts, type Company } from "@/lib/people";
import { PRE_AWARD_STAGES } from "@/routes/_authenticated/leads.index";

export const Route = createFileRoute("/_authenticated/leads/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Every customer company with its contacts, active leads, active projects and completed work.",
      },
      { property: "og:title", content: "Customers — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Customer companies with contacts, active leads, active and completed projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersTab,
});

function CustomersTab() {
  // A friendly view of the existing customer companies — never a second database.
  const { data: companies = [], isLoading } = useCompanies("customer");
  const { data: contacts = [] } = useContacts();
  const { data: projects = [] } = useProjects();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Company | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, { leads: number; active: number; complete: number }>();
    projects.forEach((p) => {
      const key = p.customer_company_id;
      if (!key) return;
      const row = map.get(key) ?? { leads: 0, active: 0, complete: 0 };
      if (p.lifecycle_stage === "Complete") row.complete += 1;
      else if (PRE_AWARD_STAGES.includes(p.lifecycle_stage)) row.leads += 1;
      else row.active += 1;
      map.set(key, row);
    });
    return map;
  }, [projects]);

  const q = search.trim().toLowerCase();
  const rows = companies.filter((c) => q === "" || c.name.toLowerCase().includes(q));
  const contactsFor = (companyId: string) => contacts.filter((c) => c.company_id === companyId);
  const projectsFor = (companyId: string) =>
    projects.filter((p) => p.customer_company_id === companyId);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Customers</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            The same company records used everywhere else — manage them in Settings.
          </p>
        </div>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers"
          className="w-[220px]"
        />
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-[13px] text-muted-foreground">Loading customers…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No customers yet"
          note="Add a customer company in Settings, or create one while capturing a new lead."
        />
      ) : (
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[30%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/60">
              {["Customer", "Contacts", "Active leads", "Active projects", "Completed"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const s = stats.get(c.id) ?? { leads: 0, active: 0, complete: 0 };
              const people = contactsFor(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => setOpen(c)}
                  className="group cursor-pointer transition-colors duration-100 hover:bg-muted/50"
                >
                  <Td className="group-last:border-0">
                    <span className="text-[13px] font-semibold tracking-tight">{c.name}</span>
                    {c.address ? (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {c.address}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="group-last:border-0">
                    {people.length === 0 ? (
                      <span className="text-muted-foreground">No contacts</span>
                    ) : (
                      <span className="truncate">
                        {people
                          .slice(0, 2)
                          .map((p) => p.full_name)
                          .join(", ")}
                        {people.length > 2 ? ` +${people.length - 2}` : ""}
                      </span>
                    )}
                  </Td>
                  <Td className="tabular-nums group-last:border-0">{s.leads || "—"}</Td>
                  <Td className="tabular-nums group-last:border-0">{s.active || "—"}</Td>
                  <Td className="tabular-nums group-last:border-0">{s.complete || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {open ? (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={open.name}
          subtitle={open.address ?? "Customer"}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Detail label="Phone" value={open.phone} />
              <Detail label="Email" value={open.email} />
              <Detail label="Website" value={open.website} />
              <Detail label="Status" value={open.is_active ? "Active" : "Inactive"} />
            </div>

            <Block title="Contacts">
              {contactsFor(open.id).length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">
                  No contacts recorded — add them in Settings.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {contactsFor(open.id).map((p) => (
                    <li key={p.id} className="text-[13px]">
                      <span className="font-medium">{p.full_name}</span>
                      <span className="text-muted-foreground">
                        {p.title ? ` · ${p.title}` : ""}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block title="Jobs">
              {projectsFor(open.id).length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">No jobs for this customer yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {projectsFor(open.id).map((p) => (
                    <li key={p.id} className="text-[13px]">
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span className="text-muted-foreground"> · {p.lifecycle_stage}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}
