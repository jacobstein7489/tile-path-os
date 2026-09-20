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
      className="sm:max-w-[1020px]"
      {item ? (
        <div className="min-h-full bg-canvas p-2 pb-4 sm:p-4">
          <WorkItemPanel item={item} compact />
        </div>
      ) : null}
    </CenterDialog>
  );
}
