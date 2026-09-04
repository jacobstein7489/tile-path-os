import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button, EmptyState, SearchInput, Table, Td, Th } from "@/components/kit";
import { useProjects, type Project } from "@/lib/data";
import { useCompanies, useProfiles } from "@/lib/people";
import { Dot, stageTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Pre-award jobs in New Submission, Estimating and Proposal with salesperson, estimator, bid due dates and the next action.",
      },
      { property: "og:title", content: "Leads — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Pre-award jobs with salesperson, estimator, bid due dates and the next action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsTab,
});

/** Leads are simply jobs that have not been awarded yet — the same record. */
export const PRE_AWARD_STAGES = ["New Submission", "Estimating", "Proposal"];

function LeadsTab() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: companies = [] } = useCompanies();
  const { data: profiles = [] } = useProfiles();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const companyName = (id?: string | null) => companies.find((c) => c.id === id)?.name ?? null;
  const personName = (id?: string | null) =>
    profiles.find((p) => p.user_id === id)?.full_name ?? null;

  const q = search.trim().toLowerCase();
  const rows = projects.filter(
    (p) =>
      PRE_AWARD_STAGES.includes(p.lifecycle_stage) &&
      !p.exception_state &&
      (q === "" || `${p.name} ${p.address ?? ""} ${p.customer ?? ""}`.toLowerCase().includes(q)),
  );

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Pre-award jobs</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            New Submission · Estimating · Proposal — {rows.length} open
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads"
            className="w-[200px]"
          />
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New lead
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-[13px] text-muted-foreground">Loading leads…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No open leads"
          note="New submissions, estimates and proposals appear here until the job is awarded."
        />
      ) : (
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[15%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/60">
              {[
                "Lead / Address",
                "Customer / GC",
                "Salesperson",
                "Estimator",
                "Stage",
                "Bid due",
                "Follow-up",
                "Next action",
              ].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <LeadRow
                key={p.id}
                project={p}
                customer={companyName(p.customer_company_id) ?? p.customer}
                gc={companyName(p.gc_company_id)}
                salesperson={personName(p.salesperson_user_id)}
                estimator={personName(p.estimator_user_id)}
                onOpen={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
              />
            ))}
          </tbody>
        </Table>
      )}

      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function LeadRow({
  project: p,
  customer,
  gc,
  salesperson,
  estimator,
  onOpen,
}: {
  project: Project;
  customer: string | null;
  gc: string | null;
  salesperson: string | null;
  estimator: string | null;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer transition-colors duration-100 hover:bg-muted/50"
    >
      <Td className="group-last:border-0">
        <span className="text-[13px] font-semibold tracking-tight">{p.name}</span>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {p.address ?? p.project_type}
        </div>
      </Td>
      <Td className="group-last:border-0">
        <span className="block truncate text-[12.5px]">{customer ?? "—"}</span>
        {gc ? <span className="block truncate text-[11px] text-muted-foreground">{gc}</span> : null}
      </Td>
      <Td className="truncate group-last:border-0">{salesperson ?? "Unassigned"}</Td>
      <Td className="truncate group-last:border-0">{estimator ?? "Unassigned"}</Td>
      <Td className="group-last:border-0">
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          <Dot tone={stageTone(p.lifecycle_stage, p.exception_state)} />
          <span className="truncate">{p.lifecycle_stage}</span>
        </span>
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
        {fmt(p.bid_due_date ?? null)}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
        {fmt(p.follow_up_date ?? null)}
      </Td>
      <Td className="group-last:border-0">
        <span className="flex items-start gap-1.5 text-[12.5px] leading-snug text-secondary-foreground transition-colors duration-100 group-hover:text-foreground">
          <span className="min-w-0 flex-1 whitespace-normal">
            {p.next_move ?? "Open the job record"}
          </span>
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 transition-colors duration-100 group-hover:text-foreground" />
        </span>
      </Td>
    </tr>
  );
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
