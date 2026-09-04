import { useMemo, useRef, useState } from "react";
import { Camera, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, Field, Select, TextInput } from "@/components/kit";
import { VoiceField } from "@/components/VoiceField";
import { useAreas, useCrews } from "@/lib/data";
import {
  suggestWorkItems,
  useSubmitFieldReport,
  type FieldReportInput,
  type SuggestedItem,
} from "@/lib/fieldreports";
import { TASK_CATEGORIES, useCreateWorkItems } from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Daily Field Report — the one form the site manager fills from the job.
 * Two steps only: fill it, then approve any work items it implies.
 */
export function FieldReportSheet({
  projectId,
  projectName,
  onClose,
  defaultCrewId = null,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  defaultCrewId?: string | null;
}) {
  const { data: crews = [] } = useCrews();
  const { data: areas = [] } = useAreas(projectId);
  const submit = useSubmitFieldReport();
  const createItems = useCreateWorkItems();
  const photoInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"report" | "review">("report");
  const [form, setForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    crew_id: defaultCrewId ?? "",
    worker_count: 2,
    areas: [] as string[],
    areas_other: "",
    progress_note: "",
    blockers: "",
    material_needed: "",
    next_work: "",
    notes: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const payload: FieldReportInput = useMemo(() => {
    const areaText = [...form.areas, form.areas_other.trim()].filter(Boolean).join(", ");
    return {
      project_id: projectId,
      report_date: form.report_date,
      crew_id: form.crew_id || null,
      crew_label: crews.find((c) => c.id === form.crew_id)?.name ?? null,
      worker_count: form.worker_count,
      areas_worked: areaText || null,
      progress_note: form.progress_note.trim() || null,
      blockers: form.blockers.trim() || null,
      material_needed: form.material_needed.trim() || null,
      next_work: form.next_work.trim() || null,
      notes: form.notes.trim() || null,
    };
  }, [form, crews, projectId]);

  const goReview = () => {
    const found = suggestWorkItems(payload);
    if (!found.length) {
      void save([]);
      return;
    }
    setSuggestions(found);
    setStep("review");
  };

  const save = async (approved: SuggestedItem[]) => {
    try {
      const reportId = await submit.mutateAsync({ input: payload, photos });
      const keep = approved.filter((s) => s.keep && s.title.trim());
      if (keep.length) {
        await createItems.mutateAsync(
          keep.map((s) => ({
            project_id: projectId,
            item_type: s.category === "Material / Order" ? "Install Material Need" : "Task",
            title: s.title.trim(),
            category: s.category,
            waiting_on: s.waiting_on,
            status: s.waiting_on ? "Waiting" : "Open",
            source_field_report_id: reportId,
          })),
        );
      }
      toast.success(
        keep.length
          ? `Report submitted · ${keep.length} task${keep.length > 1 ? "s" : ""} created`
          : "Report submitted",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the report");
    }
  };

  const pending = submit.isPending || createItems.isPending;

  return (
    <Drawer
      open
      onClose={onClose}
      title={step === "report" ? "Daily field report" : "Anything to follow up?"}
      subtitle={`${projectName} · ${new Date(form.report_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
      footer={
        step === "report" ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={goReview} loading={pending}>
              <Check className="size-4" /> Submit report
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep("report")}>Back</Button>
            <Button variant="primary" onClick={() => void save(suggestions)} loading={pending}>
              <Check className="size-4" /> Submit report
            </Button>
          </>
        )
      }
    >
      {step === "report" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <TextInput
                type="date"
                value={form.report_date}
                onChange={(e) => set("report_date", e.target.value)}
              />
            </Field>
            <Field label="Crew / installer">
              <Select value={form.crew_id} onChange={(e) => set("crew_id", e.target.value)}>
                <option value="">Not set</option>
                {crews
                  .filter((c) => !c.is_open_lane)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Workers on site
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="One fewer worker"
                onClick={() => set("worker_count", Math.max(0, form.worker_count - 1))}
                className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border bg-background active:scale-95"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center text-[22px] font-bold tabular-nums">
                {form.worker_count}
              </span>
              <button
                type="button"
                aria-label="One more worker"
                onClick={() => set("worker_count", form.worker_count + 1)}
                className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border bg-background active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Areas worked
            </span>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => {
                const on = form.areas.includes(a.name);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "areas",
                        on ? form.areas.filter((n) => n !== a.name) : [...form.areas, a.name],
                      )
                    }
                    className={cn(
                      "min-h-10 cursor-pointer rounded-xl border px-3 text-[13px] font-semibold transition-colors duration-150",
                      on
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border bg-background text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
            <TextInput
              className="mt-2"
              value={form.areas_other}
              placeholder={areas.length ? "Other areas…" : "Which areas were worked?"}
              onChange={(e) => set("areas_other", e.target.value)}
            />
          </div>

          <VoiceField
            label="Progress today"
            value={form.progress_note}
            onChange={(v) => set("progress_note", v)}
            placeholder="What got done."
            rows={3}
          />
          <VoiceField
            label="Blockers / waiting"
            value={form.blockers}
            onChange={(v) => set("blockers", v)}
            placeholder="Waiting on the GC to finish the windows."
          />
          <VoiceField
            label="Material needed"
            value={form.material_needed}
            onChange={(v) => set("material_needed", v)}
            placeholder="Need 4 more bags of grout."
          />
          <VoiceField
            label="Tomorrow / next work"
            value={form.next_work}
            onChange={(v) => set("next_work", v)}
            placeholder="Continue master bath floor."
          />
          <VoiceField
            label="Notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            placeholder="Anything else worth recording."
          />

          <div>
            <span className="mb-1.5 block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Photos / video
            </span>
            <input
              ref={photoInput}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])]);
                e.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-[13.5px] font-semibold text-primary active:scale-[0.99]"
            >
              <Camera className="size-4" /> Add photos or a short video
            </button>
            {photos.length ? (
              <ul className="mt-2 space-y-1.5">
                {photos.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-[12.5px]"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-background"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            From what you wrote, these tasks look worth tracking. Nothing is created until you
            submit — untick anything you do not want.
          </p>
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={s.keep}
                  onChange={(e) =>
                    setSuggestions((list) =>
                      list.map((x, idx) => (idx === i ? { ...x, keep: e.target.checked } : x)),
                    )
                  }
                  className="mt-1 size-5 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <TextInput
                    value={s.title}
                    onChange={(e) =>
                      setSuggestions((list) =>
                        list.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                  />
                </span>
              </label>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Select
                  value={s.category}
                  onChange={(e) =>
                    setSuggestions((list) =>
                      list.map((x, idx) => (idx === i ? { ...x, category: e.target.value } : x)),
                    )
                  }
                >
                  {TASK_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <TextInput
                  value={s.waiting_on ?? ""}
                  placeholder="Waiting on (optional)"
                  onChange={(e) =>
                    setSuggestions((list) =>
                      list.map((x, idx) =>
                        idx === i ? { ...x, waiting_on: e.target.value || null } : x,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
