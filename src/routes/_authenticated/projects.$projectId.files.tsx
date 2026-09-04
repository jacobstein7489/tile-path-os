import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, SectionCard, Table, TableSkeleton, Td, Th } from "@/components/kit";
import { useAuthUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ProjectFile = {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/projects/$projectId/files")({
  head: () => ({
    meta: [
      { title: "Project Files — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Secure project plans, specifications, photos and documents.",
      },
      { property: "og:title", content: "Project Files — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Secure project plans, specifications, photos and documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FilesTab,
});

function FilesTab() {
  const { projectId } = Route.useParams();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const files = useQuery({
    queryKey: ["project-files", projectId],
    queryFn: async (): Promise<ProjectFile[]> => {
      const { data, error } = await supabase
        .from("project_files")
        .select("id,storage_path,filename,mime_type,size_bytes,kind,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectFile[];
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sign in before uploading a file.");
      if (file.size > 25 * 1024 * 1024) throw new Error("Files must be 25 MB or smaller.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (storageError) throw storageError;
      const { error: recordError } = await supabase.from("project_files").insert({
        project_id: projectId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        kind: file.type.startsWith("image/") ? "Photo" : "Document",
        uploaded_by: user.id,
      });
      if (recordError) throw recordError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-files", projectId] });
      toast.success("File uploaded securely");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Upload failed"),
  });

  const openFile = async (file: ProjectFile) => {
    setDownloading(file.id);
    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(file.storage_path, 60);
    setDownloading(null);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "File could not be opened");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <SectionCard
      title="Files"
      subtitle="Plans, specifications, photos and project documents. Access follows project permissions."
      icon={<FileText className="size-[18px] text-primary" />}
      actions={
        <>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.currentTarget.value = "";
            }}
          />
          <Button
            size="sm"
            variant="primary"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" /> Upload file
          </Button>
        </>
      }
    >
      {files.isLoading ? (
        <TableSkeleton cols={4} />
      ) : (files.data ?? []).length === 0 ? (
        <EmptyState
          title="No files yet"
          note="Upload the first plan, specification, photo or project document."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>File</Th>
              <Th>Type</Th>
              <Th>Uploaded</Th>
              <Th align="right">Open</Th>
            </tr>
          </thead>
          <tbody>
            {(files.data ?? []).map((file) => (
              <tr key={file.id}>
                <Td>
                  <div className="font-semibold">{file.filename}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {formatBytes(file.size_bytes)}
                  </div>
                </Td>
                <Td>{file.kind}</Td>
                <Td>{new Date(file.created_at).toLocaleDateString()}</Td>
                <Td align="right">
                  <Button
                    size="sm"
                    loading={downloading === file.id}
                    onClick={() => void openFile(file)}
                  >
                    <Download className="size-3.5" /> Open
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "Size unavailable";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
