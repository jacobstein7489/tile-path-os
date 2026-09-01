import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { UnderlineTabs } from "@/components/kit";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsLayout,
});

const TABS = [
  { label: "Leads", to: "/leads" as const, value: "/leads" },
  { label: "Customers", to: "/leads/customers" as const, value: "/leads/customers" },
  { label: "Commissions", to: "/leads/commissions" as const, value: "/leads/commissions" },
];

function LeadsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = TABS.find((t) => pathname === t.value)?.value ?? "/leads";

  return (
    <PageShell
      crumbs={[{ label: "Leads" }]}
      title="Leads"
      subtitle="Pre-award work on the same job records — winning a lead simply moves the record forward."
    >
      <UnderlineTabs items={TABS} value={active} />
      <Outlet />
    </PageShell>
  );
}
