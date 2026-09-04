import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentActorName } from "@/lib/workitems";

/* ============================================================
 * Daily Field Report.
 * One row per job per day, submitted from the phone in under a
 * minute. Reports are project history and can spawn work items.
 * ============================================================ */

export type FieldReport = {
  id: string;
  project_id: string;
  report_date: string;
  crew_id: string | null;
  crew_label: string | null;
  worker_count: number | null;
  areas_worked: string | null;
  progress_note: string | null;
  blockers: string | null;
  material_needed: string | null;
  next_work: string | null;
  notes: string | null;
  submitted_by: string | null;
  submitted_by_name: string | null;
  created_at: string;
  projects?: { name: string } | null;
};

export type FieldReportInput = {
  project_id: string;
  report_date: string;
  crew_id?: string | null;
  crew_label?: string | null;
  worker_count?: number | null;
  areas_worked?: string | null;
  progress_note?: string | null;
  blockers?: string | null;
  material_needed?: string | null;
  next_work?: string | null;
  notes?: string | null;
};

const KEY = ["field_reports"];

export function useFieldReports(projectId?: string) {
  return useQuery({
    queryKey: [...KEY, projectId ?? "all"],
    queryFn: async (): Promise<FieldReport[]> => {
      let q = supabase
        .from("field_reports")
        .select("*, projects(name)")
        .order("report_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FieldReport[];
    },
  });
}

export function useSubmitFieldReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, photos }: { input: FieldReportInput; photos?: File[] }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      const { data, error } = await supabase
        .from("field_reports")
        .insert({
          ...input,
          submitted_by: userId,
          submitted_by_name: await currentActorName(),
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const reportId = (data as { id: string }).id;

      // Photos and short clips ride along as normal project files.
      for (const file of photos ?? []) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${input.project_id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) throw upErr;
        const { error: recErr } = await supabase.from("project_files").insert({
          project_id: input.project_id,
          field_report_id: reportId,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          kind: file.type.startsWith("video/") ? "Video" : "Photo",
          uploaded_by: userId,
        } as never);
        if (recErr) throw recErr;
      }
      return reportId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["project-files"] });
    },
  });
}

/** The newest report per project, for "Latest field update" on a job. */
export function latestReportByProject(reports: FieldReport[]) {
  const map = new Map<string, FieldReport>();
  for (const r of reports) if (!map.has(r.project_id)) map.set(r.project_id, r);
  return map;
}

export type SuggestedItem = {
  title: string;
  category: string;
  waiting_on: string | null;
  keep: boolean;
};

const WAITING_HINT =
  /waiting (?:on|for) ([a-z0-9 .'&/-]{2,40})|until ([a-z0-9 .'&/-]{2,40}) (?:finish|complete)/i;

/**
 * Turn the report's blocker / material / next-work text into proposed work
 * items. Nothing is ever created silently — the user reviews this list.
 */
export function suggestWorkItems(input: FieldReportInput): SuggestedItem[] {
  const out: SuggestedItem[] = [];
  const split = (text?: string | null) =>
    (text ?? "")
      .split(/\n|(?:[.;]\s+)|,\s+(?=need|waiting|order|get|confirm)/i)
      .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
      .filter((s) => s.length > 2);

  for (const line of split(input.material_needed)) {
    out.push({
      title: /order|buy|pick up|need/i.test(line) ? line : `Order ${line}`,
      category: "Material / Order",
      waiting_on: null,
      keep: true,
    });
  }

  for (const line of split(input.blockers)) {
    const m = WAITING_HINT.exec(line);
    const who = (m?.[1] ?? m?.[2] ?? "").trim();
    out.push({
      title: line,
      category: who ? "Follow Up / Confirm" : "Punch / Repair",
      waiting_on: who || null,
      keep: true,
    });
  }

  for (const line of split(input.next_work)) {
    if (!/confirm|schedule|order|need|verify|measure/i.test(line)) continue;
    out.push({
      title: line,
      category: /schedul/i.test(line) ? "Schedule / Crew" : "Follow Up / Confirm",
      waiting_on: null,
      keep: false,
    });
  }

  return out.slice(0, 8);
}
