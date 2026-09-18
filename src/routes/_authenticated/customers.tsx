import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { CustomersWorkspace } from "@/components/customers/CustomersWorkspace";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Customer relationships, active projects, contacts and open actions.",
      },
      { property: "og:title", content: "Customers — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Customer relationships, active projects, contacts and open actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <>
      <AppHeader crumbs={[{ label: "Customers" }]} />
      <CustomersWorkspace />
    </>
  );
}
