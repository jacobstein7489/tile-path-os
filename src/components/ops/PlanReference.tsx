import { useState } from "react";
import { FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button, Drawer, Field, Select, TextInput } from "@/components/kit";
import { useUpdateRow, type Area } from "@/lib/data";
import { useProjectFiles } from "@/lib/setup";

/**
 * Lightweight plan reference on a room: which plan file, which page, and a
 * rough location note / pin. No CAD, no plan recognition — just a durable
 * reference a future layout integration can build on.
 */
export function PlanReference({
  projectId,
  area,
  canEdit,
}: {
  projectId: string;
  area: Area & { plan_file_id?: string | null; plan_page?: number | null; plan_location?: unknown };
  canEdit: boolean;
}) {
  const files = useProjectFiles(projectId);
  const updateArea = useUpdateRow("project_areas");
  const [open, setOpen] = useState(false);
  const fileList = files.data ?? [];
  const file = fileList.find((f) => f.id === area.plan_file_id) ?? null;
  const location = (area.plan_location ?? null) as { note?: string } | null;

  const openPlan = async () => {
    if (!file) return;
    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(file.storage_path, 300);
    if (error || !data) {
      toast.error("Could not open that plan");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-3.5" />
          {file ? (
            <button type="button" onClick={openPlan} className="font-semibold text-primary hover:underline">
              {file.filename}
              {area.plan_page ? ` · p.${area.plan_page}` : ""}
            </button>
          ) : (
            "No plan linked to this room"
          )}
        </span>
        {location?.note ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {location.note}
          </span>
        ) : null}
        <Button size="sm" disabled={!canEdit} onClick={() => setOpen(true)}>
          {file ? "Change" : "Link plan"}
        </Button>
      </div>

      {open ? (
        <Drawer open onClose={() => setOpen(false)} title="Link this room to the plan" subtitle={area.name}>
          <div className="space-y-4">
            <Field label="Plan or scope file">
              <Select
                defaultValue={area.plan_file_id ?? ""}
                onChange={(e) =>
                  updateArea.mutate({
                    id: area.id,
                    patch: { plan_file_id: e.target.value || null },
                  })
                }
              >
                <option value="">Not linked</option>
                {fileList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.filename}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Page">
              <TextInput
                type="number"
                defaultValue={area.plan_page ?? ""}
                onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  updateArea.mutate({
                    id: area.id,
                    patch: { plan_page: e.target.value ? Number(e.target.value) : null },
                  })
                }
              />
            </Field>
            <Field label="Where on the plan (rough note or pin)">
              <TextInput
                defaultValue={location?.note ?? ""}
                placeholder="Second floor, rear left of the hallway"
                onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  updateArea.mutate({
                    id: area.id,
                    patch: {
                      plan_location: e.target.value ? { note: e.target.value } : null,
                    },
                  })
                }
              />
            </Field>
            {fileList.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                Upload the plan on the Files tab first.
              </p>
            ) : null}
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
