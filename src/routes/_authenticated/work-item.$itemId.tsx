import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { useWorkFeed } from "@/lib/workitems";

export const Route = createFileRoute("/_authenticated/work-item/$itemId")({
  head: () => ({
    meta: [
      { title: "Work Item — Cobblestone Tile OS" },
      { name: "description", content: "Review and move a Cobblestone work item forward." },
      { property: "og:title", content: "Work Item — Cobblestone Tile OS" },
      { property: "og:description", content: "Review and move a Cobblestone work item forward." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkItemPage,
});

function WorkItemPage() {
  const { itemId } = Route.useParams();
  const router = useRouter();
  const { data: items = [], isLoading } = useWorkFeed();
  const item = items.find((row) => row.id === itemId) ?? null;

  return (
    <>
      <AppHeader crumbs={[{ label: "Work", to: "/work" }, { label: item?.title ?? "Work item" }]} />
      <main className="min-h-[calc(100dvh-3.5rem)] px-4 py-5 pb-28 md:px-7 md:py-7">
        <div className="mx-auto mb-4 w-full max-w-[980px]">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
        </div>
        {isLoading ? (
          <p className="mx-auto max-w-[980px] text-sm text-muted-foreground">Loading work item…</p>
        ) : item ? (
          <WorkItemPanel item={item} />
        ) : (
          <div className="mx-auto max-w-[980px] rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold">This work item is no longer available.</p>
            <Link
              to="/work"
              className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Back to Work
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
