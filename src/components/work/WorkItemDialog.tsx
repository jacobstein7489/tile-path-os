import { CenterDialog } from "@/components/ops/CenterDialog";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import type { WorkItemRow } from "@/lib/workitems";

export function WorkItemDialog({
  item,
  onClose,
}: {
  item: WorkItemRow | null;
  onClose: () => void;
}) {
  return (
    <CenterDialog
      open={Boolean(item)}
      onOpenChange={(open) => !open && onClose()}
      title={item?.title ?? "Work item"}
      description="Review and move this work item forward without leaving the action queue."
    >
      {item ? (
        <div className="min-h-full bg-canvas p-2 pb-6 sm:p-5">
          <WorkItemPanel item={item} compact />
        </div>
      ) : null}
    </CenterDialog>
  );
}
