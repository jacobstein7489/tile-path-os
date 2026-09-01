import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { EmptyState, Select, Table, Td, Th, TextInput } from "@/components/kit";
import { useProjects, useUpdateAnyProject, type Project } from "@/lib/data";
import { useProfiles } from "@/lib/people";
import type { Profile } from "@/hooks/useAuth";
import { Dot } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/leads/commissions")({
  head: () => ({
    meta: [
      { title: "Commissions — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Operational commission sheet: salesperson, project, commissionable amount, rate, commission and payment status.",
      },
      { property: "og:title", content: "Commissions — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Salesperson, project, commissionable amount, rate, commission and status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommissionsTab,
});

const STATUSES = ["Pending", "Earned", "Paid"] as const;

/**
 * Commission amount = commissionable amount × effective rate.
 * The commissionable amount is manual for now; `commissionable_source` lets a
 * later contract/estimate feed the same field without rebuilding this sheet.
 */
export function effectiveRate(project: Project, salesperson?: Profile) {
  const override = project.commission_rate_override;
  if (override !== null && override !== undefined) return Number(override);
  return Number(salesperson?.default_commission_rate ?? 0);
}

export function commissionAmount(project: Project, salesperson?: Profile) {
  const base = Number(project.commissionable_amount ?? 0);
  return (base * effectiveRate(project, salesperson)) / 100;
}

function CommissionsTab() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: profiles = [] } = useProfiles();
  const update = useUpdateAnyProject();

  const rows = projects.filter((p) => p.salesperson_user_id || p.commission_user_id);
  const personFor = (p: Project) =>
    profiles.find((x) => x.user_id === (p.commission_user_id ?? p.salesperson_user_id));

  const total = rows.reduce((sum, p) => sum + commissionAmount(p, personFor(p)), 0);

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Commission sheet</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Rate comes from the salesperson default in Settings unless the project overrides it.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Total commission
          </div>
          <div className="text-[16px] font-semibold tabular-nums">{money(total)}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-[13px] text-muted-foreground">Loading commissions…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No commissionable jobs yet"
          note="Assign a salesperson to a job and it appears on this sheet."
        />
      ) : (
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[22%]" />
            <col className="w-[17%]" />
            <col className="w-[11%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/60">
              {[
                "Salesperson",
                "Project",
                "Commissionable amount",
                "Rate",
                "Commission",
                "Status",
              ].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <CommissionRow
                key={p.id}
                project={p}
                salesperson={personFor(p)}
                onPatch={(patch) =>
                  update.mutate(
                    { id: p.id, patch },
                    { onSuccess: () => toast.success("Commission updated") },
                  )
                }
              />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function CommissionRow({
  project: p,
  salesperson,
  onPatch,
}: {
  project: Project;
  salesperson?: Profile;
  onPatch: (patch: Partial<Project>) => void;
}) {
  const [amount, setAmount] = useState(
    p.commissionable_amount === null || p.commissionable_amount === undefined
      ? ""
      : String(p.commissionable_amount),
  );
  const [rate, setRate] = useState(
    p.commission_rate_override === null || p.commission_rate_override === undefined
      ? ""
      : String(p.commission_rate_override),
  );
  const status = p.commission_status ?? "Pending";
  const rateUsed = effectiveRate(p, salesperson);

  return (
    <tr className="group transition-colors duration-100 hover:bg-muted/40">
      <Td className="group-last:border-0">
        <span className="text-[13px] font-semibold tracking-tight">
          {salesperson?.full_name ?? "Unassigned"}
        </span>
      </Td>
      <Td className="group-last:border-0">
        <Link
          to="/projects/$projectId"
          params={{ projectId: p.id }}
          className="text-[13px] font-medium hover:text-primary hover:underline"
        >
          {p.name}
        </Link>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{p.lifecycle_stage}</div>
      </Td>
      <Td className="group-last:border-0">
        <TextInput
          value={amount}
          inputMode="decimal"
          placeholder="0.00"
          className="h-8 text-right tabular-nums"
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() =>
            onPatch({ commissionable_amount: amount === "" ? null : Number(amount) })
          }
        />
      </Td>
      <Td className="group-last:border-0">
        <TextInput
          value={rate}
          inputMode="decimal"
          placeholder={`${rateUsed}%`}
          className="h-8 text-right tabular-nums"
          onChange={(e) => setRate(e.target.value)}
          onBlur={() =>
            onPatch({ commission_rate_override: rate === "" ? null : Number(rate) })
          }
        />
        <div className="mt-0.5 text-[10.5px] text-muted-foreground">
          {p.commission_rate_override === null || p.commission_rate_override === undefined
            ? "salesperson default"
            : "project override"}
        </div>
      </Td>
      <Td className="text-[13px] font-semibold tabular-nums group-last:border-0">
        {money(commissionAmount(p, salesperson))}
      </Td>
      <Td className="group-last:border-0">
        <span className="flex items-center gap-2">
          <Dot tone={status === "Paid" ? "green" : status === "Earned" ? "blue" : "neutral"} />
          <Select
            value={status}
            className="h-8 w-[120px]"
            onChange={(e) => onPatch({ commission_status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </span>
      </Td>
    </tr>
  );
}

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
