import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Clock, Wallet } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button, Drawer, Select, TextInput } from "@/components/kit";
import { StatCard } from "@/components/ops/StatCards";
import { DatePicker } from "@/components/ops/DatePicker";
import { Chip } from "@/lib/status";
import { useProjects, useUpdateAnyProject } from "@/lib/data";
import { useProfiles } from "@/lib/people";
import { usePermissions } from "@/hooks/useAuth";
import {
  COMMISSION_STATUSES,
  calcTypeLabel,
  earnedFor,
  money,
  planDescription,
  snapshotOf,
  useCommissionPayments,
  useCommissionPlans,
  useRecordPayment,
} from "@/lib/commissions";
import { humanDate, today } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/commissions")({
  head: () => ({
    meta: [
      { title: "Commissions — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Management commission sheet: what each salesperson has earned, what is approved, what has been paid and what is still outstanding.",
      },
      { property: "og:title", content: "Commissions — Cobblestone Job Operations" },
      {
        property: "og:description",
        content: "Earned, approved and paid commission by job and salesperson.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommissionsPage,
});

function CommissionsPage() {
  const { data: projects = [] } = useProjects();
  const { data: profiles = [] } = useProfiles();
  const { data: plans = [] } = useCommissionPlans();
  const { data: payments = [] } = useCommissionPayments();
  const { canSeeMoney } = usePermissions();
  const update = useUpdateAnyProject();
  const recordPayment = useRecordPayment();

  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState<string | null>(today());

  const nameOf = (id: string | null | undefined) =>
    profiles.find((p) => p.user_id === id)?.full_name ?? null;

  const rows = useMemo(
    () =>
      projects
        .filter((p) => !p.archived_at)
        .filter((p) => p.commission_plan_snapshot || p.salesperson_user_id || p.commission_user_id)
        .map((p) => {
          const paid = payments
            .filter((pay) => pay.project_id === p.id)
            .reduce((sum, pay) => sum + Number(pay.amount), 0);
          const earned = earnedFor(p);
          return {
            project: p,
            salesperson: nameOf(p.commission_user_id ?? p.salesperson_user_id),
            salespersonId: p.commission_user_id ?? p.salesperson_user_id ?? null,
            snapshot: p.commission_plan_snapshot ?? null,
            basis: p.commissionable_amount ?? null,
            earned,
            paid,
            balance: earned === null ? null : earned - paid,
            status: p.commission_status ?? "Pending",
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, payments, profiles],
  );

  const filtered = rows.filter(
    (r) =>
      (person === "all" || r.salespersonId === person) &&
      (status === "all" || r.status === status),
  );

  const totals = {
    pending: rows
      .filter((r) => r.status === "Pending")
      .reduce((s, r) => s + (r.earned ?? 0), 0),
    approved: rows
      .filter((r) => r.status === "Approved")
      .reduce((s, r) => s + (r.balance ?? 0), 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
  };

  const openRow = filtered.find((r) => r.project.id === openId) ?? null;

  if (!canSeeMoney) {
    return (
      <PageShell crumbs={[{ label: "Commissions" }]} title="Commissions">
        <div className="surface p-8 text-center text-[14px] text-muted-foreground">
          Commission information is limited to management.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      crumbs={[{ label: "Commissions" }]}
      title="Commissions"
      subtitle="Management only. Earned figures come from the plan snapshot saved on each job."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Pending"
          tone="amber"
          value={money(totals.pending)}
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Approved / due"
          tone="blue"
          value={money(totals.approved)}
          icon={<BadgeCheck className="size-4" />}
        />
        <StatCard
          label="Paid"
          tone="green"
          value={money(totals.paid)}
          icon={<Wallet className="size-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Salesperson"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="w-auto"
        >
          <option value="all">All salespeople</option>
          {profiles.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.full_name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          {COMMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="surface overflow-hidden">
        {!filtered.length ? (
          <p className="px-5 py-10 text-center text-[14px] text-muted-foreground">
            No commissions yet. Pick a salesperson and a commission plan when a job is signed.
          </p>
        ) : (
          <>
            {/* Desktop: financial reporting reads best as a table. */}
            <table className="hidden w-full md:table">
              <thead className="border-b border-border bg-muted/60">
                <tr>
                  {["Project", "Salesperson", "Plan", "Basis", "Earned", "Paid", "Balance", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[12px] font-semibold whitespace-nowrap text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.project.id}
                    onClick={() => setOpenId(r.project.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/70 text-[13.5px] transition-colors duration-150 last:border-0 hover:bg-muted/60",
                      openId === r.project.id && "bg-primary-soft/50",
                    )}
                  >
                    <td className="px-3 py-3 font-semibold">{r.project.name}</td>
                    <td className="px-3 py-3">{r.salesperson ?? "—"}</td>
                    <td className="px-3 py-3">{r.snapshot?.name ?? "No plan"}</td>
                    <td className="px-3 py-3 tabular-nums">{money(r.basis)}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">
                      {r.earned === null ? (
                        <span className="text-warning">Pending amount</span>
                      ) : (
                        money(r.earned)
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{money(r.paid)}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.balance === null ? "—" : money(r.balance)}
                    </td>
                    <td className="px-3 py-3">
                      <Chip
                        tone={
                          r.status === "Paid" ? "green" : r.status === "Approved" ? "blue" : "amber"
                        }
                      >
                        {r.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone: the same rows as cards. */}
            <div className="divide-y divide-border md:hidden">
              {filtered.map((r) => (
                <button
                  key={r.project.id}
                  type="button"
                  onClick={() => setOpenId(r.project.id)}
                  className="w-full cursor-pointer px-4 py-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-bold">{r.project.name}</span>
                    <Chip
                      tone={
                        r.status === "Paid" ? "green" : r.status === "Approved" ? "blue" : "amber"
                      }
                    >
                      {r.status}
                    </Chip>
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {r.salesperson ?? "No salesperson"} · {r.snapshot?.name ?? "No plan"}
                  </div>
                  <div className="mt-1.5 text-[14px] font-semibold tabular-nums">
                    {r.earned === null ? "Pending amount" : money(r.earned)}
                    <span className="ml-2 text-[12.5px] font-medium text-muted-foreground">
                      paid {money(r.paid)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Drawer
        open={Boolean(openRow)}
        onClose={() => setOpenId(null)}
        title={openRow?.project.name ?? ""}
        subtitle={openRow ? `${openRow.salesperson ?? "No salesperson"} · ${openRow.status}` : ""}
      >
        {openRow ? (
          <div className="space-y-5">
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              <DetailRow label="Plan" value={openRow.snapshot?.name ?? "No plan"} />
              <DetailRow
                label="Calculation"
                value={
                  openRow.snapshot
                    ? `${calcTypeLabel(openRow.snapshot.calc_type)} · ${planDescription(openRow.snapshot)}`
                    : "—"
                }
              />
              <DetailRow label="Basis" value={money(openRow.basis)} />
              <DetailRow
                label="Earned"
                value={openRow.earned === null ? "Pending amount" : money(openRow.earned)}
              />
              <DetailRow label="Paid" value={money(openRow.paid)} />
              <DetailRow
                label="Balance"
                value={openRow.balance === null ? "—" : money(openRow.balance)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {COMMISSION_STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={openRow.status === s ? "primary" : "secondary"}
                  onClick={() =>
                    update.mutate({ id: openRow.project.id, patch: { commission_status: s } })
                  }
                >
                  {s}
                </Button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-muted/50 p-3">
              <h3 className="mb-2 text-[13px] font-bold">Record a payment</h3>
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  inputMode="decimal"
                  placeholder="Amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-32"
                />
                <DatePicker value={payDate} onChange={setPayDate} size="md" align="left" />
                <Button
                  size="sm"
                  disabled={!Number(payAmount) || !payDate}
                  onClick={() => {
                    recordPayment.mutate({
                      project_id: openRow.project.id,
                      amount: Number(payAmount),
                      paid_on: payDate!,
                    });
                    setPayAmount("");
                  }}
                >
                  Save payment
                </Button>
              </div>
              <ul className="mt-3 space-y-1.5">
                {payments
                  .filter((p) => p.project_id === openRow.project.id)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{humanDate(p.paid_on)}</span>
                      <span className="font-semibold tabular-nums">{money(Number(p.amount))}</span>
                    </li>
                  ))}
              </ul>
            </div>

            {plans.length ? (
              <div>
                <h3 className="mb-2 text-[13px] font-bold">Correct the plan</h3>
                <Select
                  value={openRow.snapshot?.plan_id ?? ""}
                  onChange={(e) => {
                    const plan = plans.find((p) => p.id === e.target.value);
                    update.mutate({
                      id: openRow.project.id,
                      patch: plan
                        ? {
                            commission_plan_id: plan.id,
                            commission_plan_snapshot: snapshotOf(plan),
                          }
                        : { commission_plan_id: null, commission_plan_snapshot: null },
                    });
                  }}
                >
                  <option value="">No commission</option>
                  {plans
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {planDescription(p)}
                      </option>
                    ))}
                </Select>
              </div>
            ) : null}

            <Link
              to="/projects/$projectId"
              params={{ projectId: openRow.project.id }}
              className="inline-block text-[13.5px] font-semibold text-primary hover:underline"
            >
              Open project →
            </Link>
          </div>
        ) : null}
      </Drawer>
    </PageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[46px] items-center justify-between gap-3 bg-card px-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}
