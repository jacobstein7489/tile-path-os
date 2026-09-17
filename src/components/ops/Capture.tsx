import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Building2, Check, Mic, Search, Square, Star, X } from "lucide-react";
import { toast } from "sonner";
import { OwnerPicker } from "@/components/ops/OwnerPicker";
import { DatePicker } from "@/components/ops/DatePicker";
import { useProjects } from "@/lib/data";
import { useCreateWorkItems, useSaveWorkItem, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Capture asks two questions and nothing else: which job, and what needs to
 * happen. Everything optional appears only after the task already exists.
 */
export function Capture({
  open,
  onClose,
  projectId,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
  projectName?: string | null;
}) {
  const { data: projects = [] } = useProjects();
  const create = useCreateWorkItems();
  const save = useSaveWorkItem();

  const [step, setStep] = useState<"project" | "task" | "created">(projectId ? "task" : "project");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<{ id: string | null; name: string } | null>(
    projectId ? { id: projectId, name: projectName ?? "This project" } : null,
  );
  const [title, setTitle] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdPatch, setCreatedPatch] = useState<Partial<WorkItemRow>>({});
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setStep(projectId ? "task" : "project");
    setChosen(projectId ? { id: projectId, name: projectName ?? "This project" } : null);
    setQuery("");
    setTitle("");
    setCreatedId(null);
    setCreatedPatch({});
  }, [open, projectId, projectName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      rec.current?.stop?.();
    };
  }, [open, onClose]);

  const active = useMemo(
    () => projects.filter((p) => !p.archived_at && p.exception_state !== "Lost"),
    [projects],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active.slice(0, 4);
    return active
      .filter((p) =>
        `${p.name} ${p.address ?? ""} ${p.customer ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 7);
  }, [active, query]);

  const dictate = () => {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Dictation is not available on this device");
      return;
    }
    if (listening) {
      rec.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      setTitle((prev) => (prev ? `${prev.trim()} ${text.trim()}` : text.trim()));
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  const submit = async () => {
    const text = title.trim();
    if (!text) return;
    const ids = await create.mutateAsync([
      {
        project_id: chosen?.id ?? null,
        item_type: "Task",
        title: text,
        status: "Open",
      },
    ]);
    setCreatedId(ids[0] ?? null);
    setStep("created");
  };

  const patchCreated = (values: Partial<WorkItemRow>) => {
    if (!createdId) return;
    setCreatedPatch((prev) => ({ ...prev, ...values }));
    save.mutate({ id: createdId, patch: values });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/35 backdrop-blur-[2px] md:items-start md:p-6">
      <div className="flex h-full w-full flex-col rounded-none bg-card md:mt-[10vh] md:h-auto md:max-w-[600px] md:rounded-2xl md:border md:border-border md:shadow-[var(--shadow-raised)]">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 md:px-5">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
              Capture
            </div>
            {chosen ? (
              <div className="truncate text-[15px] font-bold tracking-[-0.01em]">{chosen.name}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-5">
          {step === "project" ? (
            <>
              <h2 className="text-[22px] leading-tight font-bold tracking-[-0.02em]">
                Which project?
              </h2>
              <div className="relative mt-3">
                <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing — 114, Park Place…"
                  className="h-12 w-full rounded-xl border border-border bg-background pr-3 pl-10 text-[16px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div className="mt-2">
                {!query ? (
                  <div className="px-1 py-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Recent
                  </div>
                ) : null}
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setChosen({ id: p.id, name: p.name });
                      setStep("task");
                    }}
                    className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                      {p.address ? (
                        <span className="block truncate text-[12.5px] text-muted-foreground">
                          {p.address}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {query && !matches.length ? (
                  <p className="px-2 py-3 text-[13.5px] text-muted-foreground">
                    No job matches “{query}”.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setChosen({ id: null, name: "Company / no project" });
                    setStep("task");
                  }}
                  className="mt-1 flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-left text-[14px] font-medium text-muted-foreground hover:bg-muted"
                >
                  <Building2 className="size-4" /> Not about one job
                </button>
              </div>
            </>
          ) : null}

          {step === "task" ? (
            <>
              <h2 className="text-[22px] leading-tight font-bold tracking-[-0.02em]">
                What needs to happen?
              </h2>
              <div className="relative mt-3">
                <textarea
                  autoFocus
                  rows={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder="Follow up with Millie about niche material"
                  className="w-full rounded-xl border border-border bg-background py-3 pr-14 pl-3.5 text-[16px] leading-snug outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={dictate}
                  aria-label="Dictate"
                  aria-pressed={listening}
                  className={cn(
                    "absolute top-2.5 right-2.5 grid size-10 cursor-pointer place-items-center rounded-xl border transition-colors duration-150",
                    listening
                      ? "border-danger/40 bg-danger-soft text-danger"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
                </button>
              </div>
              <button
                type="button"
                disabled={!title.trim() || create.isPending}
                onClick={() => void submit()}
                className="mt-4 flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-xl bg-primary text-[15.5px] font-semibold text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary/90 disabled:opacity-45"
              >
                Create task
              </button>
              {!projectId ? (
                <button
                  type="button"
                  onClick={() => setStep("project")}
                  className="mt-3 min-h-9 cursor-pointer text-[13px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Change project
                </button>
              ) : null}
            </>
          ) : null}

          {step === "created" ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-success text-primary-foreground">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <h2 className="text-[20px] font-bold tracking-[-0.02em]">Task created</h2>
              </div>
              <p className="mt-2 text-[14px] text-muted-foreground">{title}</p>

              <div className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
                <div className="flex min-h-[54px] items-center justify-between gap-3 px-3">
                  <span className="text-[13px] font-medium text-muted-foreground">Assign</span>
                  <OwnerPicker
                    ownerUserId={(createdPatch.owner_user_id as string | null) ?? null}
                    size="md"
                    onChange={(id, name) => patchCreated({ owner_user_id: id, owner: name })}
                  />
                </div>
                <div className="flex min-h-[54px] items-center justify-between gap-3 px-3">
                  <span className="text-[13px] font-medium text-muted-foreground">Date</span>
                  <DatePicker
                    value={(createdPatch.due_date as string | null) ?? null}
                    size="md"
                    onChange={(next) => patchCreated({ due_date: next })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => patchCreated({ is_important: !createdPatch.is_important })}
                  className="flex min-h-[54px] w-full cursor-pointer items-center justify-between gap-3 px-3 text-left hover:bg-muted"
                >
                  <span className="text-[13px] font-medium text-muted-foreground">Important</span>
                  <Star
                    className={cn(
                      "mr-2 size-[18px]",
                      createdPatch.is_important
                        ? "fill-warning text-warning"
                        : "text-border-strong",
                    )}
                  />
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-2.5 md:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setTitle("");
                    setCreatedId(null);
                    setCreatedPatch({});
                    setStep("task");
                  }}
                  className="min-h-[46px] flex-1 cursor-pointer rounded-xl border border-border bg-background text-[14.5px] font-semibold hover:bg-muted"
                >
                  Add another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[46px] flex-1 cursor-pointer rounded-xl bg-primary text-[14.5px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
