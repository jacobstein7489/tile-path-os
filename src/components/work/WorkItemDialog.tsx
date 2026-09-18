import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
        <div className="bg-canvas p-2 sm:p-5">
          <WorkItemPanel item={item} compact />
          <div className="mt-3 flex justify-end px-2 pb-2">
            <Link
              to="/work-item/$itemId"
              params={{ itemId: item.id }}
              onClick={onClose}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Open full detail <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </CenterDialog>
  );
}