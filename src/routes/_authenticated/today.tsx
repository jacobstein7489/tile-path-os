import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { QuickCapture } from "@/components/QuickCapture";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { Button, Checkbox, EmptyState, KpiCard, SectionCard } from "@/components/kit";
import { Chip } from "@/lib/status";
import {
  isComplete,
  statusTone,
  useSaveWorkItem,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Your work for today: the work items you own, their status and the next action for each one.",
      },
      { property: "og:title", content: "Today — Cobblestone Tile OS" },
      { property: "og:description", content: "The work items you own today and the next action." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const save = useSaveWorkItem();
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [capture, setCapture] = useState(false);
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});

  const mine = useMemo(
    () => items.filter((i) => i.owner_user_id ? i.owner_user_id === user?.id : i.owner === profile?.full_name),
    [items, profile?.full_name, user?.id],
  );
  const open = mine.filter((i) => !isComplete(i) || justDone[i.id]);
  const completed = mine.filter((i) => isComplete(i) && !justDone[i.id]);
  const blocked = mine.filter((i) => !isComplete(i) && (i.waiting_on || i.status === "Waiting"));

  useEffect(() => {
    const keys = Object.keys(justDone);
    if (!keys.length) return;
    const t = setTimeout(() => setJustDone({}), 4500);
    return () => clearTimeout(t);
  }, [justDone]);

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  const toggle = async (item: WorkItemRow, next: boolean) => {
    await save.mutateAsync({
      id: item.id,
      patch: next
        ? { status: "Complete", completed_at: new Date().toISOString() }
        : { status: "Open", completed_at: null },
      note: next ? "Marked complete" : "Reopened",
    });
    if (next) {
      setJustDone((s) => ({ ...s, [item.id]: true }));
      toast.success("Marked complete");
    } else {
      setJustDone((s) => {
        const { [item.id]: _drop, ...rest } = s;
        return rest;
      });
      toast.success("Item restored");
    }
  };

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} viewLabel="SITE MANAGER VIEW" />
      <div className="mx-auto max-w-7xl px-8 pt-8 pb-16">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">
          Good morning, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Here is your work for today.</p>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard
                icon={<CheckCircle2 className="size-5" />}
                tone="green"
                label="Completed"
                value={completed.length}
              />
              <KpiCard
                icon={<Clock className="size-5" />}
                tone="blue"
                label="Remaining"
                value={open.filter((i) => !isComplete(i)).length}
              />
              <KpiCard
                icon={<AlertTriangle className="size-5" />}
                tone="amber"
                label="Waiting"
                value={blocked.length}
              />
            </div>

            <SectionCard title="Today's work" subtitle="The same records the company sees.">
              {isLoading ? (
                <div className="px-5 py-8 text-[13px] text-muted-foreground">Loading…</div>
              ) : open.length === 0 ? (
                <EmptyState
                  title="You're clear"
                  note="Nothing assigned to you is open right now."
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {open.map((i) => {
                    const done = isComplete(i);
                    return (
                      <li
                        key={i.id}
                        className={cn(
                          "group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40",
                          done && "bg-success-soft/40",
                        )}
                      >
                        <Checkbox checked={done} onChange={(next) => toggle(i, next)} />
                        <button
                          type="button"
                          onClick={() => setActive(i)}
                          className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        >
                          <span className="w-[150px] shrink-0 truncate text-[13px] font-semibold text-primary">
                            {i.projects?.name ?? "—"}
                          </span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[13px]",
                              done && "text-muted-foreground line-through",
                            )}
                          >
                            {i.title}
                          </span>
                          <span className="shrink-0">
                            <Chip tone={statusTone(i.status)}>{i.status}</Chip>
                          </span>
                          <span className="w-[160px] shrink-0 truncate text-right text-[13px] font-medium text-primary">
                            {done ? "" : (i.next_action ?? "Open item")}
                          </span>
                        </button>
                        {done ? (
                          <span className="flex shrink-0 items-center gap-2 text-[12.5px] font-semibold text-success">
                            Completed
                            <button
                              type="button"
                              onClick={() => toggle(i, false)}
                              className="text-primary underline"
                            >
                              Undo
                            </button>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            {completed.length ? (
              <SectionCard title={`Completed (${completed.length})`}>
                <ul className="divide-y divide-border/70">
                  {completed.map((i) => (
                    <li
                      key={i.id}
                      className="group flex items-center gap-4 px-5 py-2.5 hover:bg-muted/40"
                    >
                      <Checkbox checked onChange={() => toggle(i, false)} />
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <span className="w-[150px] shrink-0 truncate text-[13px] font-medium text-muted-foreground line-through">
                          {i.projects?.name ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground line-through">
                          {i.title}
                        </span>
                        <span className="shrink-0 text-[12.5px] font-semibold text-success">
                          ✓ Completed
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}
          </div>

          <aside className="space-y-3">
            <SectionCard title="Quick Actions">
              <div className="space-y-2.5 px-4 pt-1 pb-4">
                <Button variant="primary" className="w-full" onClick={() => setCapture(true)}>
                  <Plus className="size-4" /> Quick Capture
                </Button>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Log anything from a site visit, call or message. It becomes a real work item on the
                  company board and on the project.
                </p>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </>
  );
}
