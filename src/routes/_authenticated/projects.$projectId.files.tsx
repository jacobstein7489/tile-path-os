import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, LinkIcon, Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  Field,
  InfoBanner,
  Modal,
  SectionCard,
  Table,
  Td,
  Th,
  TextInput,
} from "@/components/kit";
import { useInsertRow, useWorkItems, type WorkItemFull } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/files")({
  component: FilesTab,
});

/**
 * File storage is not enabled yet. Until it is, this tab keeps a real,
 * persistent register of document references (plan sets, spec sheets, shared
 * drive links) as structured project records.
 */
function FilesTab() {
  const { projectId } = Route.useParams();
  const { data: items = [] } = useWorkItems(projectId);
  const insert = useInsertRow("work_items");
  const [open, setOpen] = useState(false);

  const refs = (items as WorkItemFull[]).filter((i) => i.item_type === "Document");

  return (
    <>
      <InfoBanner>
        File uploads arrive with storage in a later pass. Document references you add here are
        persistent project records and stay linked to this project.
      </InfoBanner>

      <SectionCard
        className="mt-4"
        title="Documents & links"
        icon={<FileText className="size-[18px] text-primary" />}
        actions={
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add document reference
          </Button>
        }
      >
        {refs.length === 0 ? (
          <EmptyState
            title="No documents referenced yet"
            note="Add plan sets, spec sheets, shop drawings or shared drive links."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Reference</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody>
              {refs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>
                    <span className="font-semibold">{r.title}</span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <LinkIcon className="size-3.5" /> {r.description ?? "—"}
                    </span>
                  </Td>
                  <Td>{r.owner ?? "Office"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {open ? (
        <AddDocModal
          onClose={() => setOpen(false)}
          onSave={async (values) => {
            await insert.mutateAsync({
              project_id: projectId,
              item_type: "Document",
              title: values.title,
              description: values.reference,
              owner: "Office",
              status: "Complete",
            });
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function AddDocModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (values: { title: string; reference: string }) => void;
}) {
  const [values, setValues] = useState({ title: "", reference: "" });
  const valid = values.title.trim().length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Add document reference"
      subtitle="Plan set, spec sheet, shop drawing or shared link."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave({ title: values.title.trim(), reference: values.reference.trim() })}
            disabled={!valid}
            {...(!valid ? { disabledReason: "Enter a document name" } : {})}
          >
            Save reference
          </Button>
        </>
      }
    >
      <Field label="Document name">
        <TextInput
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="Master bath plan set — Rev C"
        />
      </Field>
      <Field label="Reference or link">
        <TextInput
          value={values.reference}
          onChange={(e) => setValues((v) => ({ ...v, reference: e.target.value }))}
          placeholder="https://…  or  Shared drive / Park Place / Plans"
        />
      </Field>
    </Modal>
  );
}
